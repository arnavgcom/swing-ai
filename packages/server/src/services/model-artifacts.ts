import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { appSettings } from "@swing-ai/shared/schema";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { resolveProjectPath } from "../config/env";
import { getVideoStorageMode, type VideoStorageMode } from "./media-storage";
import type { PoseLandmarkerModel } from "@swing-ai/shared/pose-landmarker";

const MODEL_ARTIFACT_STORAGE_MODE_KEY = "modelArtifactStorageMode";
const ACTIVE_CLASSIFICATION_FILENAME = "tennis_movement_classifier.joblib";
const ACTIVE_LSTM_FILENAME = "tennis_movement_lstm.pt";
const CLASSIFICATION_VERSIONS_DIR = resolveProjectPath("models", "versions");
const ACTIVE_CLASSIFICATION_PATH = resolveProjectPath("models", ACTIVE_CLASSIFICATION_FILENAME);
const ACTIVE_LSTM_PATH = resolveProjectPath("models", ACTIVE_LSTM_FILENAME);
const MODELS_ROOT = resolveProjectPath("models");

const POSE_MODEL_FILENAMES: Record<PoseLandmarkerModel, string> = {
  lite: "pose_landmarker_lite.task",
  full: "pose_landmarker_full.task",
  heavy: "pose_landmarker_heavy.task",
};

let cachedR2Client: S3Client | null = null;
const publishedPoseArtifactKeys = new Set<string>();

export type ModelArtifactStorageMode = VideoStorageMode;

export type ClassificationArtifactInfo = {
  storageMode: ModelArtifactStorageMode;
  modelVersion: string;
  localVersionPath: string;
  localActivePath: string;
  primaryReference: string;
  versionR2Key?: string;
  versionR2Reference?: string;
  activeR2Key?: string;
  activeR2Reference?: string;
  lstm?: {
    localVersionPath: string;
    localActivePath: string;
    versionR2Key?: string;
    versionR2Reference?: string;
    activeR2Key?: string;
    activeR2Reference?: string;
  };
};

function isStorageMode(value: unknown): value is ModelArtifactStorageMode {
  return value === "filesystem" || value === "r2";
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeVersion(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Model version is required");
  }
  return trimmed.toLowerCase().startsWith("v") ? trimmed.slice(1) : trimmed;
}

function normalizeKeyPrefix(value: string, fallback: string): string {
  const raw = String(value || fallback).trim().replace(/^\/+|\/+$/g, "");
  return raw || fallback;
}

function toR2Reference(key: string): string {
  return `r2://${String(key || "").replace(/^\/+/, "")}`;
}

function getR2Bucket(): string {
  const bucket = String(process.env.R2_BUCKET || "").trim();
  if (!bucket) {
    throw new Error("R2_BUCKET is required when model artifact storage uses r2");
  }
  return bucket;
}

function getR2Client(): S3Client {
  if (cachedR2Client) {
    return cachedR2Client;
  }

  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const region = String(process.env.R2_REGION || "auto").trim() || "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are incomplete. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  cachedR2Client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedR2Client;
}

function getModelArtifactPrefix(): string {
  return normalizeKeyPrefix(
    process.env.R2_PLAYER_MODEL_FOLDER || process.env.R2_MODEL_FOLDER || "model",
    "model",
  );
}

function getClassificationVersionFilename(modelVersion: string): string {
  return `tennis_movement_classifier_v${normalizeVersion(modelVersion)}.joblib`;
}

function getLstmVersionFilename(modelVersion: string): string {
  return `tennis_movement_lstm_v${normalizeVersion(modelVersion)}.pt`;
}

function getLstmVersionLocalPath(modelVersion: string): string {
  return path.join(CLASSIFICATION_VERSIONS_DIR, getLstmVersionFilename(modelVersion));
}

function getClassificationVersionLocalPath(modelVersion: string): string {
  return path.join(CLASSIFICATION_VERSIONS_DIR, getClassificationVersionFilename(modelVersion));
}

export function getActiveClassificationModelLocalPath(): string {
  return ACTIVE_CLASSIFICATION_PATH;
}

export function getVersionedClassificationModelLocalPath(modelVersion: string): string {
  return getClassificationVersionLocalPath(modelVersion);
}

export function getActiveLstmModelLocalPath(): string {
  return ACTIVE_LSTM_PATH;
}

export function getVersionedLstmModelLocalPath(modelVersion: string): string {
  return getLstmVersionLocalPath(modelVersion);
}

export function getPoseModelLocalPath(model: PoseLandmarkerModel): string {
  return path.join(MODELS_ROOT, POSE_MODEL_FILENAMES[model]);
}

function buildClassificationVersionKey(modelVersion: string): string {
  return `${getModelArtifactPrefix()}/tennis/classification/versions/${getClassificationVersionFilename(modelVersion)}`;
}

function buildClassificationActiveKey(): string {
  return `${getModelArtifactPrefix()}/tennis/classification/active/${ACTIVE_CLASSIFICATION_FILENAME}`;
}

function buildLstmVersionKey(modelVersion: string): string {
  return `${getModelArtifactPrefix()}/tennis/lstm/versions/${getLstmVersionFilename(modelVersion)}`;
}

function buildLstmActiveKey(): string {
  return `${getModelArtifactPrefix()}/tennis/lstm/active/${ACTIVE_LSTM_FILENAME}`;
}

function buildPoseModelKey(model: PoseLandmarkerModel): string {
  return `${getModelArtifactPrefix()}/pose/${POSE_MODEL_FILENAMES[model]}`;
}

async function downloadR2ObjectToFile(key: string, targetPath: string): Promise<void> {
  ensureDirectory(path.dirname(targetPath));

  const response = await getR2Client().send(new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
  }));

  if (!response.Body) {
    throw new Error(`R2 object not found: ${key}`);
  }

  const writeStream = fs.createWriteStream(targetPath);
  await pipeline(response.Body as NodeJS.ReadableStream, writeStream);
}

async function uploadFileToR2(localPath: string, key: string): Promise<void> {
  const body = await fs.promises.readFile(localPath);
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: body,
    ContentType: "application/octet-stream",
  }));
}

async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }));
    return true;
  } catch (error) {
    const candidate = error as {
      name?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number };
    };
    const statusCode = Number(candidate?.$metadata?.httpStatusCode || 0);
    const code = String(candidate?.Code || candidate?.name || "").toLowerCase();
    if (statusCode === 404 || code === "notfound" || code === "nosuchkey") {
      return false;
    }
    throw error;
  }
}

async function ensurePoseModelArtifactPublished(model: PoseLandmarkerModel, localPath: string): Promise<void> {
  const key = buildPoseModelKey(model);
  if (publishedPoseArtifactKeys.has(key)) {
    return;
  }

  if (!await r2ObjectExists(key)) {
    await uploadFileToR2(localPath, key);
  }

  publishedPoseArtifactKeys.add(key);
}

export async function getModelArtifactStorageMode(): Promise<ModelArtifactStorageMode> {
  const envValue = String(
    process.env.MODEL_ARTIFACT_STORAGE_MODE
    || process.env.MODEL_ARTIFACTS_STORAGE_MODE
    || process.env.modelArtifactStorageMode
    || process.env.videoStorageMode
    || process.env.VIDEO_STORAGE_MODE
    || "",
  ).trim().toLowerCase();

  if (isStorageMode(envValue)) {
    return envValue;
  }

  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, MODEL_ARTIFACT_STORAGE_MODE_KEY))
    .limit(1);

  const storedMode = setting?.value && typeof setting.value === "object"
    ? String((setting.value as Record<string, unknown>).mode || "").trim().toLowerCase()
    : "";

  if (isStorageMode(storedMode)) {
    return storedMode;
  }

  return getVideoStorageMode();
}

export async function getModelArtifactStorageLogDetails(): Promise<{
  mode: ModelArtifactStorageMode;
  bucket: string | null;
  prefix: string;
}> {
  return {
    mode: await getModelArtifactStorageMode(),
    bucket: String(process.env.R2_BUCKET || "").trim() || null,
    prefix: getModelArtifactPrefix(),
  };
}

export async function ensureLocalClassificationModelArtifact(params: {
  selectedModelKey: string;
  modelVersion?: string | null;
}): Promise<string> {
  const isActiveSelection = params.selectedModelKey === "tennis-active";
  const localPath = isActiveSelection
    ? ACTIVE_CLASSIFICATION_PATH
    : getClassificationVersionLocalPath(String(params.modelVersion || ""));

  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const storageMode = await getModelArtifactStorageMode();
  if (storageMode !== "r2") {
    throw new Error(`Classification model artifact is missing locally: ${localPath}`);
  }

  const candidateKeys = isActiveSelection
    ? [
        buildClassificationActiveKey(),
        ...(params.modelVersion ? [buildClassificationVersionKey(params.modelVersion)] : []),
      ]
    : [buildClassificationVersionKey(String(params.modelVersion || ""))];

  let lastError: Error | null = null;
  for (const key of candidateKeys) {
    try {
      await downloadR2ObjectToFile(key, localPath);
      return localPath;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `Classification model artifact could not be restored from R2 for ${params.modelVersion ? `v${normalizeVersion(params.modelVersion)}` : "active model"}: ${lastError?.message || "unknown error"}`,
  );
}

export async function ensureLocalPoseModelArtifact(model: PoseLandmarkerModel): Promise<string> {
  const localPath = getPoseModelLocalPath(model);
  const storageMode = await getModelArtifactStorageMode();

  if (fs.existsSync(localPath)) {
    if (storageMode === "r2") {
      await ensurePoseModelArtifactPublished(model, localPath);
    }
    return localPath;
  }

  if (storageMode !== "r2") {
    throw new Error(`Pose model artifact is missing locally: ${localPath}`);
  }

  try {
    await downloadR2ObjectToFile(buildPoseModelKey(model), localPath);
    return localPath;
  } catch (error) {
    const fallbackModel: PoseLandmarkerModel = "lite";
    if (model !== fallbackModel) {
      const fallbackPath = getPoseModelLocalPath(fallbackModel);
      if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
      }
      try {
        await downloadR2ObjectToFile(buildPoseModelKey(fallbackModel), fallbackPath);
        return fallbackPath;
      } catch {
        // Fall through to the original error below.
      }
    }
    throw new Error(
      `Pose model artifact could not be restored from R2 for ${model}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function publishClassificationModelArtifacts(params: {
  modelVersion: string;
  activeModelPath?: string;
  versionModelPath?: string;
  lstmActiveModelPath?: string;
  lstmVersionModelPath?: string;
}): Promise<ClassificationArtifactInfo> {
  const storageMode = await getModelArtifactStorageMode();
  const normalizedVersion = normalizeVersion(params.modelVersion);
  const localActivePath = params.activeModelPath || ACTIVE_CLASSIFICATION_PATH;
  const localVersionPath = params.versionModelPath || getClassificationVersionLocalPath(normalizedVersion);

  const lstmLocalActivePath = params.lstmActiveModelPath || ACTIVE_LSTM_PATH;
  const lstmLocalVersionPath = params.lstmVersionModelPath || getLstmVersionLocalPath(normalizedVersion);
  const hasLstmActive = fs.existsSync(lstmLocalActivePath);
  const hasLstmVersion = fs.existsSync(lstmLocalVersionPath);

  const info: ClassificationArtifactInfo = {
    storageMode,
    modelVersion: normalizedVersion,
    localVersionPath,
    localActivePath,
    primaryReference: localVersionPath,
    ...(hasLstmVersion || hasLstmActive ? {
      lstm: {
        localVersionPath: lstmLocalVersionPath,
        localActivePath: lstmLocalActivePath,
      },
    } : {}),
  };

  if (storageMode !== "r2") {
    return info;
  }

  const versionR2Key = buildClassificationVersionKey(normalizedVersion);
  const activeR2Key = buildClassificationActiveKey();

  await uploadFileToR2(localVersionPath, versionR2Key);
  await uploadFileToR2(localActivePath, activeR2Key);

  // Upload LSTM model to R2 if available
  let lstmArtifact: ClassificationArtifactInfo["lstm"] | undefined;
  if (hasLstmVersion || hasLstmActive) {
    const lstmVersionR2Key = buildLstmVersionKey(normalizedVersion);
    const lstmActiveR2Key = buildLstmActiveKey();

    if (hasLstmVersion) {
      await uploadFileToR2(lstmLocalVersionPath, lstmVersionR2Key);
    }
    if (hasLstmActive) {
      await uploadFileToR2(lstmLocalActivePath, lstmActiveR2Key);
    }

    lstmArtifact = {
      localVersionPath: lstmLocalVersionPath,
      localActivePath: lstmLocalActivePath,
      versionR2Key: hasLstmVersion ? lstmVersionR2Key : undefined,
      versionR2Reference: hasLstmVersion ? toR2Reference(lstmVersionR2Key) : undefined,
      activeR2Key: hasLstmActive ? lstmActiveR2Key : undefined,
      activeR2Reference: hasLstmActive ? toR2Reference(lstmActiveR2Key) : undefined,
    };
  }

  return {
    ...info,
    primaryReference: toR2Reference(versionR2Key),
    versionR2Key,
    versionR2Reference: toR2Reference(versionR2Key),
    activeR2Key,
    activeR2Reference: toR2Reference(activeR2Key),
    ...(lstmArtifact ? { lstm: lstmArtifact } : {}),
  };
}

export async function ensureLocalLstmModelArtifact(params: {
  selectedModelKey: string;
  modelVersion?: string | null;
}): Promise<string | null> {
  const isActiveSelection = params.selectedModelKey === "tennis-active";
  const localPath = isActiveSelection
    ? ACTIVE_LSTM_PATH
    : getLstmVersionLocalPath(String(params.modelVersion || ""));

  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const storageMode = await getModelArtifactStorageMode();
  if (storageMode !== "r2") {
    // LSTM is optional — return null instead of throwing
    return null;
  }

  const candidateKeys = isActiveSelection
    ? [
        buildLstmActiveKey(),
        ...(params.modelVersion ? [buildLstmVersionKey(params.modelVersion)] : []),
      ]
    : [buildLstmVersionKey(String(params.modelVersion || ""))];

  for (const key of candidateKeys) {
    try {
      await downloadR2ObjectToFile(key, localPath);
      return localPath;
    } catch {
      // try next candidate
    }
  }

  // LSTM is optional — return null if not found in R2
  return null;
}