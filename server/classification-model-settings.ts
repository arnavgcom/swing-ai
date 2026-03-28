import { appSettings, modelTrainingJobs } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import { db } from "./db";
import { readModelRegistryConfig } from "./model-registry";
import {
  ensureLocalClassificationModelArtifact,
  getActiveClassificationModelLocalPath,
  getVersionedClassificationModelLocalPath,
} from "./model-artifact-storage";

export type DriveMovementClassificationModelOption = {
  key: string;
  label: string;
  description: string;
  badge?: string;
  modelVersion?: string | null;
};

const DRIVE_MOVEMENT_CLASSIFICATION_MODEL_SELECTION_KEY = "driveMovementClassificationModelSelection";
const LEGACY_CLASSIFICATION_MODEL_SELECTION_KEY = "classificationModelSelection";
const ACTIVE_CLASSIFICATION_MODEL_KEY = "tennis-active";
const TENNIS_MODEL_FILENAME = "tennis_movement_classifier.joblib";

type ResolvedDriveMovementClassificationModelOption = DriveMovementClassificationModelOption & {
  modelPath: string;
};

function normalizeVersion(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith("v") ? trimmed.slice(1) : trimmed;
}

function buildActiveDriveMovementClassificationModelOption(): ResolvedDriveMovementClassificationModelOption {
  const config = readModelRegistryConfig();
  const activeVersion = normalizeVersion(config.activeModelVersion || "") || null;
  const labelSuffix = activeVersion ? ` (v${activeVersion})` : "";
  const descriptionPrefix = config.modelVersionChangeDescription
    ? `${config.modelVersionChangeDescription}. `
    : "";

  return {
    key: ACTIVE_CLASSIFICATION_MODEL_KEY,
    label: `Current production drive movement model${labelSuffix}`,
    description: `${descriptionPrefix}Uses ${TENNIS_MODEL_FILENAME} for live drive movement classification.`.trim(),
    badge: "Active",
    modelVersion: activeVersion,
    modelPath: getActiveClassificationModelLocalPath(),
  };
}

function sortVersionsDescending(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" });
}

async function buildVersionedDriveMovementClassificationModelOptions(): Promise<ResolvedDriveMovementClassificationModelOption[]> {
  const activeVersion = normalizeVersion(readModelRegistryConfig().activeModelVersion || "");
  const rows = await db
    .select({
      savedModelVersion: modelTrainingJobs.savedModelVersion,
      versionDescription: modelTrainingJobs.versionDescription,
    })
    .from(modelTrainingJobs)
    .where(
      and(
        eq(modelTrainingJobs.sportName, "tennis"),
        eq(modelTrainingJobs.modelFamily, "movement-classifier"),
        eq(modelTrainingJobs.status, "succeeded"),
        sql`${modelTrainingJobs.savedModelVersion} is not null`,
      ),
    )
    .orderBy(
      desc(modelTrainingJobs.savedAt),
      desc(modelTrainingJobs.completedAt),
      desc(modelTrainingJobs.updatedAt),
    );

  const versionMap = new Map<string, ResolvedDriveMovementClassificationModelOption>();
  for (const row of rows) {
    const version = normalizeVersion(String(row.savedModelVersion || ""));
    if (!version || version === activeVersion || versionMap.has(version)) {
      continue;
    }

    const description = String(row.versionDescription || "").trim() || `Uses archived drive movement classifier v${version}.`;
    versionMap.set(version, {
      key: `tennis-version:${version}`,
      label: `Saved drive movement model v${version}`,
      description,
      badge: "Saved",
      modelVersion: version,
      modelPath: getVersionedClassificationModelLocalPath(version),
    });
  }

  return Array.from(versionMap.entries())
    .sort((left, right) => sortVersionsDescending(left[0], right[0]))
    .map(([, option]) => option);
}

async function getResolvedDriveMovementClassificationModelOptions(): Promise<ResolvedDriveMovementClassificationModelOption[]> {
  const activeOption = buildActiveDriveMovementClassificationModelOption();
  return [activeOption, ...(await buildVersionedDriveMovementClassificationModelOptions())];
}

function normalizeDriveMovementClassificationModelOption(value: unknown): DriveMovementClassificationModelOption | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const key = String(record.key || "").trim();
  const label = String(record.label || "").trim();
  const description = String(record.description || "").trim();
  const badge = String(record.badge || "").trim();
  const modelVersion = String(record.modelVersion || "").trim();

  if (!key || !label || !description) {
    return null;
  }

  return {
    key,
    label,
    description,
    ...(badge ? { badge } : {}),
    ...(modelVersion ? { modelVersion } : {}),
  };
}

function dedupeDriveMovementClassificationModelOptions(
  options: DriveMovementClassificationModelOption[],
): DriveMovementClassificationModelOption[] {
  const deduped = new Map<string, DriveMovementClassificationModelOption>();
  for (const option of options) {
    deduped.set(option.key, option);
  }
  return Array.from(deduped.values());
}

function ensureDefaultDriveMovementClassificationModelOption(
  options: DriveMovementClassificationModelOption[],
): DriveMovementClassificationModelOption[] {
  const normalized = dedupeDriveMovementClassificationModelOptions(options);
  const defaults = getResolvedDriveMovementClassificationModelOptions().map(({ modelPath: _modelPath, ...option }) => option);
  const merged = new Map<string, DriveMovementClassificationModelOption>();

  for (const option of defaults) {
    merged.set(option.key, option);
  }

  for (const option of normalized) {
    if (merged.has(option.key)) {
      merged.set(option.key, { ...merged.get(option.key)!, ...option, key: option.key });
    }
  }

  return Array.from(merged.values());
}

export async function getDriveMovementClassificationModelOptions(): Promise<DriveMovementClassificationModelOption[]> {
  return (await getResolvedDriveMovementClassificationModelOptions()).map(({ modelPath: _modelPath, ...option }) => option);
}

export async function getDriveMovementClassificationModelSettings(actorUserId?: string | null): Promise<{
  selectedModelKey: string;
  options: DriveMovementClassificationModelOption[];
}> {
  const options = await getDriveMovementClassificationModelOptions();

  const [nextSetting, legacySetting] = await Promise.all([
    db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, DRIVE_MOVEMENT_CLASSIFICATION_MODEL_SELECTION_KEY))
      .limit(1)
      .then((rows) => rows[0] || null),
    db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, LEGACY_CLASSIFICATION_MODEL_SELECTION_KEY))
      .limit(1)
      .then((rows) => rows[0] || null),
  ]);

  const setting = nextSetting || legacySetting;

  const rawSelectedModelKey = setting?.value && typeof setting.value === "object"
    ? String((setting.value as Record<string, unknown>).modelKey || "").trim()
    : "";

  const selectedModelKey = options.some((option) => option.key === rawSelectedModelKey)
    ? rawSelectedModelKey
    : options[0].key;

  if (rawSelectedModelKey !== selectedModelKey) {
    await db
      .insert(appSettings)
      .values({
        key: DRIVE_MOVEMENT_CLASSIFICATION_MODEL_SELECTION_KEY,
        value: { modelKey: selectedModelKey },
        ...buildInsertAuditFields(actorUserId || null),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: { modelKey: selectedModelKey },
          ...buildUpdateAuditFields(actorUserId || null),
        },
      });
  }

  if (!nextSetting && legacySetting) {
    await db
      .insert(appSettings)
      .values({
        key: DRIVE_MOVEMENT_CLASSIFICATION_MODEL_SELECTION_KEY,
        value: { modelKey: selectedModelKey },
        ...buildInsertAuditFields(actorUserId || null),
      })
      .onConflictDoNothing();

    await db
      .delete(appSettings)
      .where(eq(appSettings.key, LEGACY_CLASSIFICATION_MODEL_SELECTION_KEY));
  }

  return {
    selectedModelKey,
    options,
  };
}

export async function getDriveMovementClassificationModelRuntimeSelection(actorUserId?: string | null): Promise<{
  selectedModelKey: string;
  modelPath: string;
  modelVersion: string | null;
  env: NodeJS.ProcessEnv;
  option: DriveMovementClassificationModelOption;
}> {
  const resolvedOptions = await getResolvedDriveMovementClassificationModelOptions();
  const { selectedModelKey } = await getDriveMovementClassificationModelSettings(actorUserId);
  const selectedOption = resolvedOptions.find((option) => option.key === selectedModelKey) || resolvedOptions[0];
  const modelPath = await ensureLocalClassificationModelArtifact({
    selectedModelKey: selectedOption.key,
    modelVersion: selectedOption.modelVersion || null,
  });

  return {
    selectedModelKey: selectedOption.key,
    modelPath,
    modelVersion: selectedOption.modelVersion || null,
    env: {
      SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_KEY: selectedOption.key,
      SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_PATH: modelPath,
      ...(selectedOption.modelVersion
        ? { SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_VERSION: selectedOption.modelVersion }
        : {}),
    },
    option: {
      key: selectedOption.key,
      label: selectedOption.label,
      description: selectedOption.description,
      ...(selectedOption.badge ? { badge: selectedOption.badge } : {}),
      ...(selectedOption.modelVersion ? { modelVersion: selectedOption.modelVersion } : {}),
    },
  };
}

export async function getDriveMovementClassificationModelPythonEnv(actorUserId?: string | null): Promise<NodeJS.ProcessEnv> {
  const selection = await getDriveMovementClassificationModelRuntimeSelection(actorUserId);
  return selection.env;
}

export async function getDriveMovementClassificationModelPythonEnvForSelection(params: {
  selectedModelKey: string;
  modelVersion?: string | null;
}): Promise<NodeJS.ProcessEnv> {
  const modelPath = await ensureLocalClassificationModelArtifact({
    selectedModelKey: params.selectedModelKey,
    modelVersion: params.modelVersion || null,
  });

  return {
    SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_KEY: params.selectedModelKey,
    SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_PATH: modelPath,
    ...(params.modelVersion
      ? { SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_VERSION: params.modelVersion }
      : {}),
  };
}

export async function setDriveMovementClassificationModelSelection(
  modelKey: string,
  actorUserId?: string | null,
): Promise<void> {
  const options = await getDriveMovementClassificationModelOptions();
  if (!options.some((option) => option.key === modelKey)) {
    throw new Error("Unknown drive movement classification model");
  }

  await db
    .insert(appSettings)
    .values({
      key: DRIVE_MOVEMENT_CLASSIFICATION_MODEL_SELECTION_KEY,
      value: { modelKey },
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { modelKey },
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });

  await db
    .delete(appSettings)
    .where(eq(appSettings.key, LEGACY_CLASSIFICATION_MODEL_SELECTION_KEY));
}

export async function setDriveMovementClassificationModelOptions(
  options: DriveMovementClassificationModelOption[],
  actorUserId?: string | null,
): Promise<DriveMovementClassificationModelOption[]> {
  void options;
  void actorUserId;
  return ensureDefaultDriveMovementClassificationModelOption(
    (await getResolvedDriveMovementClassificationModelOptions()).map(({ modelPath: _modelPath, ...option }) => option),
  );
}

export type ClassificationModelOption = DriveMovementClassificationModelOption;

export async function getClassificationModelOptions(): Promise<ClassificationModelOption[]> {
  return getDriveMovementClassificationModelOptions();
}

export async function getClassificationModelSettings(actorUserId?: string | null): Promise<{
  selectedModelKey: string;
  options: ClassificationModelOption[];
}> {
  return getDriveMovementClassificationModelSettings(actorUserId);
}

export async function getClassificationModelRuntimeSelection(actorUserId?: string | null): Promise<{
  selectedModelKey: string;
  modelPath: string;
  modelVersion: string | null;
  env: NodeJS.ProcessEnv;
  option: ClassificationModelOption;
}> {
  return getDriveMovementClassificationModelRuntimeSelection(actorUserId);
}

export async function getClassificationModelPythonEnv(actorUserId?: string | null): Promise<NodeJS.ProcessEnv> {
  return getDriveMovementClassificationModelPythonEnv(actorUserId);
}

export async function setClassificationModelSelection(modelKey: string, actorUserId?: string | null): Promise<void> {
  return setDriveMovementClassificationModelSelection(modelKey, actorUserId);
}

export async function setClassificationModelOptions(
  options: ClassificationModelOption[],
  actorUserId?: string | null,
): Promise<ClassificationModelOption[]> {
  return setDriveMovementClassificationModelOptions(options, actorUserId);
}