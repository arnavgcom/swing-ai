import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  analyses,
  modelRegistryDatasetItems,
  modelRegistryDatasets,
  modelRegistryVersions,
} from "@swing-ai/shared/schema";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import { resolveProjectPath } from "./env";

export interface ModelRegistryConfig {
  activeModelVersion: string;
  modelVersionChangeDescription: string;
  evaluationDatasetManifestPath: string;
}

export interface EvaluationDatasetVideo {
  videoId: string;
  filename: string;
  movementType: string;
}

export interface EvaluationDataset {
  id?: string;
  name: string;
  description?: string;
  source?: string;
  videos: EvaluationDatasetVideo[];
}

export interface EvaluationDatasetManifest {
  activeModelVersion?: string;
  versionHistory?: Array<{
    modelVersion: string;
    savedAt: string;
    datasets: EvaluationDataset[];
  }>;
  datasets: EvaluationDataset[];
}

export interface ManifestValidationResult {
  valid: boolean;
  datasetCount: number;
  totalVideos: number;
  duplicateFilenames: string[];
  duplicateVideoIds: string[];
  errors: string[];
  warnings: string[];
}

export interface ModelRegistryVersionSummary {
  id: string;
  modelVersion: string;
  description: string;
  status: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRegistryDatasetSummary {
  id: string;
  name: string;
  description: string;
  source: string;
  videoCount: number;
  movementTypes: string[];
  updatedAt: string;
}

export interface ModelRegistryOverview {
  storage: "database";
  config: ModelRegistryConfig;
  versions: ModelRegistryVersionSummary[];
  datasets: ModelRegistryDatasetSummary[];
  validation: ManifestValidationResult;
}

type DatasetMapEntry = {
  videoId: string;
  datasetName: string;
  movementType: string;
};

type RegistryCache = {
  initialized: boolean;
  config: ModelRegistryConfig;
  manifest: EvaluationDatasetManifest;
  validation: ManifestValidationResult;
  versions: ModelRegistryVersionSummary[];
  datasets: ModelRegistryDatasetSummary[];
  datasetMap: Map<string, DatasetMapEntry>;
};

const legacyConfigPath = resolveProjectPath("config", "model-registry.config.json");
const legacyManifestPath = resolveProjectPath("model_evaluation_datasets", "manifest.json");
const legacyDatasetFolderPrefix = "model_evaluation_datasets/dataset";
const manualTuningDatasetName = "manual-annotations";
const databaseManifestPath = "database://model-registry";

const defaultConfig: ModelRegistryConfig = {
  activeModelVersion: "0.1",
  modelVersionChangeDescription: "Initial baseline scoring model release.",
  evaluationDatasetManifestPath: databaseManifestPath,
};

let cache: RegistryCache = {
  initialized: false,
  config: defaultConfig,
  manifest: { datasets: [] },
  validation: {
    valid: true,
    datasetCount: 0,
    totalVideos: 0,
    duplicateFilenames: [],
    duplicateVideoIds: [],
    errors: [],
    warnings: [],
  },
  versions: [],
  datasets: [],
  datasetMap: new Map(),
};

function normalizeToken(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeFilenameToken(value: string): string {
  return path.basename(String(value || "").trim()).toLowerCase();
}

function toLegacyVideoId(filename: string): string {
  const normalized = String(filename || "").trim().toLowerCase();
  const digest = createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  return `legacy-${digest}`;
}

function resolveVideoId(video: Partial<EvaluationDatasetVideo>): string {
  const parsed = String((video as { videoId?: unknown })?.videoId || "").trim();
  if (parsed) return parsed;
  return toLegacyVideoId(String(video.filename || ""));
}

function parseLegacyConfigFile(): ModelRegistryConfig {
  try {
    const raw = fs.readFileSync(legacyConfigPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ModelRegistryConfig>;
    return {
      activeModelVersion: String(parsed.activeModelVersion || defaultConfig.activeModelVersion),
      modelVersionChangeDescription: String(
        parsed.modelVersionChangeDescription || defaultConfig.modelVersionChangeDescription,
      ),
      evaluationDatasetManifestPath: databaseManifestPath,
    };
  } catch {
    return defaultConfig;
  }
}

function parseLegacyManifestFile(): EvaluationDatasetManifest {
  try {
    const raw = fs.readFileSync(legacyManifestPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<EvaluationDatasetManifest>;
    const datasets = Array.isArray(parsed.datasets)
      ? parsed.datasets.map((dataset) => ({
          name: String(dataset?.name || "unnamed-dataset"),
          videos: Array.isArray(dataset?.videos)
            ? dataset.videos
                .map((video) => ({
                  videoId: resolveVideoId(video || {}),
                  filename: String(video?.filename || "").trim(),
                  movementType: String(video?.movementType || "").trim(),
                }))
                .filter((video) => video.filename)
            : [],
        }))
      : [];

    return {
      activeModelVersion: String(parsed.activeModelVersion || "").trim() || undefined,
      versionHistory: [],
      datasets,
    };
  } catch {
    return { datasets: [] };
  }
}

function computeValidation(manifest: EvaluationDatasetManifest): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = ["Evaluation registry is stored in the database."];
  const filenameCounts = new Map<string, number>();
  const videoIdCounts = new Map<string, number>();

  if (!manifest.datasets.length) {
    warnings.push("No datasets configured in the model registry.");
  }

  for (const dataset of manifest.datasets) {
    if (!String(dataset.name || "").trim()) {
      errors.push("Dataset with empty name found.");
    }

    if (!Array.isArray(dataset.videos) || dataset.videos.length === 0) {
      warnings.push(`Dataset '${dataset.name}' has no videos.`);
      continue;
    }

    for (const video of dataset.videos) {
      const filename = String(video.filename || "").trim();
      const videoId = String(video.videoId || "").trim();
      const movementType = String(video.movementType || "").trim();

      if (!filename) {
        errors.push(`Dataset '${dataset.name}' contains a video entry with empty filename.`);
        continue;
      }
      if (!videoId) {
        warnings.push(`Video '${filename}' in dataset '${dataset.name}' is missing videoId.`);
      }
      if (!movementType) {
        errors.push(`Video '${filename}' in dataset '${dataset.name}' is missing movementType.`);
      }

      filenameCounts.set(filename, (filenameCounts.get(filename) || 0) + 1);
      if (videoId) {
        videoIdCounts.set(videoId, (videoIdCounts.get(videoId) || 0) + 1);
      }
    }
  }

  const duplicateFilenames = Array.from(filenameCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([filename]) => filename)
    .sort();
  const duplicateVideoIds = Array.from(videoIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([videoId]) => videoId)
    .sort();

  if (duplicateFilenames.length > 0) {
    errors.push(`Found duplicate filenames in registry datasets: ${duplicateFilenames.join(", ")}.`);
  }
  if (duplicateVideoIds.length > 0) {
    errors.push(`Found duplicate videoIds in registry datasets: ${duplicateVideoIds.join(", ")}.`);
  }

  return {
    valid: errors.length === 0,
    datasetCount: manifest.datasets.length,
    totalVideos: Array.from(filenameCounts.values()).reduce((sum, count) => sum + count, 0),
    duplicateFilenames,
    duplicateVideoIds,
    errors,
    warnings,
  };
}

function buildDatasetMap(manifest: EvaluationDatasetManifest): Map<string, DatasetMapEntry> {
  const map = new Map<string, DatasetMapEntry>();

  for (const dataset of manifest.datasets) {
    for (const video of dataset.videos) {
      const entry = {
        videoId: video.videoId,
        datasetName: dataset.name,
        movementType: video.movementType,
      };
      const fullName = String(video.filename || "").trim();
      if (video.videoId) {
        map.set(video.videoId, entry);
      }
      if (!fullName) continue;
      map.set(fullName, entry);
      map.set(normalizeFilenameToken(fullName), entry);
      const legacyPath = `${legacyDatasetFolderPrefix}/${path.basename(fullName)}`;
      map.set(legacyPath, entry);
      map.set(normalizeFilenameToken(legacyPath), entry);
    }
  }

  return map;
}

async function ensureDefaultVersionRow(): Promise<void> {
  const [existing] = await db
    .select()
    .from(modelRegistryVersions)
    .where(eq(modelRegistryVersions.modelVersion, defaultConfig.activeModelVersion))
    .limit(1);

  if (!existing) {
    await db.insert(modelRegistryVersions).values({
      modelVersion: defaultConfig.activeModelVersion,
      description: defaultConfig.modelVersionChangeDescription,
      status: "active",
      activatedAt: new Date(),
      ...buildInsertAuditFields(null),
    });
  }
}

async function migrateLegacyFilesystemRegistryIfNeeded(): Promise<void> {
  const [versionCountRow] = await db
    .select({ id: modelRegistryVersions.id })
    .from(modelRegistryVersions)
    .limit(1);
  const hasVersions = Boolean(versionCountRow?.id);

  const [datasetCountRow] = await db
    .select({ id: modelRegistryDatasets.id })
    .from(modelRegistryDatasets)
    .limit(1);
  const hasDatasets = Boolean(datasetCountRow?.id);

  if (hasVersions && hasDatasets) {
    return;
  }

  const legacyConfig = parseLegacyConfigFile();
  const legacyManifest = parseLegacyManifestFile();

  if (!hasVersions) {
    await db.insert(modelRegistryVersions).values({
      modelVersion: legacyConfig.activeModelVersion,
      description: legacyConfig.modelVersionChangeDescription,
      status: "active",
      activatedAt: new Date(),
      ...buildInsertAuditFields(null),
    }).onConflictDoNothing();
  }

  if (hasDatasets || legacyManifest.datasets.length === 0) {
    return;
  }

  const allAnalyses = await db
    .select({
      id: analyses.id,
      videoFilename: analyses.videoFilename,
      sourceFilename: analyses.sourceFilename,
      evaluationVideoId: analyses.evaluationVideoId,
    })
    .from(analyses);

  for (const dataset of legacyManifest.datasets) {
    const datasetName = String(dataset.name || "").trim() || manualTuningDatasetName;
    const [datasetRow] = await db
      .insert(modelRegistryDatasets)
      .values({
        name: datasetName,
        description: "Migrated from legacy manifest",
        source: "legacy-manifest",
        ...buildInsertAuditFields(null),
      })
      .onConflictDoNothing()
      .returning();

    const targetDataset = datasetRow || (await db
      .select()
      .from(modelRegistryDatasets)
      .where(eq(modelRegistryDatasets.name, datasetName))
      .limit(1))[0];

    if (!targetDataset) continue;

    for (const video of dataset.videos || []) {
      const filename = String(video.filename || "").trim();
      const normalizedFilename = normalizeFilenameToken(filename);
      const videoId = String(video.videoId || "").trim();

      const matchedAnalysis = allAnalyses.find((analysis) => {
        if (videoId && String(analysis.evaluationVideoId || "").trim() === videoId) {
          return true;
        }
        return [
          analysis.sourceFilename,
          analysis.videoFilename,
          `${legacyDatasetFolderPrefix}/${analysis.videoFilename}`,
          `${legacyDatasetFolderPrefix}/${analysis.sourceFilename || ""}`,
        ]
          .filter(Boolean)
          .some((candidate) => normalizeFilenameToken(String(candidate)) === normalizedFilename);
      });

      if (!matchedAnalysis) continue;

      await db.insert(modelRegistryDatasetItems).values({
        datasetId: targetDataset.id,
        analysisId: matchedAnalysis.id,
        expectedMovement: String(video.movementType || "").trim() || "unknown",
        evaluationVideoId: videoId || matchedAnalysis.evaluationVideoId || null,
        sourceFilename: matchedAnalysis.sourceFilename || path.basename(filename) || matchedAnalysis.videoFilename,
        ...buildInsertAuditFields(null),
      }).onConflictDoNothing();

      if (videoId && videoId !== String(matchedAnalysis.evaluationVideoId || "").trim()) {
        await db
          .update(analyses)
          .set({
            evaluationVideoId: videoId,
            ...buildUpdateAuditFields(null),
          })
          .where(eq(analyses.id, matchedAnalysis.id));
      }
    }
  }
}

async function loadVersionSummaries(): Promise<ModelRegistryVersionSummary[]> {
  const rows = await db
    .select()
    .from(modelRegistryVersions)
    .orderBy(desc(modelRegistryVersions.activatedAt), desc(modelRegistryVersions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    modelVersion: row.modelVersion,
    description: row.description,
    status: row.status,
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function loadDatasetsAndManifest(): Promise<{
  datasets: ModelRegistryDatasetSummary[];
  manifest: EvaluationDatasetManifest;
}> {
  const datasetRows = await db
    .select()
    .from(modelRegistryDatasets)
    .orderBy(asc(modelRegistryDatasets.name));

  const datasetIds = datasetRows.map((row) => row.id);
  const items = datasetIds.length
    ? await db
        .select({
          item: modelRegistryDatasetItems,
          analysis: analyses,
        })
        .from(modelRegistryDatasetItems)
        .innerJoin(analyses, eq(modelRegistryDatasetItems.analysisId, analyses.id))
        .where(inArray(modelRegistryDatasetItems.datasetId, datasetIds))
    : [];

  const itemsByDatasetId = new Map<string, typeof items>();
  for (const row of items) {
    const current = itemsByDatasetId.get(row.item.datasetId) || [];
    current.push(row);
    itemsByDatasetId.set(row.item.datasetId, current);
  }

  const summaries: ModelRegistryDatasetSummary[] = [];
  const manifestDatasets: EvaluationDataset[] = [];

  for (const dataset of datasetRows) {
    const rows = itemsByDatasetId.get(dataset.id) || [];
    const movementTypes = Array.from(new Set(rows.map((row) => String(row.item.expectedMovement || "").trim()).filter(Boolean))).sort();
    const videos = rows.map((row) => ({
      videoId:
        String(row.item.evaluationVideoId || row.analysis.evaluationVideoId || "").trim() ||
        toLegacyVideoId(String(row.item.sourceFilename || row.analysis.sourceFilename || row.analysis.videoFilename || "")),
      filename: String(row.item.sourceFilename || row.analysis.sourceFilename || row.analysis.videoFilename || "").trim(),
      movementType: String(row.item.expectedMovement || "").trim() || "unknown",
    }));

    summaries.push({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      source: dataset.source,
      videoCount: videos.length,
      movementTypes,
      updatedAt: dataset.updatedAt.toISOString(),
    });

    manifestDatasets.push({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      source: dataset.source,
      videos,
    });
  }

  return {
    datasets: summaries,
    manifest: { datasets: manifestDatasets },
  };
}

async function ensureDraftVersion(activeModelVersion: string, actorUserId?: string | null): Promise<string> {
  const nextModelVersion = incrementModelVersion(activeModelVersion);
  const [existing] = await db
    .select()
    .from(modelRegistryVersions)
    .where(eq(modelRegistryVersions.modelVersion, nextModelVersion))
    .limit(1);

  if (!existing) {
    await db.insert(modelRegistryVersions).values({
      modelVersion: nextModelVersion,
      description: `Draft prepared after ${activeModelVersion}`,
      status: "draft",
      ...buildInsertAuditFields(actorUserId || null),
    });
  }

  return nextModelVersion;
}

export async function initializeModelRegistryCache(): Promise<void> {
  await refreshModelRegistryCache();
}

export async function refreshModelRegistryCache(): Promise<ModelRegistryOverview> {
  await migrateLegacyFilesystemRegistryIfNeeded();
  await ensureDefaultVersionRow();

  let versions = await loadVersionSummaries();
  let activeVersion = versions.find((version) => version.status === "active");

  if (!activeVersion && versions.length > 0) {
    const fallback = versions[0];
    await db
      .update(modelRegistryVersions)
      .set({
        status: "active",
        activatedAt: new Date(),
        ...buildUpdateAuditFields(null),
      })
      .where(eq(modelRegistryVersions.id, fallback.id));
    versions = await loadVersionSummaries();
    activeVersion = versions.find((version) => version.modelVersion === fallback.modelVersion) || versions[0];
  }

  const { datasets, manifest } = await loadDatasetsAndManifest();
  manifest.activeModelVersion = activeVersion?.modelVersion || defaultConfig.activeModelVersion;
  const validation = computeValidation(manifest);
  const config: ModelRegistryConfig = {
    activeModelVersion: activeVersion?.modelVersion || defaultConfig.activeModelVersion,
    modelVersionChangeDescription: activeVersion?.description || defaultConfig.modelVersionChangeDescription,
    evaluationDatasetManifestPath: databaseManifestPath,
  };

  cache = {
    initialized: true,
    config,
    manifest,
    validation,
    versions,
    datasets,
    datasetMap: buildDatasetMap(manifest),
  };

  return {
    storage: "database",
    config,
    versions,
    datasets,
    validation,
  };
}

export function readModelRegistryConfig(): ModelRegistryConfig {
  return cache.config;
}

export function readEvaluationDatasetManifest(_config?: ModelRegistryConfig): EvaluationDatasetManifest {
  return cache.manifest;
}

export function getEvaluationDatasetVideoMap(_config?: ModelRegistryConfig): Map<string, DatasetMapEntry> {
  return cache.datasetMap;
}

export function listModelRegistryVersions(): ModelRegistryVersionSummary[] {
  return cache.versions;
}

export function listModelRegistryDatasets(): ModelRegistryDatasetSummary[] {
  return cache.datasets;
}

export function getModelRegistryOverview(): ModelRegistryOverview {
  return {
    storage: "database",
    config: cache.config,
    versions: cache.versions,
    datasets: cache.datasets,
    validation: cache.validation,
  };
}

export async function writeModelRegistryConfig(
  nextConfig: ModelRegistryConfig,
  actorUserId?: string | null,
): Promise<ModelRegistryConfig> {
  const activeModelVersion = String(nextConfig.activeModelVersion || "").trim() || defaultConfig.activeModelVersion;
  const description = String(nextConfig.modelVersionChangeDescription || "").trim();

  const [existingTarget] = await db
    .select()
    .from(modelRegistryVersions)
    .where(eq(modelRegistryVersions.modelVersion, activeModelVersion))
    .limit(1);

  if (existingTarget) {
    await db
      .update(modelRegistryVersions)
      .set({
        description,
        status: "active",
        activatedAt: new Date(),
        activatedByUserId: actorUserId || null,
        ...buildUpdateAuditFields(actorUserId || null),
      })
      .where(eq(modelRegistryVersions.id, existingTarget.id));
  } else {
    await db.insert(modelRegistryVersions).values({
      modelVersion: activeModelVersion,
      description,
      status: "active",
      activatedAt: new Date(),
      activatedByUserId: actorUserId || null,
      ...buildInsertAuditFields(actorUserId || null),
    });
  }

  const activeRows = await db
    .select()
    .from(modelRegistryVersions)
    .where(eq(modelRegistryVersions.status, "active"));
  for (const row of activeRows) {
    if (row.modelVersion === activeModelVersion) continue;
    await db
      .update(modelRegistryVersions)
      .set({
        status: "archived",
        ...buildUpdateAuditFields(actorUserId || null),
      })
      .where(eq(modelRegistryVersions.id, row.id));
  }

  await ensureDraftVersion(activeModelVersion, actorUserId || null);
  await refreshModelRegistryCache();
  return cache.config;
}

export async function updateManifestActiveModelVersion(
  activeModelVersion: string,
  config?: ModelRegistryConfig,
  actorUserId?: string | null,
): Promise<EvaluationDatasetManifest> {
  await writeModelRegistryConfig(
    {
      activeModelVersion,
      modelVersionChangeDescription:
        config?.modelVersionChangeDescription || cache.config.modelVersionChangeDescription,
      evaluationDatasetManifestPath: databaseManifestPath,
    },
    actorUserId || null,
  );
  return cache.manifest;
}

export async function syncVideoForModelTuning(params: {
  sourceVideoPath: string;
  sourceVideoFilename: string;
  movementType: string;
  enabled: boolean;
  datasetName?: string;
  videoId?: string;
  analysisId?: string;
  annotatorUserId?: string | null;
  actorUserId?: string | null;
}): Promise<{ enabled: boolean; manifestFilename: string; videoId: string }> {
  const filename = path.basename(String(params.sourceVideoFilename || "").trim());
  if (!filename) {
    throw new Error("Invalid sourceVideoFilename");
  }

  if (!params.analysisId) {
    throw new Error("analysisId is required to sync model training dataset state");
  }

  const nextMovementType = String(params.movementType || "").trim() || "unknown";
  const manifestFilename = filename;
  const datasetName = String(params.datasetName || "").trim() || manualTuningDatasetName;
  const nextVideoId = String(params.videoId || "").trim() || randomUUID();
  const actorUserId = params.actorUserId || null;

  if (!params.enabled) {
    await db
      .delete(modelRegistryDatasetItems)
      .where(eq(modelRegistryDatasetItems.analysisId, params.analysisId));
    await refreshModelRegistryCache();
    return {
      enabled: false,
      manifestFilename,
      videoId: nextVideoId,
    };
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, params.analysisId))
    .limit(1);

  if (!analysis) {
    throw new Error("Analysis not found for model training sync");
  }

  let [dataset] = await db
    .select()
    .from(modelRegistryDatasets)
    .where(eq(modelRegistryDatasets.name, datasetName))
    .limit(1);

  if (!dataset) {
    [dataset] = await db
      .insert(modelRegistryDatasets)
      .values({
        name: datasetName,
        description: "Manually curated evaluation dataset",
        source: "manual-annotation",
        ...buildInsertAuditFields(actorUserId),
      })
      .returning();
  }

  await db
    .delete(modelRegistryDatasetItems)
    .where(eq(modelRegistryDatasetItems.analysisId, params.analysisId));

  await db.insert(modelRegistryDatasetItems).values({
    datasetId: dataset.id,
    analysisId: params.analysisId,
    annotatorUserId: params.annotatorUserId || null,
    expectedMovement: nextMovementType,
    evaluationVideoId: nextVideoId,
    sourceFilename: analysis.sourceFilename || analysis.videoFilename,
    ...buildInsertAuditFields(actorUserId),
  });

  await refreshModelRegistryCache();
  return {
    enabled: true,
    manifestFilename,
    videoId: nextVideoId,
  };
}

export function isMovementMatch(expectedMovement: string, detectedMovement: string): boolean {
  const expected = normalizeToken(expectedMovement);
  const detected = normalizeToken(detectedMovement);
  if (!expected || !detected) return false;
  return expected === detected;
}

export function incrementModelVersion(currentVersion: string): string {
  const raw = String(currentVersion || "").trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return "0.1";

  let major = Number(match[1] || 0);
  let minor = Number(match[2] || 0);

  minor += 1;
  if (minor >= 10) {
    major += 1;
    minor = 0;
  }

  return `${major}.${minor}`;
}

export function validateEvaluationDatasetManifest(_config?: ModelRegistryConfig): ManifestValidationResult {
  return cache.validation;
}

export async function ensureDraftModelVersion(actorUserId?: string | null): Promise<string> {
  const activeVersion = cache.config.activeModelVersion || defaultConfig.activeModelVersion;
  const nextModelVersion = await ensureDraftVersion(activeVersion, actorUserId || null);
  await refreshModelRegistryCache();
  return nextModelVersion;
}
