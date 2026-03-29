import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { execFile, spawn } from "child_process";
import { randomUUID } from "crypto";
import type { Stats } from "node:fs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage, type AnalysisMetadataInput } from "./storage";
import { processAnalysis, seedUploadPipelineTiming } from "./analysis-engine";
import { requireAuth } from "./auth";
import { db } from "./db";
import {
  sports,
  sportMovements,
  sportCategoryMetricRanges,
  users,
  analysisFeedback,
  analysisShotAnnotations,
  analysisShotDiscrepancies,
  appSettings,
  modelTrainingJobs,
  modelTrainingDatasets,
  modelTrainingState,
  analyses,
  analysisRecalculationRunItems,
  analysisRecalculationRuns,
  metrics,
  coachingInsights,
} from "@swing-ai/shared/schema";
import { eq, asc, and, desc, inArray, sql } from "drizzle-orm";
import {
  getConfigKey,
  getSportConfig,
  getAllConfigs,
  type MetricDefinition,
  type SportCategoryConfig,
} from "@swing-ai/shared/sport-configs";
import {
  normalizeMetricRangeToTenScale,
  normalizeMetricUnit,
  normalizeMetricValueToTenScale,
} from "@swing-ai/shared/metric-scale";
import { attachPipelineTiming, extractPipelineTiming } from "@swing-ai/shared/pipeline-timing";
import {
  getEvaluationDatasetVideoMap,
  getModelRegistryOverview,
  initializeModelRegistryCache,
  ensureDraftModelVersion,
  incrementModelVersion,
  isMovementMatch,
  listModelRegistryVersions,
  readEvaluationDatasetManifest,
  readModelRegistryConfig,
  syncVideoForModelTuning,
  validateEvaluationDatasetManifest,
  writeModelRegistryConfig,
} from "./model-registry";
import { normalizeRuntimeScoreToHundred } from "./score-scale";
import { persistedScoreToApiHundred } from "./score-scale";
import { normalizeTacticalScoresToApi100, readTacticalScoreValue } from "./tactical-scores";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import {
  copyStoredMediaToPath,
  deleteStoredMedia,
  ensureVideoStorageModeSetting,
  getStoredMediaLocalPath,
  getVideoStorageMode,
  isStoredMediaLocallyAccessible,
  normalizeStoredVideoPath,
  resolveMediaUrl,
  setVideoStorageMode,
  storeVideoBuffer,
  withLocalMediaFile,
} from "./media-storage";
import { PROJECT_ROOT, resolveProjectPath } from "./env";
import { isVideoValidationMode, type VideoValidationMode } from "@swing-ai/shared/video-validation";
import { isPoseLandmarkerModel } from "@swing-ai/shared/pose-landmarker";
import {
  getEnabledPrimarySport,
  getSportById,
  isPrimaryEnabledSportName,
  isSportEnabledRecord,
  listSports,
  mapSportForApi,
} from "./sport-availability";
import { getPoseLandmarkerModel, getPoseLandmarkerPythonEnv, setPoseLandmarkerModel } from "./pose-landmarker-settings";
import { exportTennisTrainingDatasetSnapshot } from "./tennis-training-storage";
import {
  getDriveMovementClassificationModelPythonEnv,
  getDriveMovementClassificationModelPythonEnvForSelection,
  getDriveMovementClassificationModelSettings,
  setDriveMovementClassificationModelOptions,
  setDriveMovementClassificationModelSelection,
} from "./classification-model-settings";
import {
  ensureLocalClassificationModelArtifact,
  publishClassificationModelArtifacts,
} from "./model-artifact-storage";

const uploadDir = resolveProjectPath("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function normalizeModelVersionToken(value: unknown): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith("v") ? trimmed.slice(1) : trimmed;
}

const uploadToFilesystem = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mp4";
      cb(null, `${randomUUID().toUpperCase()}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

async function runVideoUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const mode = await getVideoStorageMode();
    const middleware = mode === "r2" ? uploadToMemory.single("video") : uploadToFilesystem.single("video");
    middleware(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File too large. Maximum 100MB." });
        }
        return res.status(400).json({ error: err.message || "Invalid file upload" });
      }
      return next();
    });
  } catch (error) {
    return next(error);
  }
}

function resolvePythonExecutable(): string {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs.existsSync(envExecutable)) {
    return envExecutable;
  }

  const localCandidates = [
    resolveProjectPath(".venv", "bin", "python3"),
    resolveProjectPath(".venv", "bin", "python"),
  ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

function runPythonDiagnostics(
  videoPath: string,
  sportName: string,
  movementName: string,
  dominantProfile?: string | null,
  classificationModelSelection?: { selectedModelKey: string; modelVersion?: string | null } | null,
): Promise<any> {
  return (async () => {
    const pythonExecutable = resolvePythonExecutable();
    const [poseLandmarkerEnv, classificationModelEnv] = await Promise.all([
      getPoseLandmarkerPythonEnv(),
      classificationModelSelection
        ? getDriveMovementClassificationModelPythonEnvForSelection(classificationModelSelection)
        : getDriveMovementClassificationModelPythonEnv(),
    ]);

    const args = [
      "-m",
      "python_analysis.run_diagnostics",
      videoPath,
      "--sport",
      sportName.toLowerCase(),
      "--movement",
      movementName.toLowerCase().replace(/\s+/g, "-"),
    ];

    const dominant = String(dominantProfile || "").trim().toLowerCase();
    if (dominant === "right" || dominant === "left") {
      args.push("--dominant-profile", dominant);
    }

    return new Promise((resolve, reject) => {
      execFile(
        pythonExecutable,
        args,
        {
          cwd: PROJECT_ROOT,
          env: { ...process.env, ...poseLandmarkerEnv, ...classificationModelEnv },
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            if (stderr) console.error("Python diagnostics stderr:", stderr);
            reject(new Error(`Python diagnostics failed: ${error.message}`));
            return;
          }

          try {
            const result = JSON.parse(stdout.trim());
            if (result?.error) {
              reject(new Error(result.error));
              return;
            }
            resolve(result);
          } catch {
            if (stderr) console.error("Python diagnostics stderr:", stderr);
            reject(new Error("Failed to parse diagnostics results"));
          }
        },
      );
    });
  })();
}

type TennisTrainingMetadata = {
  modelVersion?: string;
  trainedAt?: string;
  datasetPath?: string;
  trainRows?: number;
  testRows?: number;
  versionDescription?: string;
  savedAt?: string;
};

type TennisTrainingHistoryEntry = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  requestedByUserId?: string | null;
  eligibleAnalysisCount: number;
  eligibleShotCount: number;
  exportRows?: number | null;
  trainRows?: number | null;
  testRows?: number | null;
  macroF1?: number | null;
  error?: string | null;
  savedModelVersion?: string | null;
  savedAt?: string | null;
  versionDescription?: string | null;
};

type TennisTrainingState = {
  currentJobId: string | null;
  history: TennisTrainingHistoryEntry[];
};

type TennisDatasetInsightDistribution = {
  label: string;
  count: number;
  pct: number;
};

type TennisDatasetInsightSessionDistribution = {
  label: "practice" | "match-play";
  count: number;
  pct: number;
};

const TENNIS_DATASET_INSIGHT_LABELS = ["forehand", "backhand", "serve", "volley"] as const;

const TENNIS_MOVEMENT_MODEL_FAMILY = "movement-classifier";
const TENNIS_MODEL_VERSION_ARCHIVE_DIR = resolveProjectPath("models", "versions");
const MAX_TENNIS_TRAINING_HISTORY = 20;

let activeTennisTrainingJobId: string | null = null;
let activeTennisTrainingPromise: Promise<void> | null = null;

function runNodeJsonScript(scriptRelativePath: string, env?: NodeJS.ProcessEnv): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = resolveProjectPath(scriptRelativePath);
    execFile(
      process.execPath,
      [scriptPath],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...env },
        timeout: 600000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error(`Node script stderr (${scriptRelativePath}):`, stderr);
          reject(new Error(`Failed to run ${scriptRelativePath}: ${error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(String(stdout || "").trim()));
        } catch {
          if (stderr) console.error(`Node script stderr (${scriptRelativePath}):`, stderr);
          reject(new Error(`Failed to parse ${scriptRelativePath} output`));
        }
      },
    );
  });
}

function runPythonJsonModule(moduleName: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    execFile(
      pythonExecutable,
      ["-m", moduleName, ...args],
      {
        cwd: PROJECT_ROOT,
        env: process.env,
        timeout: 900000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error(`Python module stderr (${moduleName}):`, stderr);
          reject(new Error(`Failed to run ${moduleName}: ${error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(String(stdout || "").trim()));
        } catch {
          if (stderr) console.error(`Python module stderr (${moduleName}):`, stderr);
          reject(new Error(`Failed to parse ${moduleName} output`));
        }
      },
    );
  });
}

function runPythonJsonModuleWithInput(
  moduleName: string,
  args: string[],
  input: string,
  env?: NodeJS.ProcessEnv,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    const child = spawn(pythonExecutable, ["-m", moduleName, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to run ${moduleName}: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        if (stderr) console.error(`Python module stderr (${moduleName}):`, stderr);
        reject(new Error(`Failed to run ${moduleName}: exit code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(String(stdout || "").trim()));
      } catch {
        if (stderr) console.error(`Python module stderr (${moduleName}):`, stderr);
        reject(new Error(`Failed to parse ${moduleName} output`));
      }
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | null> {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function statIfExists(filePath: string): Promise<Stats | null> {
  try {
    return await fs.promises.stat(filePath);
  } catch {
    return null;
  }
}

function normalizeTennisTrainingHistoryEntry(value: unknown): TennisTrainingHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const jobId = String(row.jobId || "").trim();
  const status = String(row.status || "").trim();
  const requestedAt = String(row.requestedAt || "").trim();
  if (!jobId || !requestedAt) return null;
  if (status !== "queued" && status !== "running" && status !== "succeeded" && status !== "failed") {
    return null;
  }

  const numOrNull = (input: unknown): number | null => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    jobId,
    status,
    requestedAt,
    startedAt: row.startedAt ? String(row.startedAt) : null,
    completedAt: row.completedAt ? String(row.completedAt) : null,
    requestedByUserId: row.requestedByUserId ? String(row.requestedByUserId) : null,
    eligibleAnalysisCount: Number(row.eligibleAnalysisCount || 0),
    eligibleShotCount: Number(row.eligibleShotCount || 0),
    exportRows: numOrNull(row.exportRows),
    trainRows: numOrNull(row.trainRows),
    testRows: numOrNull(row.testRows),
    macroF1: numOrNull(row.macroF1),
    error: row.error ? String(row.error) : null,
    savedModelVersion: row.savedModelVersion ? String(row.savedModelVersion) : null,
    savedAt: row.savedAt ? String(row.savedAt) : null,
    versionDescription: row.versionDescription ? String(row.versionDescription) : null,
  };
}

function buildTrainingScope() {
  return {
    sportName: "tennis",
    modelFamily: TENNIS_MOVEMENT_MODEL_FAMILY,
  } as const;
}

function mapTrainingJobRowToHistoryEntry(row: typeof modelTrainingJobs.$inferSelect): TennisTrainingHistoryEntry {
  const normalized = normalizeTennisTrainingHistoryEntry({
    jobId: row.jobId,
    status: row.status,
    requestedAt: row.requestedAt?.toISOString(),
    startedAt: row.startedAt?.toISOString() || null,
    completedAt: row.completedAt?.toISOString() || null,
    requestedByUserId: row.requestedByUserId || null,
    eligibleAnalysisCount: row.eligibleAnalysisCount,
    eligibleShotCount: row.eligibleShotCount,
    exportRows: row.exportRows,
    trainRows: row.trainRows,
    testRows: row.testRows,
    macroF1: row.macroF1,
    error: row.error || null,
    savedModelVersion: row.savedModelVersion || null,
    savedAt: row.savedAt?.toISOString() || null,
    versionDescription: row.versionDescription || null,
  });
  if (!normalized) {
    throw new Error(`Invalid model training job row for ${row.jobId}`);
  }
  return normalized;
}

async function getModelTrainingScopeState() {
  const scope = buildTrainingScope();
  const [row] = await db
    .select()
    .from(modelTrainingState)
    .where(
      and(
        eq(modelTrainingState.sportName, scope.sportName),
        eq(modelTrainingState.modelFamily, scope.modelFamily),
      ),
    )
    .limit(1);
  return row || null;
}

async function setModelTrainingScopeCurrentJobId(
  currentJobId: string | null,
  actorUserId?: string | null,
): Promise<void> {
  const scope = buildTrainingScope();
  await db
    .insert(modelTrainingState)
    .values({
      ...scope,
      currentJobId,
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: [modelTrainingState.sportName, modelTrainingState.modelFamily],
      set: {
        currentJobId,
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });
}

async function listTrainingHistoryRows(limit = MAX_TENNIS_TRAINING_HISTORY) {
  const scope = buildTrainingScope();
  return db
    .select()
    .from(modelTrainingJobs)
    .where(
      and(
        eq(modelTrainingJobs.sportName, scope.sportName),
        eq(modelTrainingJobs.modelFamily, scope.modelFamily),
      ),
    )
    .orderBy(desc(modelTrainingJobs.requestedAt), desc(modelTrainingJobs.updatedAt))
    .limit(limit);
}

async function readTrainingState(): Promise<TennisTrainingState> {
  const [scopeState, historyRows] = await Promise.all([
    getModelTrainingScopeState(),
    listTrainingHistoryRows(),
  ]);
  const history = historyRows.map(mapTrainingJobRowToHistoryEntry);
  const fallbackCurrent = history.find((entry) => entry.status === "queued" || entry.status === "running") || null;
  const currentJobIdRaw = String(scopeState?.currentJobId || fallbackCurrent?.jobId || "").trim();
  const currentJobId = history.some((entry) => entry.jobId === currentJobIdRaw && (entry.status === "queued" || entry.status === "running"))
    ? currentJobIdRaw
    : null;
  const current = currentJobId
    ? history.find((entry) => entry.jobId === currentJobId) || null
    : null;

  if (current && (current.status === "queued" || current.status === "running") && activeTennisTrainingJobId !== current.jobId) {
    await updateModelTrainingJob(current.jobId, null, {
      status: "failed",
      completedAt: new Date(),
      error: "Training job was interrupted before completion.",
    });
    await setModelTrainingScopeCurrentJobId(null, null);
    const repairedHistoryRows = await listTrainingHistoryRows();
    return {
      currentJobId: null,
      history: repairedHistoryRows.map(mapTrainingJobRowToHistoryEntry),
    };
  }

  if (!scopeState?.currentJobId && currentJobId) {
    await setModelTrainingScopeCurrentJobId(currentJobId, null);
  }

  return { currentJobId, history };
}

function buildTennisModelArchivePaths(modelVersion: string) {
  const safeVersion = String(modelVersion || "").trim().replace(/[^0-9A-Za-z._-]+/g, "_");
  const normalizedVersion = safeVersion.toLowerCase().startsWith("v") ? safeVersion : `v${safeVersion}`;
  return {
    modelPath: path.join(TENNIS_MODEL_VERSION_ARCHIVE_DIR, `tennis_movement_classifier_${normalizedVersion}.joblib`),
  };
}

async function createModelTrainingJob(
  jobId: string,
  actorUserId: string,
  payload: {
    status: "queued" | "running" | "succeeded" | "failed";
    eligibleAnalysisCount: number;
    eligibleShotCount: number;
    requestedAt?: Date;
    startedAt?: Date | null;
    completedAt?: Date | null;
    requestedByUserId?: string | null;
  },
): Promise<void> {
  await db.insert(modelTrainingJobs).values({
    jobId,
    modelFamily: TENNIS_MOVEMENT_MODEL_FAMILY,
    sportName: "tennis",
    status: payload.status,
    eligibleAnalysisCount: payload.eligibleAnalysisCount,
    eligibleShotCount: payload.eligibleShotCount,
    requestedAt: payload.requestedAt || new Date(),
    startedAt: payload.startedAt || null,
    completedAt: payload.completedAt || null,
    requestedByUserId: payload.requestedByUserId || actorUserId,
    ...buildInsertAuditFields(actorUserId),
  });
}

async function updateModelTrainingJob(
  jobId: string,
  actorUserId: string | null | undefined,
  patch: Record<string, unknown>,
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...patch,
    ...buildUpdateAuditFields(actorUserId || null),
  };
  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) delete updates[key];
  });

  await db
    .update(modelTrainingJobs)
    .set(updates)
    .where(eq(modelTrainingJobs.jobId, jobId));
}

async function getLatestSuccessfulTrainingJob() {
  const [row] = await db
    .select()
    .from(modelTrainingJobs)
    .where(
      and(
        eq(modelTrainingJobs.sportName, "tennis"),
        eq(modelTrainingJobs.modelFamily, TENNIS_MOVEMENT_MODEL_FAMILY),
        eq(modelTrainingJobs.status, "succeeded"),
      ),
    )
    .orderBy(desc(modelTrainingJobs.completedAt), desc(modelTrainingJobs.updatedAt))
    .limit(1);
  return row || null;
}

async function getTennisTrainingStatus() {
  const modelPath = resolveProjectPath("models", "tennis_movement_classifier.joblib");
  const config = readModelRegistryConfig();
  const trainingState = await readTrainingState();

  const [countsResult, latestRun, modelStats] = await Promise.all([
    db.execute(sql`
      with latest_annotations as (
        select distinct on (ann.analysis_id)
          ann.analysis_id,
          ann.ordered_shot_labels
        from analysis_shot_annotations ann
        order by ann.analysis_id, ann.updated_at desc
      )
      select
        count(*)::int as eligible_analysis_count,
        coalesce(
          sum(
            case
              when jsonb_typeof(la.ordered_shot_labels) = 'array' then jsonb_array_length(la.ordered_shot_labels)
              else 0
            end
          ),
          0
        )::int as eligible_shot_count
      from analyses a
      inner join metrics m on m.analysis_id = a.id
      inner join latest_annotations la on la.analysis_id = a.id
      where a.status = 'completed'
        and m.ai_diagnostics is not null
        and lower(coalesce(m.config_key, '')) like 'tennis-%'
    `),
    getLatestSuccessfulTrainingJob(),
    statIfExists(modelPath),
  ]);

  const row = Array.isArray((countsResult as any).rows) ? (countsResult as any).rows[0] : null;
  const metadata = latestRun?.metadata && typeof latestRun.metadata === "object"
    ? latestRun.metadata as Record<string, unknown>
    : null;
  const report = latestRun?.report && typeof latestRun.report === "object"
    ? latestRun.report as { classificationReport?: Record<string, Record<string, number>> }
    : null;
  const macroF1Raw = report?.classificationReport?.["macro avg"]?.["f1-score"];
  const macroF1 = typeof macroF1Raw === "number" ? macroF1Raw : null;
  const latestTraining = latestRun && metadata
    ? {
        modelVersion: String(latestRun.savedModelVersion || metadata.modelVersion || config.activeModelVersion),
        trainedAt: String(metadata.trainedAt || latestRun.completedAt?.toISOString() || (modelStats?.mtime?.toISOString() || "")),
        trainRows: Number(latestRun.trainRows || metadata.trainRows || 0),
        testRows: Number(latestRun.testRows || metadata.testRows || 0),
        datasetPath: String(metadata.datasetPath || `database://tennis-training-datasets/${latestRun.datasetId || "latest"}`),
        macroF1,
      }
    : null;

  return {
    sport: "tennis" as const,
    eligibleAnalysisCount: Number(row?.eligible_analysis_count || 0),
    eligibleShotCount: Number(row?.eligible_shot_count || 0),
    trainedModelAvailable: Boolean(modelStats && latestRun),
    latestTraining,
    activeVersion: config.activeModelVersion,
    activeVersionDescription: config.modelVersionChangeDescription,
    draftVersion: incrementModelVersion(config.activeModelVersion),
    currentJob: trainingState.currentJobId
      ? trainingState.history.find((entry) => entry.jobId === trainingState.currentJobId) || null
      : null,
    history: trainingState.history,
  };
}

async function getTennisDatasetInsights(params?: {
  playerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const config = readModelRegistryConfig();
  const playerId = String(params?.playerId || "").trim() || null;
  let startDate = parseDateFilterBoundary(params?.startDate, "start");
  let endDate = parseDateFilterBoundary(params?.endDate, "end");
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    const swappedStart = endDate;
    endDate = startDate;
    startDate = swappedStart;
  }

  const datasetWhereClauses = [
    sql`a.status = 'completed'`,
    sql`m.ai_diagnostics is not null`,
    sql`lower(coalesce(m.config_key, '')) like 'tennis-%'`,
  ];
  if (playerId) {
    datasetWhereClauses.push(sql`a.user_id = ${playerId}`);
  }
  if (startDate) {
    datasetWhereClauses.push(sql`coalesce(a.captured_at, a.created_at) >= ${startDate.toISOString()}`);
  }
  if (endDate) {
    datasetWhereClauses.push(sql`coalesce(a.captured_at, a.created_at) <= ${endDate.toISOString()}`);
  }

  const [eligibleResult, activeRun, trendRuns] = await Promise.all([
    db.execute(sql`
      with latest_annotations as (
        select distinct on (ann.analysis_id)
          ann.analysis_id,
          ann.ordered_shot_labels
        from analysis_shot_annotations ann
        order by ann.analysis_id, ann.updated_at desc
      )
      select
        a.id as analysis_id,
        a.requested_session_type,
        a.video_filename,
        la.ordered_shot_labels
      from analyses a
      inner join metrics m on m.analysis_id = a.id
      inner join latest_annotations la on la.analysis_id = a.id
      where ${sql.join(datasetWhereClauses, sql` and `)}
      order by a.created_at desc
    `),
    db
      .select()
      .from(modelTrainingJobs)
      .where(
        and(
          eq(modelTrainingJobs.sportName, "tennis"),
          eq(modelTrainingJobs.modelFamily, TENNIS_MOVEMENT_MODEL_FAMILY),
          eq(modelTrainingJobs.status, "succeeded"),
          eq(modelTrainingJobs.savedModelVersion, config.activeModelVersion),
        ),
      )
      .orderBy(
        desc(modelTrainingJobs.savedAt),
        desc(modelTrainingJobs.completedAt),
        desc(modelTrainingJobs.updatedAt),
      )
      .limit(1)
      .then((rows) => rows[0] || null),
    db
      .select()
      .from(modelTrainingJobs)
      .where(
        and(
          eq(modelTrainingJobs.sportName, "tennis"),
          eq(modelTrainingJobs.modelFamily, TENNIS_MOVEMENT_MODEL_FAMILY),
          eq(modelTrainingJobs.status, "succeeded"),
          sql`${modelTrainingJobs.savedModelVersion} is not null`,
        ),
      )
      .orderBy(
        desc(modelTrainingJobs.savedAt),
        desc(modelTrainingJobs.completedAt),
        desc(modelTrainingJobs.updatedAt),
      )
      .limit(12),
  ]);

  const eligibleRows = Array.isArray((eligibleResult as any).rows) ? (eligibleResult as any).rows : [];
  const videoCounts = new Map<string, number>();
  const shotCounts = new Map<string, number>();
  const sessionCounts = new Map<"practice" | "match-play", number>();
  let eligibleShotCount = 0;

  for (const row of eligibleRows) {
    const rawLabels = Array.isArray(row.ordered_shot_labels) ? row.ordered_shot_labels : [];
    const normalizedLabels = rawLabels
      .map((value: unknown) => normalizeShotLabel(value))
      .filter((value: string) => TENNIS_DATASET_INSIGHT_LABELS.includes(value as typeof TENNIS_DATASET_INSIGHT_LABELS[number]));

    for (const label of normalizedLabels) {
      shotCounts.set(label, Number(shotCounts.get(label) || 0) + 1);
    }
    eligibleShotCount += normalizedLabels.length;

    const primaryLabel = getPrimaryInsightLabel(normalizedLabels);
    if (primaryLabel !== "unknown") {
      videoCounts.set(primaryLabel, Number(videoCounts.get(primaryLabel) || 0) + 1);
    }

    const sessionType = normalizeTennisSessionType(row.requested_session_type);
    sessionCounts.set(sessionType, Number(sessionCounts.get(sessionType) || 0) + 1);
  }

  const currentDataset = {
    eligibleVideoCount: eligibleRows.length,
    eligibleShotCount,
    videoDistribution: buildInsightDistribution(videoCounts, eligibleRows.length, TENNIS_DATASET_INSIGHT_LABELS),
    shotDistribution: buildInsightDistribution(shotCounts, eligibleShotCount, TENNIS_DATASET_INSIGHT_LABELS),
    sessionTypeDistribution: (["practice", "match-play"] as const).map((label) => ({
      label,
      count: Number(sessionCounts.get(label) || 0),
      pct: toFixedPercent(Number(sessionCounts.get(label) || 0), eligibleRows.length),
    })),
  };

  let activeModel: {
    modelVersion: string;
    trainedAt: string;
    trainRows: number;
    testRows: number;
    datasetAnalysisCount: number;
    datasetShotCount: number;
    macroF1: number | null;
    accuracy: number | null;
    perLabel: Array<{
      label: string;
      precision: number | null;
      recall: number | null;
      f1: number | null;
      support: number;
    }>;
    confusionMatrix: {
      labels: string[];
      rows: Array<{
        actual: string;
        counts: Array<{
          predicted: string;
          count: number;
          pct: number;
        }>;
      }>;
    };
  } | null = null;

  if (activeRun) {
    const report = activeRun.report && typeof activeRun.report === "object"
      ? activeRun.report as Record<string, unknown>
      : {};
    const classificationReport = report.classificationReport && typeof report.classificationReport === "object"
      ? report.classificationReport as Record<string, Record<string, unknown> | unknown>
      : {};
    const rawLabels = Array.isArray(report.labels)
      ? (report.labels as unknown[]).map((item) => normalizeShotLabel(item))
      : [];
    const labelIndex = new Map<string, number>();
    rawLabels.forEach((label, index) => labelIndex.set(label, index));
    const matrix = Array.isArray(report.confusionMatrix)
      ? report.confusionMatrix as unknown[]
      : [];
    const accuracyFromReport = numberOrNull(classificationReport.accuracy);
    const dataset = activeRun.datasetId
      ? await db
          .select()
          .from(modelTrainingDatasets)
          .where(eq(modelTrainingDatasets.id, activeRun.datasetId))
          .limit(1)
          .then((rows) => rows[0] || null)
      : null;

    const perLabel = TENNIS_DATASET_INSIGHT_LABELS.map((label) => {
      const metricsForLabel = classificationReport[label] && typeof classificationReport[label] === "object"
        ? classificationReport[label] as Record<string, unknown>
        : {};
      const rowIndex = labelIndex.get(label);
      const rowValues = rowIndex != null && Array.isArray(matrix[rowIndex])
        ? matrix[rowIndex] as unknown[]
        : [];
      const supportFromMatrix = rowValues.reduce<number>((sum, value) => sum + Number(value || 0), 0);
      return {
        label,
        precision: numberOrNull(metricsForLabel.precision),
        recall: numberOrNull(metricsForLabel.recall),
        f1: numberOrNull(metricsForLabel["f1-score"]),
        support: Number(numberOrNull(metricsForLabel.support) ?? supportFromMatrix ?? 0),
      };
    });

    const confusionLabels = [...TENNIS_DATASET_INSIGHT_LABELS];
    const confusionRows = confusionLabels.map((actual) => {
      const actualIndex = labelIndex.get(actual);
      const actualRow = actualIndex != null && Array.isArray(matrix[actualIndex])
        ? matrix[actualIndex] as unknown[]
        : [];
      const rowTotal = confusionLabels.reduce((sum, predicted) => {
        const predictedIndex = labelIndex.get(predicted);
        return sum + Number(predictedIndex != null ? actualRow[predictedIndex] || 0 : 0);
      }, 0);
      return {
        actual,
        counts: confusionLabels.map((predicted) => {
          const predictedIndex = labelIndex.get(predicted);
          const count = Number(predictedIndex != null ? actualRow[predictedIndex] || 0 : 0);
          return {
            predicted,
            count,
            pct: toFixedPercent(count, rowTotal),
          };
        }),
      };
    });

    const matrixTotal = confusionRows.reduce(
      (total, row) => total + row.counts.reduce((sum, cell) => sum + cell.count, 0),
      0,
    );
    const matrixCorrect = confusionRows.reduce(
      (total, row) => total + (row.counts.find((cell) => cell.predicted === row.actual)?.count || 0),
      0,
    );

    activeModel = {
      modelVersion: String(activeRun.savedModelVersion || config.activeModelVersion),
      trainedAt: String(
        activeRun.savedAt?.toISOString()
          || activeRun.completedAt?.toISOString()
          || activeRun.requestedAt.toISOString(),
      ),
      trainRows: Number(activeRun.trainRows || 0),
      testRows: Number(activeRun.testRows || 0),
      datasetAnalysisCount: Number(dataset?.analysisCount || 0),
      datasetShotCount: Number(dataset?.rowCount || 0),
      macroF1: numberOrNull(activeRun.macroF1),
      accuracy: accuracyFromReport ?? (matrixTotal > 0 ? Number((matrixCorrect / matrixTotal).toFixed(4)) : null),
      perLabel,
      confusionMatrix: {
        labels: confusionLabels,
        rows: confusionRows,
      },
    };
  }

  const versionsByNumber = new Map(
    listModelRegistryVersions().map((version) => [version.modelVersion, version]),
  );
  const modelTrend = trendRuns
    .slice()
    .reverse()
    .map((run) => {
      const runReport = run.report && typeof run.report === "object"
        ? run.report as Record<string, unknown>
        : {};
      const trendClassificationReport = runReport.classificationReport && typeof runReport.classificationReport === "object"
        ? runReport.classificationReport as Record<string, unknown>
        : {};
      const versionMeta = versionsByNumber.get(String(run.savedModelVersion || ""));
      return {
        modelVersion: String(run.savedModelVersion || run.jobId),
        trainedAt: String(run.completedAt?.toISOString() || run.requestedAt.toISOString()),
        savedAt: run.savedAt?.toISOString() || null,
        macroF1: numberOrNull(run.macroF1),
        accuracy: numberOrNull(trendClassificationReport.accuracy),
        trainRows: Number(run.trainRows || 0),
        testRows: Number(run.testRows || 0),
        isActiveModelVersion: versionMeta?.status === "active",
        versionStatus: versionMeta?.status || "archived",
        versionDescription: versionMeta?.description || String(run.versionDescription || ""),
      };
    });

  return {
    sport: "tennis" as const,
    currentVersion: config.activeModelVersion,
    currentVersionDescription: config.modelVersionChangeDescription,
    filters: {
      playerId,
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null,
    },
    currentDataset,
    activeModel,
    modelTrend,
    suggestions: buildTennisDatasetInsightSuggestions({
      currentDataset,
      activeModel: activeModel
        ? {
            macroF1: activeModel.macroF1,
            perLabel: activeModel.perLabel.map((item) => ({ label: item.label, f1: item.f1 })),
          }
        : null,
    }),
  };
}

async function trainTennisMovementModel(jobId: string, actorUserId: string) {
  const exportSummary = await exportTennisTrainingDatasetSnapshot({
    actorUserId,
    datasetName: `tennis-training-${jobId}`,
    notes: `Generated for job ${jobId}`,
  });
  const trainingSummary = await runPythonJsonModuleWithInput(
    "python_analysis.train_tennis_movement_model",
    ["--dataset-json-stdin"],
    JSON.stringify({
      datasetId: exportSummary.datasetId,
      datasetPath: exportSummary.outputPath,
      rows: exportSummary.samples,
    }),
  );
  const status = await getTennisTrainingStatus();
  return {
    ...status,
    exportSummary: {
      outputPath: String(exportSummary?.outputPath || ""),
      rows: Number(exportSummary?.rows || 0),
      analyses: Number(exportSummary?.analyses || 0),
    },
    trainingSummary: {
      modelOut: String(trainingSummary?.modelOut || ""),
      trainRows: Number(trainingSummary?.trainRows || 0),
      testRows: Number(trainingSummary?.testRows || 0),
      labels:
        trainingSummary?.labels && typeof trainingSummary.labels === "object"
          ? trainingSummary.labels as Record<string, number>
          : {},
      macroF1: typeof trainingSummary?.macroF1 === "number" ? trainingSummary.macroF1 : null,
      metadata:
        trainingSummary?.metadata && typeof trainingSummary.metadata === "object"
          ? trainingSummary.metadata as Record<string, unknown>
          : {},
      report:
        trainingSummary?.report && typeof trainingSummary.report === "object"
          ? trainingSummary.report as Record<string, unknown>
          : {},
      datasetId: exportSummary.datasetId,
    },
  };
}

async function runTennisTrainingJobInBackground(jobId: string, actorUserId: string): Promise<void> {
  activeTennisTrainingJobId = jobId;
  await updateModelTrainingJob(jobId, actorUserId, {
    status: "running",
    startedAt: new Date(),
    error: null,
  });
  await setModelTrainingScopeCurrentJobId(jobId, actorUserId);

  try {
    const result = await trainTennisMovementModel(jobId, actorUserId);
    await updateModelTrainingJob(jobId, actorUserId, {
      status: "succeeded",
      completedAt: new Date(),
      datasetId: result.trainingSummary.datasetId,
      exportRows: result.exportSummary.rows,
      trainRows: result.trainingSummary.trainRows,
      testRows: result.trainingSummary.testRows,
      macroF1: typeof result.trainingSummary.macroF1 === "number" ? result.trainingSummary.macroF1 : null,
      metadata: result.trainingSummary.metadata,
      report: result.trainingSummary.report,
      modelOutputPath: result.trainingSummary.modelOut,
      error: null,
    });
    await setModelTrainingScopeCurrentJobId(null, actorUserId);
  } catch (error: any) {
    await updateModelTrainingJob(jobId, actorUserId, {
      status: "failed",
      completedAt: new Date(),
      error: error?.message || "Training failed",
    });
    await setModelTrainingScopeCurrentJobId(null, actorUserId);
  } finally {
    activeTennisTrainingJobId = null;
    activeTennisTrainingPromise = null;
  }
}

async function queueTennisTrainingJob(actorUserId: string) {
  const status = await getTennisTrainingStatus();
  if (status.currentJob && (status.currentJob.status === "queued" || status.currentJob.status === "running")) {
    throw new Error("A tennis training job is already running.");
  }
  if (status.eligibleAnalysisCount < 1 || status.eligibleShotCount < 20) {
    throw new Error("Need at least 1 annotated tennis analysis and 20 labeled shots before training.");
  }

  const jobId = randomUUID();
  const now = new Date().toISOString();
  await createModelTrainingJob(jobId, actorUserId, {
    status: "queued",
    eligibleAnalysisCount: status.eligibleAnalysisCount,
    eligibleShotCount: status.eligibleShotCount,
    requestedAt: new Date(now),
    requestedByUserId: actorUserId,
  });
  await setModelTrainingScopeCurrentJobId(jobId, actorUserId);

  activeTennisTrainingPromise = runTennisTrainingJobInBackground(jobId, actorUserId);
  return getTennisTrainingStatus();
}

async function saveCurrentTennisModelVersion(
  actorUserId: string,
  payload?: { modelVersion?: string; description?: string },
) {
  const modelPath = resolveProjectPath("models", "tennis_movement_classifier.joblib");
  const latestRun = await getLatestSuccessfulTrainingJob();
  const modelStats = await statIfExists(modelPath);

  if (!modelStats || !latestRun) {
    throw new Error("Train a tennis model before saving a version.");
  }

  const config = readModelRegistryConfig();
  const modelVersion = String(payload?.modelVersion || "").trim() || incrementModelVersion(config.activeModelVersion);
  const description = String(payload?.description || "").trim() || `Tennis classifier ${modelVersion}`;
  const archivePaths = buildTennisModelArchivePaths(modelVersion);

  const [existingVersion] = await db
    .select()
    .from(modelTrainingJobs)
    .where(
      and(
        eq(modelTrainingJobs.sportName, "tennis"),
        eq(modelTrainingJobs.modelFamily, TENNIS_MOVEMENT_MODEL_FAMILY),
        eq(modelTrainingJobs.savedModelVersion, modelVersion),
      ),
    )
    .limit(1);
  if (existingVersion || fs.existsSync(archivePaths.modelPath)) {
    throw new Error(`Model version ${modelVersion} already exists. Choose a new version before saving.`);
  }

  await fs.promises.mkdir(TENNIS_MODEL_VERSION_ARCHIVE_DIR, { recursive: true });
  await fs.promises.copyFile(modelPath, archivePaths.modelPath);
  const artifactInfo = await publishClassificationModelArtifacts({
    modelVersion,
    activeModelPath: modelPath,
    versionModelPath: archivePaths.modelPath,
  });

  const nextMetadata = {
    ...(latestRun.metadata && typeof latestRun.metadata === "object" ? latestRun.metadata as Record<string, unknown> : {}),
    modelVersion,
    versionDescription: description,
    savedAt: new Date().toISOString(),
    modelArtifactPath: artifactInfo.primaryReference,
    modelArtifacts: {
      classification: {
        storageMode: artifactInfo.storageMode,
        localVersionPath: artifactInfo.localVersionPath,
        localActivePath: artifactInfo.localActivePath,
        ...(artifactInfo.versionR2Key ? { versionR2Key: artifactInfo.versionR2Key } : {}),
        ...(artifactInfo.versionR2Reference ? { versionR2Reference: artifactInfo.versionR2Reference } : {}),
        ...(artifactInfo.activeR2Key ? { activeR2Key: artifactInfo.activeR2Key } : {}),
        ...(artifactInfo.activeR2Reference ? { activeR2Reference: artifactInfo.activeR2Reference } : {}),
      },
    },
  };

  await updateModelTrainingJob(latestRun.jobId, actorUserId, {
    savedModelVersion: modelVersion,
    savedModelArtifactPath: artifactInfo.primaryReference,
    savedAt: new Date(),
    versionDescription: description,
    metadata: nextMetadata,
  });

  await writeModelRegistryConfig({
    activeModelVersion: modelVersion,
    modelVersionChangeDescription: description,
    evaluationDatasetManifestPath: "database://model-registry",
  }, actorUserId);

  return getTennisTrainingStatus();
}

async function resolveUserDominantProfile(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const [profile] = await db
    .select({ dominantProfile: users.dominantProfile })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return profile?.dominantProfile ?? null;
}

function parseNumberValue(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseUploadRecordedAt(value: unknown): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return parseDateValue(raw);
}

function parseFpsValue(value: unknown): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.includes("/")) {
    const [numRaw, denRaw] = raw.split("/");
    const num = Number(numRaw);
    const den = Number(denRaw);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return Number((num / den).toFixed(3));
    }
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : null;
}

function getTagValue(tags: Record<string, unknown>, keys: string[]): unknown {
  const lowered = new Map<string, unknown>();
  for (const [k, v] of Object.entries(tags || {})) {
    lowered.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    const hit = lowered.get(key.toLowerCase());
    if (hit != null && String(hit).trim() !== "") return hit;
  }
  return null;
}

function parseSignedCoordinate(value: unknown, positiveSuffix: string, negativeSuffix: string): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  const directional = raw.match(/^(-?\d+(?:\.\d+)?)\s*([NSEW])$/i);
  if (!directional) return null;
  const magnitude = Number(directional[1]);
  if (!Number.isFinite(magnitude)) return null;
  const direction = directional[2].toUpperCase();
  if (direction === positiveSuffix) return Math.abs(magnitude);
  if (direction === negativeSuffix) return -Math.abs(magnitude);
  return null;
}

function parseIso6709Location(value: unknown): { lat: number; lng: number; alt: number | null } | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?\/?$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  const alt = match[3] != null ? Number(match[3]) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    alt: alt != null && Number.isFinite(alt) ? alt : null,
  };
}

async function extractVideoMetadata(videoPath: string): Promise<AnalysisMetadataInput> {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        videoPath,
      ],
      {
        timeout: 20000,
        maxBuffer: 5 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          resolve({});
          return;
        }

        try {
          const parsed = JSON.parse(stdout || "{}");
          const format = parsed?.format || {};
          const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
          const videoStream = streams.find((stream: any) => stream?.codec_type === "video") || streams[0] || {};

          const formatTags = (format?.tags || {}) as Record<string, unknown>;
          const streamTags = (videoStream?.tags || {}) as Record<string, unknown>;
          const mergedTags = {
            ...formatTags,
            ...streamTags,
          } as Record<string, unknown>;

          const capturedAt = parseDateValue(
            getTagValue(mergedTags, ["creation_time", "com.apple.quicktime.creationdate"]),
          );

          const sourceAppRaw = getTagValue(mergedTags, [
            "com.apple.quicktime.software",
            "software",
            "encoder",
          ]);

          const durationSec = parseNumberValue(format?.duration ?? videoStream?.duration);
          const fps = parseFpsValue(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate);
          const width = parseNumberValue(videoStream?.width);
          const height = parseNumberValue(videoStream?.height);
          const rotationFromTag = parseNumberValue(getTagValue(streamTags, ["rotate"]));
          const rotationFromSideData = parseNumberValue(
            Array.isArray(videoStream?.side_data_list)
              ? videoStream.side_data_list.find((entry: any) => entry?.rotation != null)?.rotation
              : null,
          );
          const rotation = rotationFromTag ?? rotationFromSideData;
          const bitrateKbpsRaw = parseNumberValue(format?.bit_rate ?? videoStream?.bit_rate);
          const bitrateKbps =
            bitrateKbpsRaw != null ? Number((bitrateKbpsRaw / 1000).toFixed(2)) : null;
          const fileSizeBytes = parseNumberValue(format?.size);
          const containerFormat = format?.format_name ? String(format.format_name) : null;
          const videoCodec = videoStream?.codec_name ? String(videoStream.codec_name) : null;

          let gpsLat: number | null = null;
          let gpsLng: number | null = null;
          let gpsAltM: number | null = null;
          let gpsSource: string | null = null;

          const isoLocation = getTagValue(mergedTags, [
            "com.apple.quicktime.location.ISO6709",
            "location",
          ]);
          const isoParsed = parseIso6709Location(isoLocation);
          if (isoParsed) {
            gpsLat = isoParsed.lat;
            gpsLng = isoParsed.lng;
            gpsAltM = isoParsed.alt;
            gpsSource = "iso6709";
          } else {
            const lat = parseSignedCoordinate(
              getTagValue(mergedTags, ["GPSLatitude", "latitude"]),
              "N",
              "S",
            );
            const lng = parseSignedCoordinate(
              getTagValue(mergedTags, ["GPSLongitude", "longitude"]),
              "E",
              "W",
            );
            if (lat != null && lng != null) {
              gpsLat = lat;
              gpsLng = lng;
              gpsAltM = parseNumberValue(getTagValue(mergedTags, ["GPSAltitude", "altitude"]));
              gpsSource = "exif";
            }
          }

          const gpsSpeedMps = parseNumberValue(
            getTagValue(mergedTags, ["GPSSpeed", "com.apple.quicktime.location.speed"]),
          );
          const gpsHeadingDeg = parseNumberValue(
            getTagValue(mergedTags, ["GPSImgDirection", "com.apple.quicktime.location.course"]),
          );
          const gpsAccuracyM = parseNumberValue(
            getTagValue(mergedTags, ["GPSHPositioningError", "com.apple.quicktime.location.accuracy.horizontal"]),
          );
          const gpsTimestamp = parseDateValue(
            getTagValue(mergedTags, ["GPSDateTime", "gps_datetime"]),
          );

          resolve({
            capturedAt,
            sourceApp: sourceAppRaw != null ? String(sourceAppRaw) : null,
            videoDurationSec: durationSec,
            videoFps: fps,
            videoWidth: width,
            videoHeight: height,
            videoRotation: rotation,
            videoCodec,
            videoBitrateKbps: bitrateKbps,
            fileSizeBytes,
            containerFormat,
            gpsLat,
            gpsLng,
            gpsAltM,
            gpsSpeedMps,
            gpsHeadingDeg,
            gpsAccuracyM,
            gpsTimestamp,
            gpsSource,
          });
        } catch {
          resolve({});
        }
      },
    );
  });
}

function normalizeShotLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeMovementToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeFilterToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function toFixedPercent(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

function normalizeTennisSessionType(value: unknown): "practice" | "match-play" {
  return normalizeFilterToken(value) === "match-play" ? "match-play" : "practice";
}

function buildInsightDistribution(
  counts: Map<string, number>,
  total: number,
  labels: readonly string[],
): TennisDatasetInsightDistribution[] {
  return labels.map((label) => ({
    label,
    count: Number(counts.get(label) || 0),
    pct: toFixedPercent(Number(counts.get(label) || 0), total),
  }));
}

function getPrimaryInsightLabel(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const rawLabel of labels) {
    const label = normalizeShotLabel(rawLabel);
    if (!TENNIS_DATASET_INSIGHT_LABELS.includes(label as typeof TENNIS_DATASET_INSIGHT_LABELS[number])) {
      continue;
    }
    counts.set(label, Number(counts.get(label) || 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return TENNIS_DATASET_INSIGHT_LABELS.indexOf(left[0] as typeof TENNIS_DATASET_INSIGHT_LABELS[number])
      - TENNIS_DATASET_INSIGHT_LABELS.indexOf(right[0] as typeof TENNIS_DATASET_INSIGHT_LABELS[number]);
  });

  return sorted[0]?.[0] || "unknown";
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateFilterBoundary(value: unknown, boundary: "start" | "end"): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const normalized = boundary === "start"
      ? `${raw}T00:00:00.000Z`
      : `${raw}T23:59:59.999Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function buildTennisDatasetInsightSuggestions(payload: {
  currentDataset: {
    videoDistribution: TennisDatasetInsightDistribution[];
    shotDistribution: TennisDatasetInsightDistribution[];
    sessionTypeDistribution: TennisDatasetInsightSessionDistribution[];
  };
  activeModel: null | {
    macroF1: number | null;
    perLabel: Array<{ label: string; f1: number | null }>;
  };
}): string[] {
  const suggestions: string[] = [];
  const practiceShare = payload.currentDataset.sessionTypeDistribution.find((item) => item.label === "practice")?.pct || 0;
  const matchPlayShare = payload.currentDataset.sessionTypeDistribution.find((item) => item.label === "match-play")?.pct || 0;

  if (practiceShare >= 70) {
    suggestions.push("Practice-heavy set. Add more match-play videos.");
  } else if (matchPlayShare >= 70) {
    suggestions.push("Match-heavy set. Add more drill videos.");
  }

  const underrepresentedVideoLabels = payload.currentDataset.videoDistribution
    .filter((item) => item.pct > 0 && item.pct < 15)
    .map((item) => item.label);
  if (underrepresentedVideoLabels.length > 0) {
    suggestions.push(`Low video coverage: ${underrepresentedVideoLabels.join(", ")}.`);
  }

  const underrepresentedShotLabels = payload.currentDataset.shotDistribution
    .filter((item) => item.pct > 0 && item.pct < 10)
    .map((item) => item.label);
  if (underrepresentedShotLabels.length > 0) {
    suggestions.push(`Low shot balance: ${underrepresentedShotLabels.join(", ")}.`);
  }

  if (payload.activeModel?.macroF1 != null && payload.activeModel.macroF1 < 0.8) {
    suggestions.push("Macro F1 is below 80%. Rebalance and retrain.");
  }

  const weakestLabel = (payload.activeModel?.perLabel || [])
    .filter((item) => item.f1 != null)
    .sort((left, right) => Number(left.f1 || 0) - Number(right.f1 || 0))[0];
  if (weakestLabel?.f1 != null && weakestLabel.f1 < 0.7) {
    suggestions.push(`Weakest label: ${weakestLabel.label}. Add more examples.`);
  }

  if (suggestions.length === 0) {
    suggestions.push("Coverage looks healthy. Keep adding fresh videos.");
  }

  return suggestions.slice(0, 4);
}

function readSubScoreValue(scoreOutputs: unknown, key: string): number | null {
  if (!scoreOutputs || typeof scoreOutputs !== "object") return null;
  return readTacticalScoreValue(scoreOutputs as Record<string, unknown>, key);
}

function normalizeScoreRow<T extends { overallScore?: unknown; scoreOutputs?: unknown; subScores?: unknown }>(row: T): T {
  const source =
    row.scoreOutputs && typeof row.scoreOutputs === "object"
      ? row.scoreOutputs
      : null;
  return {
    ...row,
    overallScore: persistedScoreToApiHundred(row.overallScore),
    subScores: normalizeTacticalScoresToApi100(
      source as Record<string, unknown> | null | undefined,
    ),
  };
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

const SCALE10_METRIC_KEYS = new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency",
]);

function normalizeMetricValuesForApi(metricValuesRaw: unknown): Record<string, number> {
  const source =
    metricValuesRaw && typeof metricValuesRaw === "object"
      ? (metricValuesRaw as Record<string, unknown>)
      : {};

  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const normalized = SCALE10_METRIC_KEYS.has(key) && value > 10 ? value / 10 : value;
    out[key] = round1(normalized);
  }
  return out;
}

function formatMetricName(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getMovementLabel(row: {
  detectedMovement?: string | null;
  configKey?: string | null;
}): string {
  if (row.detectedMovement) return String(row.detectedMovement);
  const configKey = String(row.configKey || "").trim();
  if (!configKey) return "general";
  const parts = configKey.split("-").filter(Boolean);
  if (parts.length <= 1) return "general";
  return parts.slice(1).join("-");
}

function getDrillForMetric(metric: string): string {
  if (metric === "timing") return "3 x 15 contact-point timing reps";
  if (metric === "control") return "4 x 30s split-step + recovery";
  if (metric === "technique") return "3 x 12 movement-shape checkpoints";
  return "3 x 12 explosive shadow swings";
}

type ImprovedTennisStrokeType = "forehand" | "backhand" | "serve" | "volley";
type ImprovedTennisSessionType = "practice" | "match-play";

type ImprovedTennisScoreDetail = {
  key: string;
  label: string;
  score: number;
  explanation: string;
};

type ImprovedTennisStrokeMixEntry = {
  stroke: ImprovedTennisStrokeType;
  count: number;
  sharePct: number;
};

type ImprovedTennisReport = {
  sessionType: ImprovedTennisSessionType;
  stroke: ImprovedTennisStrokeType | "match-play";
  biomechanics: ImprovedTennisScoreDetail[];
  tactical: ImprovedTennisScoreDetail[];
  movement: ImprovedTennisScoreDetail[];
  strokeMix: ImprovedTennisStrokeMixEntry[];
  strengths: string[];
  improvementAreas: string[];
  coachingTips: string[];
  overallScore: number;
};

type SummarySectionScores = {
  technical: number | null;
  tactical: number | null;
  movement: number | null;
};

function improvedClamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function improvedNorm(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || max <= min) return 0.55;
  return improvedClamp((n - min) / (max - min), 0, 1);
}

function improvedInvNorm(value: unknown, min: number, max: number): number {
  return 1 - improvedNorm(value, min, max);
}

function improvedScore10(raw: number): number {
  return Math.round(improvedClamp(raw, 1, 10));
}

function improvedScoreFromUnit(unitScore: number): number {
  return improvedScore10(1 + unitScore * 9);
}

function improvedPickMetric(metricValues: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(metricValues?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeBalanceScoreForImprovedModel(value: number | null): number | null {
  if (!Number.isFinite(Number(value))) return null;
  const n = Number(value);
  // Backward/forward compatible: legacy rows may be 0-100, new rows are persisted as 0-10.
  return n <= 10 ? n * 10 : n;
}

function normalizeTenOrHundredScoreForImprovedModel(value: number | null): number | null {
  if (!Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return n <= 10 ? n * 10 : n;
}

function buildImprovedTacticalDetail(
  key: "power" | "control" | "timing" | "technique",
  scoreRaw: unknown,
): ImprovedTennisScoreDetail {
  const score = Number(scoreRaw);
  const normalized = Number.isFinite(score) ? Number(Math.max(1, Math.min(10, score)).toFixed(1)) : 5.5;

  if (key === "power") {
    return {
      key,
      label: "Power",
      score: normalized,
      explanation:
        normalized >= 8
          ? "Ball quality and body drive are creating strong pressure through the session."
          : normalized >= 6
            ? "Power is present, but cleaner force transfer would raise penetration."
            : "Power output fades too often; body drive and acceleration need work.",
    };
  }

  if (key === "control") {
    return {
      key,
      label: "Control",
      score: normalized,
      explanation:
        normalized >= 8
          ? "You are controlling ball shape and depth well under live-play variation."
          : normalized >= 6
            ? "Control is usable, but quality drops when tempo rises."
            : "Control is unstable and is leaking points through short or rushed execution.",
    };
  }

  if (key === "timing") {
    return {
      key,
      label: "Timing",
      score: normalized,
      explanation:
        normalized >= 8
          ? "Preparation and strike timing stay coordinated across the rally."
          : normalized >= 6
            ? "Timing is mostly solid, but setup arrives late on some shots."
            : "Late preparation is forcing rushed contact and weaker transitions.",
    };
  }

  return {
    key,
    label: "Technique",
    score: normalized,
    explanation:
      normalized >= 8
        ? "Your movement shapes and shot mechanics hold together well during play."
        : normalized >= 6
          ? "Technique remains serviceable, though shape breaks down under pressure."
          : "Mechanical shape is inconsistent and needs better repeatability in live points.",
  };
}

function buildImprovedStrokeMix(aiDiagnosticsRaw: unknown): ImprovedTennisStrokeMixEntry[] {
  const aiDiagnostics = aiDiagnosticsRaw && typeof aiDiagnosticsRaw === "object"
    ? (aiDiagnosticsRaw as Record<string, unknown>)
    : {};
  const countsRaw = aiDiagnostics.movementTypeCounts && typeof aiDiagnostics.movementTypeCounts === "object"
    ? (aiDiagnostics.movementTypeCounts as Record<string, unknown>)
    : {};

  const strokes: ImprovedTennisStrokeType[] = ["forehand", "backhand", "serve", "volley"];
  const rows = strokes
    .map((stroke) => ({
      stroke,
      count: Math.max(0, Math.trunc(Number(countsRaw[stroke] || 0))),
    }))
    .filter((item) => item.count > 0);

  const total = rows.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return [];

  return rows
    .map((item) => ({
      stroke: item.stroke,
      count: item.count,
      sharePct: Number(((item.count / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildImprovedTennisReportFromMetrics(
  requestedSessionType: unknown,
  configKey: unknown,
  detectedMovement: unknown,
  metricValuesRaw: unknown,
  tacticalComponentsRaw?: unknown,
  overallScoreRaw?: unknown,
  aiDiagnosticsRaw?: unknown,
): ImprovedTennisReport {
  const metricValues =
    metricValuesRaw && typeof metricValuesRaw === "object"
      ? (metricValuesRaw as Record<string, unknown>)
      : {};
  const tacticalComponents =
    tacticalComponentsRaw && typeof tacticalComponentsRaw === "object"
      ? (tacticalComponentsRaw as Record<string, unknown>)
      : {};

  const normalizedSessionType = String(requestedSessionType || "").trim().toLowerCase();
  const normalizedConfigKey = String(configKey || "").trim().toLowerCase();
  const sessionType: ImprovedTennisSessionType =
    normalizedSessionType === "match-play" || normalizedConfigKey === "tennis-game"
      ? "match-play"
      : "practice";

  const detected = String(detectedMovement || "").toLowerCase().trim();
  const stroke: ImprovedTennisStrokeType =
    detected === "backhand" || detected === "serve" || detected === "volley"
      ? (detected as ImprovedTennisStrokeType)
      : "forehand";

  const stanceAngle = improvedPickMetric(metricValues, ["stanceAngle", "stance_angle"]);
  const hipRotationSpeed = improvedPickMetric(metricValues, ["hipRotationSpeed", "hip_rotation_speed", "hipRotation"]);
  const shoulderRotationSpeed = improvedPickMetric(metricValues, ["shoulderRotationSpeed", "shoulder_rotation_speed", "shoulderRotation"]);
  const kneeBendAngle = improvedPickMetric(metricValues, ["kneeBendAngle", "knee_bend_angle"]);
  const racketLagAngle = improvedPickMetric(metricValues, ["racketLagAngle", "racket_lag_angle"]);
  const contactDistance = improvedPickMetric(metricValues, ["contactDistance", "contact_distance"]);
  const contactHeight = improvedPickMetric(metricValues, ["contactHeight", "contact_height"]);
  const swingPathAngle = improvedPickMetric(metricValues, ["swingPathAngle", "swing_path_angle", "trajectoryArc"]);
  const balanceScore = improvedPickMetric(metricValues, ["balanceScore", "balance_score"]);
  const balanceScoreForModel = normalizeBalanceScoreForImprovedModel(balanceScore);
  const shotConsistency = normalizeTenOrHundredScoreForImprovedModel(
    improvedPickMetric(metricValues, ["shotConsistency", "shot_consistency"]),
  );
  const rhythmConsistency = normalizeTenOrHundredScoreForImprovedModel(
    improvedPickMetric(metricValues, ["rhythmConsistency", "rhythm_consistency"]),
  );
  const courtCoverage = improvedPickMetric(metricValues, ["courtCoverage", "court_coverage"]);
  const recoverySpeed = improvedPickMetric(metricValues, ["recoverySpeed", "recovery_speed", "recoveryTime"]);
  const shotVariety = improvedPickMetric(metricValues, ["shotVariety", "shot_variety"]);
  const rallyLength = improvedPickMetric(metricValues, ["rallyLength", "rally_length"]);
  const splitStepTime = improvedPickMetric(metricValues, ["splitStepTime", "splitStepTiming", "split_step_time"]);
  const reactionTime = improvedPickMetric(metricValues, ["reactionTime", "reactionSpeed", "reaction_time"]);
  const recoveryTime = improvedPickMetric(metricValues, ["recoveryTime", "recoverySpeed", "recovery_time"]);
  const ballSpeed = improvedPickMetric(metricValues, ["ballSpeed", "avgBallSpeed", "ball_speed"]);

  if (sessionType === "match-play") {
    const balanceUnderLoad = improvedScoreFromUnit(
      0.5 * improvedNorm(balanceScoreForModel, 55, 98)
      + 0.3 * improvedNorm(courtCoverage, 30, 98)
      + 0.2 * improvedNorm(recoverySpeed, 1.5, 6.0),
    );
    const contactQuality = improvedScoreFromUnit(
      0.45 * improvedNorm(shotConsistency, 55, 98)
      + 0.35 * improvedNorm(ballSpeed, 40, 100)
      + 0.2 * improvedNorm(rhythmConsistency, 50, 95),
    );
    const strokeShape = improvedScoreFromUnit(
      0.55 * improvedNorm(rhythmConsistency, 50, 95)
      + 0.45 * improvedNorm(shotVariety, 30, 95),
    );
    const forceTransfer = improvedScoreFromUnit(
      0.35 * improvedNorm(hipRotationSpeed, 250, 1100)
      + 0.25 * improvedNorm(shoulderRotationSpeed, 300, 1200)
      + 0.2 * improvedNorm(ballSpeed, 40, 100)
      + 0.2 * improvedNorm(balanceScoreForModel, 55, 98),
    );

    const biomechanics: ImprovedTennisScoreDetail[] = [
      {
        key: "balance-load",
        label: "Balance Under Load",
        score: balanceUnderLoad,
        explanation:
          balanceUnderLoad >= 8
            ? "You are staying organized and stable while moving through live-play demands."
            : balanceUnderLoad >= 6
              ? "Balance holds up reasonably well, but body control drops at higher tempo."
              : "Stability under live pressure is inconsistent and is affecting shot quality.",
      },
      {
        key: "contact-quality",
        label: "Contact Quality",
        score: contactQuality,
        explanation:
          contactQuality >= 8
            ? "Contact quality is repeatable across rallies, giving you cleaner ball outcomes."
            : contactQuality >= 6
              ? "Contact quality is workable, though it dips during faster exchanges."
              : "Inconsistent contact quality is limiting depth, pace, and repeatability.",
      },
      {
        key: "stroke-shape",
        label: "Stroke Shape & Rhythm",
        score: strokeShape,
        explanation:
          strokeShape >= 8
            ? "Your shapes and rhythm remain composed across a varied shot mix."
            : strokeShape >= 6
              ? "Stroke shape is mostly stable, but rhythm breaks under rally stress."
              : "Stroke shape and rhythm drift too often during points.",
      },
      {
        key: "force-transfer",
        label: "Force Transfer",
        score: forceTransfer,
        explanation:
          forceTransfer >= 8
            ? "Body sequencing is turning movement into useful ball pressure consistently."
            : forceTransfer >= 6
              ? "Force transfer is present, but some shots still rely too much on the arm."
              : "Energy transfer is inefficient and is capping reliable match-play pressure.",
      },
    ];

    const tactical: ImprovedTennisScoreDetail[] = [
      buildImprovedTacticalDetail("power", tacticalComponents.power),
      buildImprovedTacticalDetail("control", tacticalComponents.control),
      buildImprovedTacticalDetail("timing", tacticalComponents.timing),
      buildImprovedTacticalDetail("technique", tacticalComponents.technique),
    ];

    const movement: ImprovedTennisScoreDetail[] = [
      {
        key: "ready-base",
        label: "Ready Base",
        score: improvedScoreFromUnit(
          0.5 * improvedNorm(balanceScoreForModel, 55, 98)
          + 0.5 * improvedNorm(rhythmConsistency, 50, 95),
        ),
        explanation: "How consistently you establish a usable base before the next ball.",
      },
      {
        key: "react-ball",
        label: "React To Ball",
        score: improvedScoreFromUnit(
          0.6 * improvedNorm(courtCoverage, 30, 98)
          + 0.4 * improvedNorm(recoverySpeed, 1.5, 6.0),
        ),
        explanation: "How quickly your movement patterns turn recognition into usable court position.",
      },
      {
        key: "recover-neutral",
        label: "Recover To Neutral",
        score: improvedScoreFromUnit(
          0.65 * improvedNorm(recoverySpeed, 1.5, 6.0)
          + 0.35 * improvedNorm(balanceScoreForModel, 55, 98),
        ),
        explanation: "How efficiently you reset after contact and prepare for the next ball.",
      },
      {
        key: "sustain-rally",
        label: "Sustain Rally",
        score: improvedScoreFromUnit(
          0.55 * improvedNorm(rallyLength, 3, 12)
          + 0.45 * improvedNorm(shotConsistency, 55, 98),
        ),
        explanation: "How well your movement and shot quality hold up across longer exchanges.",
      },
      {
        key: "cover-space",
        label: "Cover Space",
        score: improvedScoreFromUnit(
          0.7 * improvedNorm(courtCoverage, 30, 98)
          + 0.3 * improvedNorm(recoverySpeed, 1.5, 6.0),
        ),
        explanation: "How effectively you move into and out of the spaces the rally demands.",
      },
    ];

    const strokeMix = buildImprovedStrokeMix(aiDiagnosticsRaw);
    const allItems = [...biomechanics, ...tactical, ...movement].sort((a, b) => b.score - a.score);
    const strongest = allItems.slice(0, 3);
    const weakest = [...allItems].reverse().slice(0, 3);
    const storedOverallScore = Number(overallScoreRaw);
    const overallScore = Number.isFinite(storedOverallScore)
      ? Math.max(0, Math.min(100, Math.round(storedOverallScore)))
      : Math.round(
          improvedClamp(
            (
              biomechanics.reduce((sum, item) => sum + item.score, 0) / Math.max(biomechanics.length, 1) * 0.3
              + tactical.reduce((sum, item) => sum + item.score, 0) / Math.max(tactical.length, 1) * 0.4
              + movement.reduce((sum, item) => sum + item.score, 0) / Math.max(movement.length, 1) * 0.3
            ) * 10,
            0,
            100,
          ),
        );

    const coachingTips = [
      `${weakest[0]?.label || "Control"}: make this the first match-play training priority.`,
      `${weakest[1]?.label || "Recover To Neutral"}: improve this with live-ball repetition and short-interval work.`,
      strokeMix.length > 0
        ? `${strokeMix[0].stroke.charAt(0).toUpperCase()}${strokeMix[0].stroke.slice(1)} made up ${strokeMix[0].sharePct}% of the session. Train that pattern first, then stabilize the weakest secondary pattern.`
        : "Use live-ball sequences that challenge recovery, spacing, and shot selection under pressure.",
    ];

    return {
      sessionType,
      stroke: "match-play",
      biomechanics,
      tactical,
      movement,
      strokeMix,
      strengths: strongest.map((item) => `${item.label} is a match-play strength (${item.score}/10).`),
      improvementAreas: weakest.map((item) => `${item.label} is the next match-play improvement area (${item.score}/10).`),
      coachingTips,
      overallScore,
    };
  }

  const balance = improvedScoreFromUnit(
    0.8 * improvedNorm(balanceScoreForModel, 55, 98) + 0.2 * improvedInvNorm(reactionTime, 180, 480),
  );
  const inertia = improvedScoreFromUnit(
    0.6 * improvedNorm(stanceAngle, 15, 65) + 0.4 * improvedNorm(shoulderRotationSpeed, 300, 1100),
  );
  const momentum = improvedScoreFromUnit(
    0.45 * improvedNorm(hipRotationSpeed, 250, 1100)
      + 0.35 * improvedNorm(shoulderRotationSpeed, 300, 1200)
      + 0.2 * improvedNorm(ballSpeed, 35, 140),
  );
  const oppositeForce = improvedScoreFromUnit(
    0.4 * improvedNorm(kneeBendAngle, 25, 120)
      + 0.35 * improvedNorm(balanceScoreForModel, 55, 98)
      + 0.25 * improvedNorm(stanceAngle, 15, 65),
  );
  const elastic = improvedScoreFromUnit(
    0.6 * improvedNorm(racketLagAngle, 15, 75)
      + 0.2 * improvedNorm(kneeBendAngle, 25, 120)
      + 0.2 * improvedNorm(swingPathAngle, 5, 45),
  );
  const contact = improvedScoreFromUnit(
    0.45 * improvedNorm(contactDistance, 0.35, 1.15)
      + 0.35 * improvedNorm(contactHeight, 0.75, 2.9)
      + 0.2 * improvedInvNorm(reactionTime, 180, 480),
  );
  const follow = improvedScoreFromUnit(
    0.6 * improvedNorm(swingPathAngle, 8, 55) + 0.4 * improvedNorm(shoulderRotationSpeed, 300, 1200),
  );

  const ready = improvedScoreFromUnit(
    0.6 * improvedInvNorm(splitStepTime, 0.12, 0.45) + 0.4 * improvedNorm(balanceScoreForModel, 55, 98),
  );
  const read = improvedScoreFromUnit(
    0.55 * improvedInvNorm(reactionTime, 180, 480) + 0.45 * improvedInvNorm(splitStepTime, 0.12, 0.45),
  );
  const react = improvedScoreFromUnit(
    0.7 * improvedInvNorm(reactionTime, 170, 500) + 0.3 * improvedNorm(balanceScoreForModel, 55, 98),
  );
  const respond = improvedScoreFromUnit(
    0.45 * improvedNorm(ballSpeed, 35, 140)
      + 0.3 * improvedNorm(contactHeight, 0.75, 2.9)
      + 0.25 * improvedNorm(swingPathAngle, 8, 55),
  );
  const recover = improvedScoreFromUnit(
    0.65 * improvedInvNorm(recoveryTime, 0.6, 3.2) + 0.35 * improvedNorm(balanceScore, 55, 98),
  );

  const biomechanics: ImprovedTennisScoreDetail[] = [
    {
      key: "balance",
      label: "Balance",
      score: balance,
      explanation:
        balance >= 8
          ? "Stable base before, through, and after contact with minimal sway."
          : balance >= 6
            ? "Base is mostly stable; occasional drift appears under speed."
            : "Base stability drops through contact; posture control should improve.",
    },
    {
      key: "inertia",
      label: "Inertia / Stance Alignment",
      score: inertia,
      explanation:
        inertia >= 8
          ? "Stance and trunk alignment match shot direction well."
          : inertia >= 6
            ? "Stance shape is usable but alignment timing is occasionally late."
            : "Stance alignment is inconsistent and limits clean energy direction.",
    },
    {
      key: "oppositeForce",
      label: "Opposite Force",
      score: oppositeForce,
      explanation:
        oppositeForce >= 8
          ? "Bracing and ground-force transfer are strong, supporting stable acceleration."
          : oppositeForce >= 6
            ? "Force transfer is usable but can improve with stronger bracing and leg drive."
            : "Insufficient bracing and push-off reduce stable power transfer.",
    },
    {
      key: "momentum",
      label: "Momentum (Kinetic Chain)",
      score: momentum,
      explanation:
        momentum >= 8
          ? "Good legs-to-racket sequencing transfers energy efficiently."
          : momentum >= 6
            ? "Partial kinetic chain use; more lower-body drive would help."
            : "Energy transfer is arm-dominant and misses lower-body contribution.",
    },
    {
      key: "elastic",
      label: "Elastic Energy",
      score: elastic,
      explanation:
        elastic >= 8
          ? "Racket lag and stretch-shortening are creating strong acceleration."
          : elastic >= 6
            ? "Elastic load is present but could be timed and released better."
            : "Limited lag/load reduces free racket-head speed.",
    },
    {
      key: "contact",
      label: "Contact",
      score: contact,
      explanation:
        stroke === "serve"
          ? "Contact height supports serve geometry; timing consistency remains critical."
          : stroke === "volley"
            ? "Contact in front supports compact volley control."
            : "Contact distance from the body supports cleaner strike mechanics.",
    },
    {
      key: "follow",
      label: "Follow Through",
      score: follow,
      explanation:
        follow >= 8
          ? "Finish path is complete and supports control plus spin/drive intent."
          : follow >= 6
            ? "Follow-through is mostly complete with minor deceleration."
            : "Finish path cuts off early and limits control/consistency.",
    },
  ];

  const movement: ImprovedTennisScoreDetail[] = [
    {
      key: "ready",
      label: "Ready",
      score: ready,
      explanation:
        ready >= 8
          ? "Split-step timing, knee flex, and base setup prepare efficient lower-body movement."
          : ready >= 6
            ? "Lower-body prep is usable, but earlier split-step and stronger base loading are needed."
            : "Late split-step and shallow leg load reduce first-move quickness.",
    },
    {
      key: "read",
      label: "Read",
      score: read,
      explanation:
        read >= 8
          ? "Early read supports efficient footwork choices and balanced body positioning."
          : read >= 6
            ? "Read timing is acceptable, but feet can organize earlier into a stronger base."
            : "Late read forces rushed footwork and unstable lower-body positioning.",
    },
    {
      key: "react",
      label: "React",
      score: react,
      explanation:
        react >= 8
          ? "First step is explosive with clean lower-body direction control."
          : react >= 6
            ? "Initial push-off is functional but needs sharper leg drive under pressure."
            : "Slow or misdirected first step limits movement efficiency.",
    },
    {
      key: "respond",
      label: "Respond",
      score: respond,
      explanation:
        stroke === "serve"
          ? "Serve response reflects knee-drive timing, vertical push, and stable landing footwork."
          : stroke === "backhand"
            ? "Backhand response depends on base width, outside-leg drive, and balanced transfer through contact."
            : stroke === "volley"
              ? "Volley response relies on quick split-step, short adjustment steps, and body control through contact."
              : "Forehand response is driven by leg load, push-off timing, and clean foot positioning.",
    },
    {
      key: "recover",
      label: "Recover",
      score: recover,
      explanation:
        recover >= 8
          ? "Recovery steps are quick and balanced, restoring a strong lower-body base."
          : recover >= 6
            ? "Recovery is serviceable but needs faster feet to re-center and reload."
            : "Slow recovery footwork delays re-centering and next-shot readiness.",
    },
  ];

  const bioAvg = biomechanics.reduce((sum, item) => sum + item.score, 0) / Math.max(biomechanics.length, 1);
  const movAvg = movement.reduce((sum, item) => sum + item.score, 0) / Math.max(movement.length, 1);
  const overallScore = Math.round(improvedClamp((bioAvg * 0.6 + movAvg * 0.4) * 10, 0, 100));

  const strongest = [...biomechanics, ...movement].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakest = [...biomechanics, ...movement].sort((a, b) => a.score - b.score).slice(0, 3);

  const coachingTips = [
    `${weakest[0]?.label || "Ready"}: prioritize this phase with focused, short-interval drills.`,
    `${weakest[1]?.label || "Contact"}: reinforce this mechanic in slow-to-fast progression reps.`,
    stroke === "forehand"
      ? "Load on the outside leg earlier, then rotate hips before arm acceleration."
      : stroke === "backhand"
        ? "Initiate with shoulder turn and stabilize contact height through spacing."
        : stroke === "serve"
          ? "Increase knee load depth, then push up before full shoulder acceleration."
          : "Shorten backswing and keep contact in front for controlled volleys.",
  ];

  return {
    sessionType,
    stroke,
    biomechanics,
    tactical: [],
    movement,
    strokeMix: [],
    strengths: strongest.map((item) => `${item.label} is a strength (${item.score}/10).`),
    improvementAreas: weakest.map((item) => `${item.label} needs improvement (${item.score}/10).`),
    coachingTips,
    overallScore,
  };
}

function computeSummarySectionScores(
  row: {
    scoreOutputs?: unknown;
  },
): SummarySectionScores {
  const storedScoreOutputs =
    row.scoreOutputs && typeof row.scoreOutputs === "object"
      ? (row.scoreOutputs as Record<string, unknown>)
      : null;

  const parseStored = (key: "technical" | "tactical" | "movement"): number | null => {
    const section = storedScoreOutputs?.[key];
    const value = Number(
      section && typeof section === "object"
        ? (section as Record<string, unknown>).overall
        : section,
    );
    return Number.isFinite(value) ? value : null;
  };

  return {
    technical: parseStored("technical"),
    tactical: parseStored("tactical"),
    movement: parseStored("movement"),
  };
}

const VIDEO_VALIDATION_MODE_KEY = "videoValidationMode";
const ANALYSIS_FPS_MODE_KEY = "analysisFpsMode";

type AnalysisFpsMode = "3fps" | "6fps" | "12fps" | "15fps" | "24fps" | "30fps" | "full";
type AnalysisFpsStep = "step1" | "step2" | "step3";

type AnalysisFpsSettings = {
  lowImpactStep: AnalysisFpsStep;
  highImpactStep: AnalysisFpsStep;
  tennisAutoDetectUsesHighImpact: boolean;
  tennisMatchPlayUsesHighImpact: boolean;
};

function isAnalysisFpsMode(value: unknown): value is AnalysisFpsMode {
  return value === "3fps"
    || value === "6fps"
    || value === "12fps"
    || value === "15fps"
    || value === "24fps"
    || value === "30fps"
    || value === "full";
}

function isAnalysisFpsStep(value: unknown): value is AnalysisFpsStep {
  return value === "step1" || value === "step2" || value === "step3";
}

function coerceLowImpactStep(value: unknown): AnalysisFpsStep {
  if (isAnalysisFpsStep(value)) return value;
  if (isAnalysisFpsMode(value)) {
    if (value === "15fps") return "step2";
    if (value === "12fps" || value === "6fps" || value === "3fps") return "step3";
    return "step1";
  }
  return "step2";
}

function coerceHighImpactStep(value: unknown): AnalysisFpsStep {
  if (isAnalysisFpsStep(value)) return value;
  if (isAnalysisFpsMode(value)) {
    if (value === "15fps") return "step2";
    if (value === "12fps" || value === "6fps" || value === "3fps") return "step3";
    return "step1";
  }
  return "step1";
}

type SkeletonLandmark = {
  id: number;
  x: number;
  y: number;
  z: number;
  visibility: number;
};

type SkeletonFrame = {
  frame_number: number;
  timestamp: number;
  landmarks: SkeletonLandmark[];
};

type SkeletonShot = {
  shot_id: number;
  frames: SkeletonFrame[];
};

type SkeletonDataset = {
  video_id: string;
  shots: SkeletonShot[];
};

type SkeletonShotIndex = {
  shot: SkeletonShot;
  frameNumbers: number[];
  framesByNumber: Map<number, SkeletonFrame>;
};

type SkeletonCacheEntry = {
  dataset: SkeletonDataset;
  shotsById: Map<number, SkeletonShotIndex>;
  cachedAt: number;
  expiresAt: number;
};

const SKELETON_CACHE_TTL_MS = 5 * 60 * 1000;
const SKELETON_CACHE_MAX_ENTRIES = 200;
const skeletonCache = new Map<string, SkeletonCacheEntry>();

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function createSkeletonRecord(
  video_id: string,
  shot_id: number,
  frame_number: number,
  landmarks: Array<Record<string, unknown>>,
  timestamp = 0,
): SkeletonFrame {
  const mappedLandmarks: SkeletonLandmark[] = (landmarks || []).slice(0, 33).map((joint, idx) => ({
    id: Number.isFinite(Number(joint.id)) ? Number(joint.id) : idx,
    x: clamp01(Number(joint.x)),
    y: clamp01(Number(joint.y)),
    z: clamp01(Number(joint.z)),
    visibility: clamp01(Number(joint.visibility)),
  }));

  return {
    frame_number: Number(frame_number),
    timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : 0,
    landmarks: mappedLandmarks,
  };
}

function normalizeSkeletonDataset(raw: unknown, fallbackVideoId: string): SkeletonDataset | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const video_id = String(source.video_id || fallbackVideoId || "").trim();
  if (!video_id) return null;

  const rawShots = Array.isArray(source.shots) ? source.shots : [];
  const shots: SkeletonShot[] = rawShots.map((item, idx) => {
    const shot = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const shot_id = Number.isFinite(Number(shot.shot_id)) ? Number(shot.shot_id) : idx + 1;
    const rawFrames = Array.isArray(shot.frames) ? shot.frames : [];

    const frames: SkeletonFrame[] = rawFrames.map((frameRaw) => {
      const frame = frameRaw && typeof frameRaw === "object" ? (frameRaw as Record<string, unknown>) : {};
      const frame_number = Number.isFinite(Number(frame.frame_number)) ? Number(frame.frame_number) : 0;
      const timestamp = Number.isFinite(Number(frame.timestamp)) ? Number(frame.timestamp) : 0;
      const landmarks = Array.isArray(frame.landmarks)
        ? (frame.landmarks as Array<Record<string, unknown>>)
        : [];
      return createSkeletonRecord(video_id, shot_id, frame_number, landmarks, timestamp);
    }).filter((frame) => frame.frame_number > 0);

    return {
      shot_id,
      frames,
    };
  }).filter((shot) => shot.frames.length > 0);

  return {
    video_id,
    shots,
  };
}

function buildSkeletonCacheEntry(dataset: SkeletonDataset): SkeletonCacheEntry {
  const shotsById = new Map<number, SkeletonShotIndex>();
  for (const shot of dataset.shots) {
    const sortedFrames = [...shot.frames].sort((a, b) => a.frame_number - b.frame_number);
    const frameNumbers = sortedFrames.map((frame) => frame.frame_number);
    const framesByNumber = new Map<number, SkeletonFrame>();
    for (const frame of sortedFrames) {
      framesByNumber.set(frame.frame_number, frame);
    }
    shotsById.set(shot.shot_id, {
      shot: {
        ...shot,
        frames: sortedFrames,
      },
      frameNumbers,
      framesByNumber,
    });
  }

  const now = Date.now();
  return {
    dataset,
    shotsById,
    cachedAt: now,
    expiresAt: now + SKELETON_CACHE_TTL_MS,
  };
}

function evictOldestSkeletonCacheEntry(): void {
  if (skeletonCache.size < SKELETON_CACHE_MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;
  for (const [key, entry] of skeletonCache.entries()) {
    if (entry.cachedAt < oldestTime) {
      oldestTime = entry.cachedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) skeletonCache.delete(oldestKey);
}

function invalidateSkeletonCache(video_id: string): void {
  skeletonCache.delete(video_id);
}

function getCachedSkeletonEntry(video_id: string): SkeletonCacheEntry | null {
  const hit = skeletonCache.get(video_id);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    skeletonCache.delete(video_id);
    return null;
  }
  return hit;
}

function setCachedSkeletonEntry(video_id: string, entry: SkeletonCacheEntry): void {
  evictOldestSkeletonCacheEntry();
  skeletonCache.set(video_id, entry);
}

function lowerBoundFrameIndex(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBoundFrameIndex(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function selectShotFramesByRange(
  shotIndex: SkeletonShotIndex,
  startFrame?: number,
  endFrame?: number,
): SkeletonFrame[] {
  const hasStart = Number.isFinite(Number(startFrame));
  const hasEnd = Number.isFinite(Number(endFrame));
  if (!hasStart && !hasEnd) return shotIndex.shot.frames;

  const start = hasStart ? Number(startFrame) : Number.NEGATIVE_INFINITY;
  const end = hasEnd ? Number(endFrame) : Number.POSITIVE_INFINITY;
  if (start > end) return [];

  const lo = hasStart ? lowerBoundFrameIndex(shotIndex.frameNumbers, start) : 0;
  const hi = hasEnd ? upperBoundFrameIndex(shotIndex.frameNumbers, end) : shotIndex.frameNumbers.length;

  return shotIndex.shot.frames.slice(lo, hi);
}

async function getSkeletonCacheEntry(video_id: string): Promise<SkeletonCacheEntry | null> {
  const cached = getCachedSkeletonEntry(video_id);
  if (cached) return cached;

  const [row] = await db
    .select({ aiDiagnostics: metrics.aiDiagnostics })
    .from(metrics)
    .where(eq(metrics.analysisId, video_id))
    .limit(1);

  const diagnostics = row?.aiDiagnostics && typeof row.aiDiagnostics === "object"
    ? (row.aiDiagnostics as Record<string, unknown>)
    : null;
  if (!diagnostics) return null;

  const dataset = normalizeSkeletonDataset(diagnostics.skeletonData, video_id);
  if (!dataset) return null;

  const entry = buildSkeletonCacheEntry(dataset);
  setCachedSkeletonEntry(video_id, entry);
  return entry;
}

async function getSkeletonDataset(video_id: string): Promise<SkeletonDataset | null> {
  const entry = await getSkeletonCacheEntry(video_id);
  return entry?.dataset || null;
}

async function getShotSkeleton(
  video_id: string,
  shot_id: number,
  startFrame?: number,
  endFrame?: number,
): Promise<{ video_id: string; shot_id: number; frames: SkeletonFrame[] } | null> {
  const cacheEntry = await getSkeletonCacheEntry(video_id);
  if (!cacheEntry) return null;

  const shot = cacheEntry.shotsById.get(shot_id);
  if (!shot) return null;

  const frames = selectShotFramesByRange(shot, startFrame, endFrame);

  return {
    video_id: cacheEntry.dataset.video_id,
    shot_id,
    frames,
  };
}

async function getFrameSkeleton(
  video_id: string,
  shot_id: number,
  frame_number: number,
): Promise<{ video_id: string; shot_id: number; frame: SkeletonFrame } | null> {
  const cacheEntry = await getSkeletonCacheEntry(video_id);
  if (!cacheEntry) return null;

  const shot = cacheEntry.shotsById.get(shot_id);
  if (!shot) return null;

  const frame = shot.framesByNumber.get(frame_number);
  if (!frame) return null;

  return {
    video_id: cacheEntry.dataset.video_id,
    shot_id,
    frame,
  };
}

type MetricRangeFilters = {
  configKey?: string;
  sportName?: string;
  movementName?: string;
  metricKey?: string;
  includeInactive?: boolean;
};

function applyDbRangesToConfig(
  config: SportCategoryConfig,
  rows: Array<typeof sportCategoryMetricRanges.$inferSelect>,
): SportCategoryConfig {
  const byMetricKey = new Map<string, typeof sportCategoryMetricRanges.$inferSelect>();
  for (const row of rows) {
    byMetricKey.set(String(row.metricKey || ""), row);
  }

  const metricsByKey = new Map<string, MetricDefinition>();

  // Start from static config so label/description/optimalRange remain available.
  // DB rows, when present, will override these fields.
  for (const metric of config.metrics || []) {
    metricsByKey.set(metric.key, { ...metric });
  }

  for (const row of rows) {
    const key = String(row.metricKey || "").trim();
    if (!key) continue;
    const existing = metricsByKey.get(key);
    if (existing) {
      metricsByKey.set(key, {
        ...existing,
        label: row.metricLabel || existing.label,
        unit: normalizeMetricUnit(key, row.unit || existing.unit),
        optimalRange: normalizeMetricRangeToTenScale(key, [Number(row.optimalMin), Number(row.optimalMax)]),
      });
      continue;
    }

    metricsByKey.set(key, {
      key,
      label: row.metricLabel || key,
      unit: normalizeMetricUnit(key, row.unit || ""),
      icon: "analytics-outline",
      category: "technique",
      color: "#60A5FA",
      description: "Optimal range configured in database.",
      optimalRange: normalizeMetricRangeToTenScale(key, [Number(row.optimalMin), Number(row.optimalMax)]),
    });
  }

  const metrics: MetricDefinition[] = Array.from(metricsByKey.values()).map((metric) => {
    const row = byMetricKey.get(metric.key);
    if (!row) return metric;
    return {
      ...metric,
      label: row.metricLabel || metric.label,
      unit: normalizeMetricUnit(metric.key, row.unit || metric.unit),
      optimalRange: normalizeMetricRangeToTenScale(metric.key, [Number(row.optimalMin), Number(row.optimalMax)]),
    };
  });

  return {
    ...config,
    metrics,
  };
}

async function fetchMetricRangeRows(filters: MetricRangeFilters = {}) {
  const conditions: any[] = [];

  if (filters.configKey) {
    conditions.push(eq(sportCategoryMetricRanges.configKey, String(filters.configKey).trim()));
  }
  if (filters.metricKey) {
    conditions.push(eq(sportCategoryMetricRanges.metricKey, String(filters.metricKey).trim()));
  }
  if (filters.sportName) {
    conditions.push(
      sql`lower(${sportCategoryMetricRanges.sportName}) = ${String(filters.sportName).trim().toLowerCase()}`,
    );
  }
  if (filters.movementName) {
    conditions.push(
      sql`lower(${sportCategoryMetricRanges.movementName}) = ${String(filters.movementName).trim().toLowerCase()}`,
    );
  }
  if (!filters.includeInactive) {
    conditions.push(eq(sportCategoryMetricRanges.isActive, true));
  }

  const rows = await db
    .select()
    .from(sportCategoryMetricRanges)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      asc(sportCategoryMetricRanges.configKey),
      asc(sportCategoryMetricRanges.metricKey),
    );

  return rows;
}

function normalizeMetricRangeRow(
  row: typeof sportCategoryMetricRanges.$inferSelect,
): typeof sportCategoryMetricRanges.$inferSelect {
  const metricKey = String(row.metricKey || "").trim();
  return {
    ...row,
    unit: normalizeMetricUnit(metricKey, row.unit),
    optimalMin: normalizeMetricValueToTenScale(metricKey, Number(row.optimalMin)),
    optimalMax: normalizeMetricValueToTenScale(metricKey, Number(row.optimalMax)),
  };
}

type ScoringModelDatasetMetric = {
  datasetName: string;
  movementType: string;
  movementDetectionAccuracyPct: number;
  scoringAccuracyPct: number;
};

type ScoringModelDashboard = {
  modelVersion: string;
  modelVersionDescription: string;
  movementType: string;
  movementDetectionAccuracyPct: number;
  scoringAccuracyPct: number;
  totalVideosConsidered: number;
  datasetsUsed: string[];
  datasetMetrics: ScoringModelDatasetMetric[];
};

async function getVideoValidationMode(actorUserId?: string | null): Promise<VideoValidationMode> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, VIDEO_VALIDATION_MODE_KEY))
    .limit(1);

  const rawMode = setting?.value && typeof setting.value === "object"
    ? (setting.value as Record<string, unknown>).mode
    : null;
  if (isVideoValidationMode(rawMode)) {
    return rawMode;
  }

  const defaultMode: VideoValidationMode = "disabled";
  await db
    .insert(appSettings)
    .values({
      key: VIDEO_VALIDATION_MODE_KEY,
      value: { mode: defaultMode },
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoNothing();

  return defaultMode;
}

async function setVideoValidationMode(mode: VideoValidationMode, actorUserId?: string | null): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: VIDEO_VALIDATION_MODE_KEY,
      value: { mode },
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { mode },
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });
}

async function ensureVideoValidationModeSetting(): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: VIDEO_VALIDATION_MODE_KEY,
      value: { mode: "disabled" satisfies VideoValidationMode },
      ...buildInsertAuditFields(null),
    })
    .onConflictDoNothing();
}

async function getAnalysisFpsSettings(actorUserId?: string | null): Promise<AnalysisFpsSettings> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, ANALYSIS_FPS_MODE_KEY))
    .limit(1);

  const rawValue = setting?.value && typeof setting.value === "object"
    ? (setting.value as Record<string, unknown>)
    : null;

  const lowImpactStep = coerceLowImpactStep(rawValue?.lowImpactStep ?? rawValue?.lowImpactMode);
  const highImpactStep = coerceHighImpactStep(rawValue?.highImpactStep ?? rawValue?.highImpactMode);
  const tennisAutoDetectUsesHighImpact = Boolean(rawValue?.tennisAutoDetectUsesHighImpact);
  const tennisMatchPlayUsesHighImpact = Boolean(rawValue?.tennisMatchPlayUsesHighImpact);

  if (
    setting
    && rawValue?.lowImpactStep === lowImpactStep
    && rawValue?.highImpactStep === highImpactStep
    && rawValue?.tennisAutoDetectUsesHighImpact === tennisAutoDetectUsesHighImpact
    && rawValue?.tennisMatchPlayUsesHighImpact === tennisMatchPlayUsesHighImpact
  ) {
    return {
      lowImpactStep,
      highImpactStep,
      tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact,
    };
  }

  const value = {
    lowImpactStep,
    highImpactStep,
    tennisAutoDetectUsesHighImpact,
    tennisMatchPlayUsesHighImpact,
  };
  await db
    .insert(appSettings)
    .values({
      key: ANALYSIS_FPS_MODE_KEY,
      value,
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value,
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });

  return value;
}

async function setAnalysisFpsSettings(
  settings: AnalysisFpsSettings,
  actorUserId?: string | null,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: ANALYSIS_FPS_MODE_KEY,
      value: settings,
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: settings,
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });
}

async function ensureAnalysisFpsSetting(): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: ANALYSIS_FPS_MODE_KEY,
      value: {
        lowImpactStep: "step2" satisfies AnalysisFpsStep,
        highImpactStep: "step1" satisfies AnalysisFpsStep,
        tennisAutoDetectUsesHighImpact: false,
        tennisMatchPlayUsesHighImpact: false,
      },
      ...buildInsertAuditFields(null),
    })
    .onConflictDoNothing();
}

type EvaluationLinkedAnalysis = {
  videoFilename: string;
  sourceFilename?: string | null;
  evaluationVideoId?: string | null;
};

function getEvaluationMatch(
  analysis: EvaluationLinkedAnalysis,
  map: Map<string, { videoId: string; datasetName: string; movementType: string }>,
) {
  const evaluationVideoId = String(analysis.evaluationVideoId || "").trim();
  const sourceFilename = String(analysis.sourceFilename || "").trim();
  const videoFilename = String(analysis.videoFilename || "").trim();

  if (evaluationVideoId && map.has(evaluationVideoId)) {
    return map.get(evaluationVideoId);
  }

  const keys = [
    sourceFilename,
    path.basename(sourceFilename),
    videoFilename,
    path.basename(videoFilename),
  ].filter(Boolean);

  for (const key of keys) {
    const match = map.get(key);
    if (match) return match;
  }

  return undefined;
}

async function buildScoringModelDashboard(
  userId: string,
  isAdmin: boolean,
  movementFilterRaw?: string,
  playerFilterRaw?: string,
): Promise<ScoringModelDashboard> {
  const modelConfig = readModelRegistryConfig();
  const movementFilter = normalizeMovementToken(movementFilterRaw || "");
  const playerFilter = String(playerFilterRaw || "").trim();
  const applyPlayerFilter = isAdmin && playerFilter && playerFilter.toLowerCase() !== "all";

  const datasetVideoMap = getEvaluationDatasetVideoMap(modelConfig);
  const allDatasets = readEvaluationDatasetManifest(modelConfig).datasets.map((dataset) => dataset.name);

  const discrepancyRows = isAdmin
    ? await db
        .select({
          discrepancy: analysisShotDiscrepancies,
          analysis: analyses,
        })
        .from(analysisShotDiscrepancies)
        .innerJoin(analyses, eq(analysisShotDiscrepancies.analysisId, analyses.id))
        .where(eq(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion))
    : await db
        .select({
          discrepancy: analysisShotDiscrepancies,
          analysis: analyses,
        })
        .from(analysisShotDiscrepancies)
        .innerJoin(analyses, eq(analysisShotDiscrepancies.analysisId, analyses.id))
        .where(
          and(
            eq(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion),
            eq(analysisShotDiscrepancies.userId, userId),
          ),
        );

  const filteredRows = discrepancyRows.filter((row) => {
    if (applyPlayerFilter && row.analysis.userId !== playerFilter) return false;
    if (!movementFilter) return true;
    return normalizeMovementToken(row.discrepancy.movementName) === movementFilter;
  });

  let totalManualShots = 0;
  let totalMismatches = 0;
  let movementMatches = 0;
  let movementTotal = 0;

  const datasetAccumulator = new Map<
    string,
    {
      movementType: string;
      scoringManualShots: number;
      scoringMismatches: number;
      movementTotal: number;
      movementMatches: number;
    }
  >();

  for (const row of filteredRows) {
    const expected = getEvaluationMatch(row.analysis, datasetVideoMap);
    if (!expected) continue;

    const movementType = expected.movementType || row.discrepancy.movementName || "unknown";
    const datasetName = expected.datasetName;

    if (!datasetAccumulator.has(datasetName)) {
      datasetAccumulator.set(datasetName, {
        movementType,
        scoringManualShots: 0,
        scoringMismatches: 0,
        movementTotal: 0,
        movementMatches: 0,
      });
    }

    const acc = datasetAccumulator.get(datasetName)!;
    const manualShots = Number(row.discrepancy.manualShots || 0);
    const mismatches = Number(row.discrepancy.mismatches || 0);

    totalManualShots += manualShots;
    totalMismatches += mismatches;
    acc.scoringManualShots += manualShots;
    acc.scoringMismatches += mismatches;

    movementTotal += 1;
    acc.movementTotal += 1;

    if (isMovementMatch(expected.movementType, row.analysis.detectedMovement || "")) {
      movementMatches += 1;
      acc.movementMatches += 1;
    }
  }

  const scoringAccuracyPct = totalManualShots
    ? Number((100 - (totalMismatches / Math.max(totalManualShots, 1)) * 100).toFixed(1))
    : 0;
  const movementDetectionAccuracyPct = movementTotal
    ? Number(((movementMatches / movementTotal) * 100).toFixed(1))
    : 0;

  const datasetMetrics: ScoringModelDatasetMetric[] = Array.from(datasetAccumulator.entries()).map(
    ([datasetName, acc]) => ({
      datasetName,
      movementType: acc.movementType,
      movementDetectionAccuracyPct: acc.movementTotal
        ? Number(((acc.movementMatches / acc.movementTotal) * 100).toFixed(1))
        : 0,
      scoringAccuracyPct: acc.scoringManualShots
        ? Number((100 - (acc.scoringMismatches / Math.max(acc.scoringManualShots, 1)) * 100).toFixed(1))
        : 0,
    }),
  );

  return {
    modelVersion: modelConfig.activeModelVersion,
    modelVersionDescription: modelConfig.modelVersionChangeDescription,
    movementType: movementFilterRaw || "all",
    movementDetectionAccuracyPct,
    scoringAccuracyPct,
    totalVideosConsidered: movementTotal,
    datasetsUsed: datasetMetrics.length > 0 ? datasetMetrics.map((item) => item.datasetName) : allDatasets,
    datasetMetrics,
  };
}

function readShotCountFromMetricValues(metricValues: unknown): number {
  if (!metricValues || typeof metricValues !== "object") return 0;
  const raw = (metricValues as Record<string, unknown>).shotCount;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function computeDiscrepancySnapshot(autoLabels: string[], manualLabels: string[]) {
  const alignedCount = Math.min(autoLabels.length, manualLabels.length);
  let labelMismatches = 0;
  const confusionMap = new Map<string, number>();

  for (let index = 0; index < alignedCount; index += 1) {
    const autoLabel = autoLabels[index];
    const manualLabel = manualLabels[index];
    if (autoLabel !== manualLabel) {
      labelMismatches += 1;
      const key = `${autoLabel}=>${manualLabel}`;
      confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
    }
  }

  const countMismatch = Math.abs(autoLabels.length - manualLabels.length);
  const mismatches = labelMismatches + countMismatch;
  const denominator = Math.max(autoLabels.length, manualLabels.length, 1);
  const mismatchRatePct = Number(((mismatches / denominator) * 100).toFixed(1));

  const confusionPairs = Array.from(confusionMap.entries()).map(([pair, count]) => {
    const [from, to] = pair.split("=>");
    return { from, to, count };
  });

  return {
    autoShots: autoLabels.length,
    manualShots: manualLabels.length,
    mismatches,
    mismatchRatePct,
    labelMismatches,
    countMismatch,
    confusionPairs,
  };
}

async function resolveAutoLabelsForAnalysis(
  analysis: typeof analyses.$inferSelect,
  sportName: string,
  movementName: string,
  manualLabels: string[],
  dominantProfile?: string | null,
  classificationModelSelection?: { selectedModelKey: string; modelVersion?: string | null } | null,
): Promise<string[]> {
  let autoLabels: string[] = [];

  if (analysis.videoPath) {
    try {
      const diagnostics = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => runPythonDiagnostics(
          localPath,
          sportName,
          movementName,
          dominantProfile,
          classificationModelSelection,
        ),
      );
      autoLabels = (diagnostics?.shotSegments || []).map((segment: any) =>
        normalizeShotLabel(segment?.label),
      );
    } catch {
      autoLabels = [];
    }
  }

  if (autoLabels.length === 0 && manualLabels.length > 0) {
    const fallbackLabel = normalizeShotLabel(
      analysis.detectedMovement || movementName || "unknown",
    );
    autoLabels = Array.from({ length: manualLabels.length }, () => fallbackLabel);
  }

  return autoLabels;
}

async function resolveSportAndMovementNames(
  analysis: typeof analyses.$inferSelect,
): Promise<{ sportName: string; movementName: string }> {
  let sportName = "Tennis";
  let movementName = "auto-detect";

  if (analysis.sportId) {
    const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
    if (sport?.name) {
      sportName = sport.name;
    }
  }

  if (analysis.movementId) {
    const [movement] = await db
      .select()
      .from(sportMovements)
      .where(eq(sportMovements.id, analysis.movementId));
    if (movement?.name) {
      movementName = movement.name;
    }
  }

  return { sportName, movementName };
}

async function attachVideoUrl<T extends { videoPath?: string | null }>(
  row: T,
): Promise<T & { videoUrl: string | null }> {
  return {
    ...row,
    videoUrl: await resolveMediaUrl(row.videoPath || null),
  };
}

const AUDIT_METADATA_BACKFILL_KEY = "AUDIT_METADATA_BACKFILL_V1";

async function ensureAuditMetadataBackfill(): Promise<void> {
  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, AUDIT_METADATA_BACKFILL_KEY))
    .limit(1);

  if (existing) {
    return;
  }

  await db.execute(sql`
    update users
    set
      updated_at = coalesce(updated_at, created_at, now()),
      created_by_user_id = coalesce(created_by_user_id, id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, id)
    where updated_at is null
       or created_by_user_id is null
       or updated_by_user_id is null
  `);

  await db.execute(sql`
    update sports
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where created_at is null
       or updated_at is null
  `);

  await db.execute(sql`
    update sport_movements
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where created_at is null
       or updated_at is null
  `);

  await db.execute(sql`
    update analyses
    set
      created_by_user_id = coalesce(created_by_user_id, user_id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, user_id)
    where created_by_user_id is null
       or updated_by_user_id is null
  `);

  await db.execute(sql`
    update metrics as m
    set
      updated_at = coalesce(m.updated_at, m.created_at, now()),
      created_by_user_id = coalesce(m.created_by_user_id, a.created_by_user_id, a.user_id),
      updated_by_user_id = coalesce(m.updated_by_user_id, m.created_by_user_id, a.updated_by_user_id, a.created_by_user_id, a.user_id)
    from analyses as a
    where m.analysis_id = a.id
      and (
        m.updated_at is null
        or m.created_by_user_id is null
        or m.updated_by_user_id is null
      )
  `);

  await db.execute(sql`
    update coaching_insights as ci
    set
      updated_at = coalesce(ci.updated_at, ci.created_at, now()),
      created_by_user_id = coalesce(ci.created_by_user_id, a.created_by_user_id, a.user_id),
      updated_by_user_id = coalesce(ci.updated_by_user_id, ci.created_by_user_id, a.updated_by_user_id, a.created_by_user_id, a.user_id)
    from analyses as a
    where ci.analysis_id = a.id
      and (
        ci.updated_at is null
        or ci.created_by_user_id is null
        or ci.updated_by_user_id is null
      )
  `);

  await db.execute(sql`
    update analysis_feedback
    set
      updated_at = coalesce(updated_at, created_at, now()),
      created_by_user_id = coalesce(created_by_user_id, user_id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, user_id)
    where updated_at is null
       or created_by_user_id is null
       or updated_by_user_id is null
  `);

  await db.execute(sql`
    update analysis_shot_annotations
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now()),
      created_by_user_id = coalesce(created_by_user_id, user_id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, user_id)
    where created_at is null
       or updated_at is null
       or created_by_user_id is null
       or updated_by_user_id is null
  `);

  await db.execute(sql`
    update analysis_shot_discrepancies
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now()),
      created_by_user_id = coalesce(created_by_user_id, user_id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, user_id)
    where created_at is null
       or updated_at is null
       or created_by_user_id is null
       or updated_by_user_id is null
  `);

  await db.execute(sql`
    update app_settings
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where created_at is null
       or updated_at is null
  `);

  await db.execute(sql`
    update sport_category_metric_ranges
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now()),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id)
    where created_at is null
       or updated_at is null
       or updated_by_user_id is null
  `);

  await db
    .insert(appSettings)
    .values({
      key: AUDIT_METADATA_BACKFILL_KEY,
      value: {
        version: 1,
        completedAt: new Date().toISOString(),
      },
      ...buildInsertAuditFields(null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: {
          version: 1,
          completedAt: new Date().toISOString(),
        },
        ...buildUpdateAuditFields(null),
      },
    });

  console.log("Applied one-time audit metadata backfill for existing records");
}

async function refreshDiscrepancySnapshotsForAnalysis(
  analysisId: string,
  options?: {
    modelVersion?: string | null;
    classificationModelSelection?: { selectedModelKey: string; modelVersion?: string | null } | null;
  },
): Promise<{ refreshed: number; skipped: number }> {
  const modelConfig = readModelRegistryConfig();
  const targetModelVersion = String(options?.modelVersion || modelConfig.activeModelVersion).trim() || modelConfig.activeModelVersion;
  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, analysisId))
    .limit(1);

  if (!analysis) {
    return { refreshed: 0, skipped: 1 };
  }

  const annotations = await db
    .select()
    .from(analysisShotAnnotations)
    .where(eq(analysisShotAnnotations.analysisId, analysisId));

  if (annotations.length === 0) {
    return { refreshed: 0, skipped: 0 };
  }

  const { sportName, movementName } = await resolveSportAndMovementNames(analysis);
  const dominantProfile = await resolveUserDominantProfile(analysis.userId);

  let refreshed = 0;
  let skipped = 0;

  for (const annotation of annotations) {
    const manualLabels = (annotation.orderedShotLabels || []).map((label) =>
      normalizeShotLabel(label),
    );

    try {
      const autoLabels = await resolveAutoLabelsForAnalysis(
        analysis,
        sportName,
        movementName,
        manualLabels,
        dominantProfile,
        options?.classificationModelSelection,
      );
      const snapshot = computeDiscrepancySnapshot(autoLabels, manualLabels);

      await db
        .insert(analysisShotDiscrepancies)
        .values({
          analysisId,
          userId: annotation.userId,
          videoName: analysis.videoFilename,
          sportName,
          movementName,
          modelVersion: targetModelVersion,
          autoShots: snapshot.autoShots,
          manualShots: snapshot.manualShots,
          mismatches: snapshot.mismatches,
          mismatchRatePct: snapshot.mismatchRatePct,
          labelMismatches: snapshot.labelMismatches,
          countMismatch: snapshot.countMismatch,
          confusionPairs: snapshot.confusionPairs,
          ...buildInsertAuditFields(annotation.userId),
        })
        .onConflictDoUpdate({
          target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId, analysisShotDiscrepancies.modelVersion],
          set: {
            videoName: analysis.videoFilename,
            sportName,
            movementName,
            modelVersion: targetModelVersion,
            autoShots: snapshot.autoShots,
            manualShots: snapshot.manualShots,
            mismatches: snapshot.mismatches,
            mismatchRatePct: snapshot.mismatchRatePct,
            labelMismatches: snapshot.labelMismatches,
            countMismatch: snapshot.countMismatch,
            confusionPairs: snapshot.confusionPairs,
            ...buildUpdateAuditFields(annotation.userId),
          },
        });

      refreshed += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`Discrepancy refresh failed for analysis ${analysisId}, user ${annotation.userId}:`, error);
    }
  }

  return { refreshed, skipped };
}

export async function registerRoutes(app: Express): Promise<Server> {
  await db.execute(sql`alter table users add column if not exists dominant_profile text`);
  await db.execute(sql`alter table users add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table users add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table users add column if not exists updated_by_user_id varchar`);
  await db.execute(sql`
    update sport_category_metric_ranges
    set
      optimal_min = case
        when metric_key in ('balanceScore', 'rhythmConsistency', 'shotConsistency') and optimal_min > 10
          then round((optimal_min / 10.0)::numeric, 1)::real
        else optimal_min
      end,
      optimal_max = case
        when metric_key in ('balanceScore', 'rhythmConsistency', 'shotConsistency') and optimal_max > 10
          then round((optimal_max / 10.0)::numeric, 1)::real
        else optimal_max
      end,
      unit = case
        when metric_key in ('balanceScore', 'rhythmConsistency', 'shotConsistency') then '/10'
        else unit
      end,
      updated_at = now()
    where metric_key in ('balanceScore', 'rhythmConsistency', 'shotConsistency')
      and (optimal_min > 10 or optimal_max > 10 or unit <> '/10')
  `);

  await db.execute(sql`alter table sports add column if not exists created_at timestamp default now()`);
  await db.execute(sql`alter table sports add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table sports add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table sports add column if not exists updated_by_user_id varchar`);
  await db.execute(sql`alter table sports add column if not exists enabled boolean`);
  await db.execute(sql`
    update sports
    set enabled = case
      when lower(name) = 'tennis' then true
      else false
    end
    where enabled is null
  `);
  await db.execute(sql`alter table sports alter column enabled set default false`);
  await db.execute(sql`update sports set enabled = true where lower(name) = 'tennis' and enabled is null`);

  await db.execute(sql`alter table sport_movements add column if not exists created_at timestamp default now()`);
  await db.execute(sql`alter table sport_movements add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table sport_movements add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table sport_movements add column if not exists updated_by_user_id varchar`);

  await db.execute(sql`alter table analyses add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table analyses add column if not exists updated_by_user_id varchar`);

  await db.execute(sql`alter table metrics add column if not exists score_inputs jsonb`);
  await db.execute(sql`alter table metrics add column if not exists score_outputs jsonb`);
  await db.execute(sql`alter table metrics add column if not exists ai_diagnostics jsonb`);
  await db.execute(sql`alter table metrics add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table metrics add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table metrics add column if not exists updated_by_user_id varchar`);

  await db.execute(sql`alter table coaching_insights add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table coaching_insights add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table coaching_insights add column if not exists updated_by_user_id varchar`);

  await db.execute(sql`alter table analysis_feedback add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table analysis_feedback add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table analysis_feedback add column if not exists updated_by_user_id varchar`);
  await db.execute(sql`alter table metrics drop column if exists tactical_scores`);
  await db.execute(sql`alter table metrics drop column if exists sub_scores`);

  await db.execute(sql`
    create table if not exists analysis_shot_annotations (
      id varchar primary key default gen_random_uuid(),
      analysis_id varchar not null references analyses(id),
      user_id varchar not null references users(id),
      total_shots real not null,
      ordered_shot_labels jsonb not null,
      used_for_scoring_shot_indexes jsonb not null,
      include_in_training boolean not null default true,
      notes text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
      ,created_by_user_id varchar
      ,updated_by_user_id varchar
    )
  `);

  await db.execute(sql`alter table analysis_shot_annotations add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table analysis_shot_annotations add column if not exists updated_by_user_id varchar`);
  await db.execute(sql`alter table analysis_shot_annotations add column if not exists include_in_training boolean default true`);
  await db.execute(sql`update analysis_shot_annotations set include_in_training = true where include_in_training is null`);
  await db.execute(sql`alter table analysis_shot_annotations alter column include_in_training set default true`);
  await db.execute(sql`alter table analysis_shot_annotations alter column include_in_training set not null`);

  await db.execute(sql`
    create unique index if not exists analysis_shot_annotations_analysis_user_uq
    on analysis_shot_annotations (analysis_id, user_id)
  `);

  await db.execute(sql`
    create table if not exists analysis_shot_discrepancies (
      id varchar primary key default gen_random_uuid(),
      analysis_id varchar not null references analyses(id),
      user_id varchar not null references users(id),
      video_name text not null,
      sport_name text not null,
      movement_name text not null,
      auto_shots real not null,
      manual_shots real not null,
      mismatches real not null,
      mismatch_rate_pct real not null,
      label_mismatches real not null,
      count_mismatch real not null,
      confusion_pairs jsonb not null default '[]'::jsonb,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar,
      updated_by_user_id varchar
    )
  `);

  await db.execute(sql`alter table analysis_shot_discrepancies add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table analysis_shot_discrepancies add column if not exists updated_by_user_id varchar`);

  await db.execute(sql`
    create table if not exists app_settings (
      key varchar primary key,
      value jsonb not null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
      ,created_by_user_id varchar
      ,updated_by_user_id varchar
    )
  `);

  await db.execute(sql`
    create table if not exists analysis_recalculation_runs (
      trace_id varchar primary key,
      requested_by_user_id varchar references users(id),
      scope text not null,
      selected_model_version varchar,
      selected_model_source text,
      created_at timestamp with time zone not null default now()
    )
  `);

  await db.execute(sql`
    create table if not exists analysis_recalculation_run_items (
      id varchar primary key default gen_random_uuid(),
      trace_id varchar not null references analysis_recalculation_runs(trace_id) on delete cascade,
      analysis_id varchar not null references analyses(id) on delete cascade,
      created_at timestamp with time zone not null default now()
    )
  `);

  await db.execute(sql`
    create unique index if not exists analysis_recalculation_run_items_trace_analysis_uq
    on analysis_recalculation_run_items (trace_id, analysis_id)
  `);

  await db.execute(sql`alter table app_settings add column if not exists created_at timestamp default now()`);
  await db.execute(sql`alter table app_settings add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table app_settings add column if not exists updated_by_user_id varchar`);

  await ensureVideoValidationModeSetting();
  await ensureAnalysisFpsSetting();
  await ensureVideoStorageModeSetting();

  await db.execute(sql`
    create table if not exists sport_category_metric_ranges (
      id varchar primary key default gen_random_uuid(),
      sport_name text not null,
      movement_name text not null,
      config_key varchar not null,
      metric_key text not null,
      metric_label text not null,
      unit text not null,
      optimal_min real not null,
      optimal_max real not null,
      is_active boolean not null default true,
      source text not null default 'config',
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar,
      updated_by_user_id varchar
    )
  `);

  await db.execute(sql`alter table sport_category_metric_ranges add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table sport_category_metric_ranges add column if not exists updated_by_user_id varchar`);

  await db.execute(sql`
    create unique index if not exists sport_category_metric_ranges_config_metric_uq
    on sport_category_metric_ranges (config_key, metric_key)
  `);

  await db.execute(sql`
    create index if not exists sport_category_metric_ranges_sport_movement_idx
    on sport_category_metric_ranges (sport_name, movement_name, is_active)
  `);

  await db.execute(sql`alter table metrics add column if not exists model_version varchar not null default '0.1'`);
  await db.execute(sql`alter table analysis_shot_discrepancies add column if not exists model_version varchar not null default '0.1'`);
  await db.execute(sql`drop index if exists analysis_shot_discrepancies_analysis_user_uq`);
  await db.execute(sql`
    create unique index if not exists analysis_shot_discrepancies_analysis_user_version_uq
    on analysis_shot_discrepancies (analysis_id, user_id, model_version)
  `);
  await db.execute(sql`drop table if exists scoring_model_registry_dataset_metrics`);
  await db.execute(sql`drop table if exists scoring_model_registry_entries`);

  await db.execute(sql`
    create table if not exists model_registry_versions (
      id varchar primary key default gen_random_uuid(),
      model_version varchar not null unique,
      description text not null default '',
      status varchar not null default 'draft',
      activated_at timestamp,
      activated_by_user_id varchar references users(id),
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create table if not exists model_registry_datasets (
      id varchar primary key default gen_random_uuid(),
      name text not null unique,
      description text not null default '',
      source text not null default 'manual-annotation',
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create table if not exists model_registry_dataset_items (
      id varchar primary key default gen_random_uuid(),
      dataset_id varchar not null references model_registry_datasets(id),
      analysis_id varchar not null references analyses(id),
      annotator_user_id varchar references users(id),
      expected_movement text not null,
      evaluation_video_id text,
      source_filename text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create unique index if not exists model_registry_dataset_items_dataset_analysis_uq
    on model_registry_dataset_items (dataset_id, analysis_id)
  `);

  await db.execute(sql`
    create index if not exists model_registry_dataset_items_analysis_idx
    on model_registry_dataset_items (analysis_id)
  `);

  await db.execute(sql`
    create table if not exists model_training_datasets (
      id varchar primary key default gen_random_uuid(),
      model_family text not null,
      sport_name text not null default 'tennis',
      dataset_name text not null,
      source text not null default 'manual-annotation',
      analysis_count integer not null default 0,
      row_count integer not null default 0,
      notes text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create table if not exists model_training_dataset_rows (
      id varchar primary key default gen_random_uuid(),
      dataset_id varchar not null references model_training_datasets(id),
      analysis_id varchar not null references analyses(id),
      user_id varchar references users(id),
      video_filename text not null,
      shot_index integer not null,
      group_key text not null,
      label text not null,
      heuristic_label text,
      heuristic_confidence real,
      heuristic_reasons jsonb not null default '[]'::jsonb,
      feature_values jsonb not null default '{}'::jsonb,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create index if not exists model_training_dataset_rows_dataset_idx
    on model_training_dataset_rows (dataset_id, shot_index)
  `);

  await db.execute(sql`
    do $$
    begin
      if to_regclass('public.tennis_training_datasets') is not null then
        insert into model_training_datasets (
          id,
          model_family,
          sport_name,
          dataset_name,
          source,
          analysis_count,
          row_count,
          notes,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        )
        select
          legacy.id,
          'movement-classifier',
          legacy.sport_name,
          legacy.dataset_name,
          legacy.source,
          legacy.analysis_count,
          legacy.row_count,
          legacy.notes,
          legacy.created_at,
          legacy.updated_at,
          legacy.created_by_user_id,
          legacy.updated_by_user_id
        from tennis_training_datasets legacy
        where not exists (
          select 1
          from model_training_datasets datasets
          where datasets.id = legacy.id
        );
      end if;
    end $$;
  `);

  await db.execute(sql`
    do $$
    begin
      if to_regclass('public.tennis_training_dataset_rows') is not null then
        insert into model_training_dataset_rows (
          id,
          dataset_id,
          analysis_id,
          user_id,
          video_filename,
          shot_index,
          group_key,
          label,
          heuristic_label,
          heuristic_confidence,
          heuristic_reasons,
          feature_values,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        )
        select
          legacy.id,
          legacy.dataset_id,
          legacy.analysis_id,
          legacy.user_id,
          legacy.video_filename,
          legacy.shot_index,
          legacy.group_key,
          legacy.label,
          legacy.heuristic_label,
          legacy.heuristic_confidence,
          legacy.heuristic_reasons,
          legacy.feature_values,
          legacy.created_at,
          legacy.updated_at,
          legacy.created_by_user_id,
          legacy.updated_by_user_id
        from tennis_training_dataset_rows legacy
        where not exists (
          select 1
          from model_training_dataset_rows rows
          where rows.id = legacy.id
        );
      end if;
    end $$;
  `);

  await db.execute(sql`
    create table if not exists model_training_jobs (
      id varchar primary key default gen_random_uuid(),
      job_id varchar not null unique,
      model_family text not null,
      sport_name text not null default 'tennis',
      status varchar not null,
      dataset_id text,
      eligible_analysis_count integer not null default 0,
      eligible_shot_count integer not null default 0,
      export_rows integer,
      train_rows integer,
      test_rows integer,
      macro_f1 real,
      model_output_path text,
      metadata jsonb,
      report jsonb,
      requested_at timestamp not null default now(),
      started_at timestamp,
      completed_at timestamp,
      requested_by_user_id varchar references users(id),
      saved_model_version varchar,
      saved_model_artifact_path text,
      saved_at timestamp,
      version_description text,
      error text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create index if not exists model_training_jobs_family_sport_status_idx
    on model_training_jobs (model_family, sport_name, status, completed_at)
  `);

  await db.execute(sql`
    create table if not exists model_training_state (
      id varchar primary key default gen_random_uuid(),
      model_family text not null,
      sport_name text not null default 'tennis',
      current_job_id varchar,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id)
    )
  `);

  await db.execute(sql`
    create unique index if not exists model_training_state_scope_idx
    on model_training_state (sport_name, model_family)
  `);

  await db.execute(sql`
    do $$
    begin
      if to_regclass('public.tennis_model_training_runs') is not null then
        insert into model_training_jobs (
          id,
          job_id,
          model_family,
          sport_name,
          status,
          dataset_id,
          eligible_analysis_count,
          eligible_shot_count,
          export_rows,
          train_rows,
          test_rows,
          macro_f1,
          model_output_path,
          metadata,
          report,
          requested_at,
          started_at,
          completed_at,
          requested_by_user_id,
          saved_model_version,
          saved_model_artifact_path,
          saved_at,
          version_description,
          error,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        )
        select
          legacy.id,
          legacy.job_id,
          'movement-classifier',
          legacy.sport_name,
          legacy.status,
          legacy.dataset_id::text,
          legacy.eligible_analysis_count,
          legacy.eligible_shot_count,
          legacy.export_rows,
          legacy.train_rows,
          legacy.test_rows,
          legacy.macro_f1,
          legacy.model_output_path,
          legacy.metadata,
          legacy.report,
          legacy.requested_at,
          legacy.started_at,
          legacy.completed_at,
          legacy.requested_by_user_id,
          legacy.saved_model_version,
          legacy.saved_model_artifact_path,
          legacy.saved_at,
          legacy.version_description,
          legacy.error,
          legacy.created_at,
          legacy.updated_at,
          legacy.created_by_user_id,
          legacy.updated_by_user_id
        from tennis_model_training_runs legacy
        where not exists (
          select 1
          from model_training_jobs jobs
          where jobs.job_id = legacy.job_id
        );
      end if;
    end $$;
  `);

  await db.execute(sql`
    insert into model_training_state (
      model_family,
      sport_name,
      current_job_id,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    select
      'movement-classifier',
      'tennis',
      nullif(app_settings.value->>'currentJobId', ''),
      now(),
      now(),
      app_settings.created_by_user_id,
      app_settings.updated_by_user_id
    from app_settings
    where app_settings.key = 'tennisModelTrainingState'
      and not exists (
        select 1
        from model_training_state state
        where state.sport_name = 'tennis'
          and state.model_family = 'movement-classifier'
      )
  `);

  await db.execute(sql`
    delete from app_settings
    where key = 'tennisModelTrainingState'
  `);

  await db.execute(sql`alter table analyses add column if not exists captured_at timestamp`);
  await db.execute(sql`alter table analyses add column if not exists source_filename text`);
  await db.execute(sql`alter table analyses add column if not exists evaluation_video_id text`);
  await db.execute(sql`alter table analyses add column if not exists source_app text`);
  await db.execute(sql`alter table analyses add column if not exists video_duration_sec real`);
  await db.execute(sql`alter table analyses add column if not exists video_fps real`);
  await db.execute(sql`alter table analyses add column if not exists video_width real`);
  await db.execute(sql`alter table analyses add column if not exists video_height real`);
  await db.execute(sql`alter table analyses add column if not exists video_rotation real`);
  await db.execute(sql`alter table analyses add column if not exists video_codec text`);
  await db.execute(sql`alter table analyses add column if not exists video_content_hash text`);
  await db.execute(sql`alter table analyses add column if not exists video_bitrate_kbps real`);
  await db.execute(sql`alter table analyses add column if not exists file_size_bytes real`);
  await db.execute(sql`alter table analyses add column if not exists container_format text`);
  await db.execute(sql`alter table analyses add column if not exists gps_lat real`);
  await db.execute(sql`alter table analyses add column if not exists gps_lng real`);
  await db.execute(sql`alter table analyses add column if not exists gps_alt_m real`);
  await db.execute(sql`alter table analyses add column if not exists gps_speed_mps real`);
  await db.execute(sql`alter table analyses add column if not exists gps_heading_deg real`);
  await db.execute(sql`alter table analyses add column if not exists gps_accuracy_m real`);
  await db.execute(sql`alter table analyses add column if not exists gps_timestamp timestamp`);
  await db.execute(sql`alter table analyses add column if not exists gps_source text`);

  await initializeModelRegistryCache();
  await db.execute(sql`
    delete from app_settings
    where key = 'modelEvaluationMode'
       or key like 'modelEvaluationMode:%'
  `);
  await db.execute(sql`alter table analyses add column if not exists requested_session_type text`);
  await db.execute(sql`alter table analyses add column if not exists requested_focus_key text`);

  await ensureAuditMetadataBackfill();

  const parseIntegerList = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    const result: number[] = [];
    for (const item of value) {
      const n = Number(item);
      if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
        result.push(n);
      }
    }
    return result;
  };

  const parseBooleanWithDefault = (value: unknown, defaultValue: boolean): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return defaultValue;
  };

  const markStaleProcessingAsFailed = async (userId?: string) => {
    if (userId) {
      await db.execute(sql`
        update analyses
        set status = 'failed',
            rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
            updated_at = now()
        where status = 'processing'
          and updated_at < now() - interval '60 minutes'
          and user_id = ${userId}
      `);
      return;
    }

    await db.execute(sql`
      update analyses
      set status = 'failed',
          rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
          updated_at = now()
      where status = 'processing'
        and updated_at < now() - interval '60 minutes'
    `);
  };

  // Admin: get all users for filtering
  app.get("/api/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .orderBy(users.name);
      res.json(allUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/model-registry/config", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const overview = getModelRegistryOverview();
      res.json({
        ...overview.config,
        storage: overview.storage,
        versions: overview.versions,
        datasets: overview.datasets,
        manifestValidation: overview.validation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/model-registry/config", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const activeModelVersion = String(req.body?.activeModelVersion || "").trim();
      const modelVersionChangeDescription = String(req.body?.modelVersionChangeDescription || "").trim();
      if (!activeModelVersion) {
        return res.status(400).json({ error: "activeModelVersion is required" });
      }

      const next = await writeModelRegistryConfig({
        activeModelVersion,
        modelVersionChangeDescription,
        evaluationDatasetManifestPath:
          String(req.body?.evaluationDatasetManifestPath || "").trim() || "database://model-registry",
      }, userId);
      const overview = getModelRegistryOverview();
      res.json({
        ...next,
        storage: overview.storage,
        versions: overview.versions,
        datasets: overview.datasets,
        manifestValidation: overview.validation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/model-registry/validate-manifest", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const config = readModelRegistryConfig();
      const validation = validateEvaluationDatasetManifest(config);
      res.json({
        config,
        validation,
        datasets: getModelRegistryOverview().datasets,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/platform/storage-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      res.json({
        mode: await getVideoStorageMode(),
        isAdmin,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/platform/pose-landmarker-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      res.json({
        model: await getPoseLandmarkerModel(userId),
        isAdmin,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const handleDriveMovementClassificationModelSettingsGet = async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const settings = await getDriveMovementClassificationModelSettings(userId);
      res.json({
        ...settings,
        isAdmin,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  app.get("/api/platform/drive-movement-classification-model-settings", requireAuth, handleDriveMovementClassificationModelSettingsGet);
  app.get("/api/platform/classification-model-settings", requireAuth, handleDriveMovementClassificationModelSettingsGet);

  const handleDriveMovementClassificationModelSettingsPut = async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const modelKey = String(req.body?.modelKey || "").trim();
      if (!modelKey) {
        return res.status(400).json({ error: "modelKey is required" });
      }

      await setDriveMovementClassificationModelSelection(modelKey, userId);
      res.json({ modelKey });
    } catch (error: any) {
      if (String(error?.message || "") === "Unknown drive movement classification model") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  };

  app.put("/api/platform/drive-movement-classification-model-settings", requireAuth, handleDriveMovementClassificationModelSettingsPut);
  app.put("/api/platform/classification-model-settings", requireAuth, handleDriveMovementClassificationModelSettingsPut);

  const handleDriveMovementClassificationModelOptionsPut = async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const rawOptions = Array.isArray(req.body?.options) ? req.body.options : null;
      if (!rawOptions) {
        return res.status(400).json({ error: "options must be an array" });
      }

      const options = await setDriveMovementClassificationModelOptions(rawOptions, userId);
      res.json({ options });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  app.put("/api/platform/drive-movement-classification-model-settings/options", requireAuth, handleDriveMovementClassificationModelOptionsPut);
  app.put("/api/platform/classification-model-settings/options", requireAuth, handleDriveMovementClassificationModelOptionsPut);

  app.put("/api/platform/pose-landmarker-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const model = String(req.body?.model || "").trim().toLowerCase();
      if (!isPoseLandmarkerModel(model)) {
        return res.status(400).json({ error: "model must be one of lite, full, or heavy" });
      }

      await setPoseLandmarkerModel(model, userId);
      res.json({ model });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/platform/validation-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      res.json({
        mode: await getVideoValidationMode(userId),
        isAdmin,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/platform/validation-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const mode = String(req.body?.mode || "").trim().toLowerCase();
      if (!isVideoValidationMode(mode)) {
        return res.status(400).json({ error: "mode must be one of disabled, light, medium, or full" });
      }

      await setVideoValidationMode(mode, userId);
      res.json({ mode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/platform/analysis-fps-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const settings = await getAnalysisFpsSettings(userId);
      res.json({
        ...settings,
        isAdmin,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/platform/analysis-fps-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const lowImpactStep = String(req.body?.lowImpactStep ?? req.body?.lowImpactMode ?? "").trim().toLowerCase();
      const highImpactStep = String(req.body?.highImpactStep ?? req.body?.highImpactMode ?? "").trim().toLowerCase();
      const tennisAutoDetectUsesHighImpact = Boolean(req.body?.tennisAutoDetectUsesHighImpact);
      const tennisMatchPlayUsesHighImpact = Boolean(req.body?.tennisMatchPlayUsesHighImpact);

      if (!isAnalysisFpsStep(lowImpactStep)) {
        return res.status(400).json({ error: "lowImpactStep must be one of step1, step2, or step3" });
      }

      if (!isAnalysisFpsStep(highImpactStep)) {
        return res.status(400).json({ error: "highImpactStep must be one of step1, step2, or step3" });
      }

      const settings = {
        lowImpactStep,
        highImpactStep,
        tennisAutoDetectUsesHighImpact,
        tennisMatchPlayUsesHighImpact,
      };
      await setAnalysisFpsSettings(settings, userId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/platform/sports-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const allSports = await listSports({ includeDisabled: true });
      res.json({
        sports: allSports.map(mapSportForApi),
        isAdmin,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/platform/sports-settings/:sportId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const enabled = Boolean(req.body?.enabled);
  const sportId = getRouteParam(req.params.sportId);
  const sport = await getSportById(sportId);
      if (!sport) {
        return res.status(404).json({ error: "Sport not found" });
      }

      const allSports = await listSports({ includeDisabled: true });
      const enabledCount = allSports.filter((item) => isSportEnabledRecord(item)).length;
      if (!enabled && isSportEnabledRecord(sport) && enabledCount <= 1) {
        return res.status(400).json({ error: "At least one sport must remain enabled" });
      }

      const [updatedSport] = await db
        .update(sports)
        .set({
          enabled,
          isActive: enabled,
          ...buildUpdateAuditFields(userId),
        })
        .where(eq(sports.id, sport.id))
        .returning();

      res.json(mapSportForApi(updatedSport));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/platform/storage-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const mode = String(req.body?.mode || "").trim().toLowerCase();
      if (mode !== "filesystem" && mode !== "r2") {
        return res.status(400).json({ error: "mode must be filesystem or r2" });
      }

      await setVideoStorageMode(mode, userId);
      res.json({ mode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scoring-model/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const dashboard = await buildScoringModelDashboard(
        userId,
        isAdmin,
        String(req.query.movementName || ""),
        String(req.query.playerId || ""),
      );

      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/model-training/tennis", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      res.json(await getTennisTrainingStatus());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/model-training/tennis/dataset-insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      res.json(await getTennisDatasetInsights({
        playerId: req.query.playerId ? String(req.query.playerId) : null,
        startDate: req.query.startDate ? String(req.query.startDate) : null,
        endDate: req.query.endDate ? String(req.query.endDate) : null,
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/model-training/tennis/train", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const status = await getTennisTrainingStatus();
      if (status.currentJob && (status.currentJob.status === "queued" || status.currentJob.status === "running")) {
        return res.status(409).json({ error: "A tennis training job is already running.", status });
      }

      const queuedStatus = await queueTennisTrainingJob(userId);
      res.status(202).json(queuedStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/model-training/tennis/save-version", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const status = await getTennisTrainingStatus();
      if (status.currentJob && (status.currentJob.status === "queued" || status.currentJob.status === "running")) {
        return res.status(409).json({ error: "Wait for the current tennis training job to finish before saving a version." });
      }

      res.json(await saveCurrentTennisModelVersion(userId, {
        modelVersion: req.body?.modelVersion,
        description: req.body?.description,
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports", async (req: Request, res: Response) => {
    try {
      const includeDisabled = String(req.query.includeDisabled || "").trim().toLowerCase() === "true";
      const allSports = await listSports({ includeDisabled });
      res.json(allSports.map(mapSportForApi));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports/:sportId/movements", async (req: Request, res: Response) => {
    try {
      const sportId = getRouteParam(req.params.sportId);
      const movements = await db
        .select()
        .from(sportMovements)
        .where(eq(sportMovements.sportId, sportId))
        .orderBy(asc(sportMovements.sortOrder));
      res.json(movements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sport-configs", async (_req: Request, res: Response) => {
    try {
      const allConfigs = getAllConfigs();
      const rangeRows = await fetchMetricRangeRows();
      const rangeRowsByConfig = new Map<string, Array<typeof sportCategoryMetricRanges.$inferSelect>>();

      for (const row of rangeRows) {
        const list = rangeRowsByConfig.get(row.configKey) || [];
        list.push(row);
        rangeRowsByConfig.set(row.configKey, list);
      }

      const resolvedConfigs = Object.fromEntries(
        Object.entries(allConfigs).map(([key, config]) => {
          const rows = rangeRowsByConfig.get(key) || [];
          return [key, applyDbRangesToConfig(config, rows)];
        }),
      );

      res.json(resolvedConfigs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sport-configs/:configKey", async (req: Request, res: Response) => {
    try {
      const configKey = getRouteParam(req.params.configKey);
      const config = getSportConfig(configKey);
      if (!config) {
        return res.status(404).json({ error: "Sport config not found" });
      }

      const rangeRows = await fetchMetricRangeRows({
        configKey,
      });

      res.json(applyDbRangesToConfig(config, rangeRows));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/metric-optimal-ranges", async (req: Request, res: Response) => {
    try {
      const configKey = String(req.query.configKey || "").trim();
      const sportName = String(req.query.sportName || "").trim();
      const movementName = String(req.query.movementName || "").trim();
      const metricKey = String(req.query.metricKey || "").trim();

      const rows = await fetchMetricRangeRows({
        configKey: configKey || undefined,
        sportName: sportName || undefined,
        movementName: movementName || undefined,
        metricKey: metricKey || undefined,
      });

      res.json(rows.map(normalizeMetricRangeRow));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/metric-optimal-ranges", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const configKey = String(req.body?.configKey || "").trim();
      const metricKey = String(req.body?.metricKey || "").trim();
      const sportName = String(req.body?.sportName || "").trim();
      const movementName = String(req.body?.movementName || "").trim();
      const metricLabel = String(req.body?.metricLabel || metricKey).trim();
      const unit = String(req.body?.unit || "").trim();
      const optimalMinRaw = Number(req.body?.optimalMin);
      const optimalMaxRaw = Number(req.body?.optimalMax);
      const isActive = req.body?.isActive == null ? true : Boolean(req.body?.isActive);

      if (!configKey || !metricKey || !sportName || !movementName || !unit) {
        return res.status(400).json({
          error: "configKey, metricKey, sportName, movementName, and unit are required",
        });
      }

      if (!Number.isFinite(optimalMinRaw) || !Number.isFinite(optimalMaxRaw)) {
        return res.status(400).json({ error: "optimalMin and optimalMax must be numbers" });
      }

      const optimalMin = normalizeMetricValueToTenScale(metricKey, optimalMinRaw);
      const optimalMax = normalizeMetricValueToTenScale(metricKey, optimalMaxRaw);
      const normalizedUnit = normalizeMetricUnit(metricKey, unit);

      if (optimalMin > optimalMax) {
        return res.status(400).json({ error: "optimalMin cannot be greater than optimalMax" });
      }

      await db
        .insert(sportCategoryMetricRanges)
        .values({
          configKey,
          metricKey,
          sportName,
          movementName,
          metricLabel,
          unit: normalizedUnit,
          optimalMin,
          optimalMax,
          isActive,
          source: "admin",
          ...buildInsertAuditFields(userId),
        })
        .onConflictDoUpdate({
          target: [sportCategoryMetricRanges.configKey, sportCategoryMetricRanges.metricKey],
          set: {
            sportName,
            movementName,
            metricLabel,
            unit: normalizedUnit,
            optimalMin,
            optimalMax,
            isActive,
            source: "admin",
            ...buildUpdateAuditFields(userId),
          },
        });

      const rows = await fetchMetricRangeRows({ configKey, metricKey, includeInactive: true });
      res.json(rows[0] ? normalizeMetricRangeRow(rows[0]) : null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/metric-optimal-ranges/bulk", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!itemsRaw || itemsRaw.length === 0) {
        return res.status(400).json({ error: "items array is required" });
      }

      type BulkItem = {
        configKey: string;
        metricKey: string;
        sportName: string;
        movementName: string;
        metricLabel: string;
        unit: string;
        optimalMin: number;
        optimalMax: number;
        isActive: boolean;
      };

      const items: BulkItem[] = [];

      for (let idx = 0; idx < itemsRaw.length; idx += 1) {
        const raw = (itemsRaw[idx] || {}) as Record<string, unknown>;
        const configKey = String(raw.configKey || "").trim();
        const metricKey = String(raw.metricKey || "").trim();
        const sportName = String(raw.sportName || "").trim();
        const movementName = String(raw.movementName || "").trim();
        const metricLabel = String(raw.metricLabel || metricKey).trim();
        const unit = String(raw.unit || "").trim();
        const optimalMinRaw = Number(raw.optimalMin);
        const optimalMaxRaw = Number(raw.optimalMax);
        const isActive = raw.isActive == null ? true : Boolean(raw.isActive);

        if (!configKey || !metricKey || !sportName || !movementName || !unit) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: configKey, metricKey, sportName, movementName, and unit are required`,
          });
        }

        if (!Number.isFinite(optimalMinRaw) || !Number.isFinite(optimalMaxRaw)) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: optimalMin and optimalMax must be numbers`,
          });
        }

        const optimalMin = normalizeMetricValueToTenScale(metricKey, optimalMinRaw);
        const optimalMax = normalizeMetricValueToTenScale(metricKey, optimalMaxRaw);
        const normalizedUnit = normalizeMetricUnit(metricKey, unit);

        if (optimalMin > optimalMax) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: optimalMin cannot be greater than optimalMax`,
          });
        }

        items.push({
          configKey,
          metricKey,
          sportName,
          movementName,
          metricLabel,
          unit: normalizedUnit,
          optimalMin,
          optimalMax,
          isActive,
        });
      }

      for (const item of items) {
        await db
          .insert(sportCategoryMetricRanges)
          .values({
            configKey: item.configKey,
            metricKey: item.metricKey,
            sportName: item.sportName,
            movementName: item.movementName,
            metricLabel: item.metricLabel,
            unit: item.unit,
            optimalMin: item.optimalMin,
            optimalMax: item.optimalMax,
            isActive: item.isActive,
            source: "admin",
            ...buildInsertAuditFields(userId),
          })
          .onConflictDoUpdate({
            target: [sportCategoryMetricRanges.configKey, sportCategoryMetricRanges.metricKey],
            set: {
              sportName: item.sportName,
              movementName: item.movementName,
              metricLabel: item.metricLabel,
              unit: item.unit,
              optimalMin: item.optimalMin,
              optimalMax: item.optimalMax,
              isActive: item.isActive,
              source: "admin",
              ...buildUpdateAuditFields(userId),
            },
          });
      }

      const uniqueConfigKeys = Array.from(new Set(items.map((item) => item.configKey)));
      const rows = await db
        .select()
        .from(sportCategoryMetricRanges)
        .where(
          and(
            inArray(sportCategoryMetricRanges.configKey, uniqueConfigKeys),
            eq(sportCategoryMetricRanges.isActive, true),
          ),
        )
        .orderBy(
          asc(sportCategoryMetricRanges.configKey),
          asc(sportCategoryMetricRanges.metricKey),
        );

      res.json({
        updated: items.length,
        configKeys: uniqueConfigKeys,
        rows,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    "/api/upload",
    requireAuth,
    (req, _res, next) => {
      (req as Request & { uploadStartMs?: number }).uploadStartMs = Date.now();
      next();
    },
    runVideoUploadMiddleware,
    async (req: Request, res: Response) => {
      let finalPathToCleanup: string | null = null;
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }

        const storageMode = await getVideoStorageMode();

        const requesterUserId = req.session.userId!;

        const targetUserIdRaw = String(req.body?.targetUserId || "").trim();
        let userId = requesterUserId;
        if (targetUserIdRaw) {
          const [targetUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, targetUserIdRaw));
          if (!targetUser) {
            return res.status(400).json({ error: "Selected player not found" });
          }
          userId = targetUser.id;
        }
        const sportId = req.body?.sportId || null;
        const movementId = req.body?.movementId || null;
        const requestedSessionTypeRaw = String(req.body?.requestedSessionType || "").trim().toLowerCase();
        const requestedFocusKeyRaw = String(req.body?.requestedFocusKey || "").trim().toLowerCase();
        const recordedAtRaw = String(req.body?.recordedAt || "").trim();
        const recordedAtOverride = parseUploadRecordedAt(recordedAtRaw);
        const requestedSessionType =
          requestedSessionTypeRaw === "practice" || requestedSessionTypeRaw === "match-play"
            ? requestedSessionTypeRaw
            : null;
        const requestedFocusKey =
          requestedFocusKeyRaw === "auto-detect"
            || requestedFocusKeyRaw === "forehand"
            || requestedFocusKeyRaw === "backhand"
            || requestedFocusKeyRaw === "serve"
            || requestedFocusKeyRaw === "volley"
            || requestedFocusKeyRaw === "game"
            ? requestedFocusKeyRaw
            : null;

        if (recordedAtRaw && !recordedAtOverride) {
          return res.status(400).json({ error: "Invalid session date/time provided" });
        }

        if (recordedAtOverride && recordedAtOverride.getTime() > Date.now() + 60_000) {
          return res.status(400).json({ error: "Session date/time cannot be in the future" });
        }

        let resolvedSportId: string | null = null;
        let resolvedMovementId: string | null = null;
        let resolvedSportName = "";
        let resolvedMovementName = "";

        if (sportId) {
          const sport = await getSportById(sportId);
          if (sport) {
            if (!isSportEnabledRecord(sport)) {
              return res.status(400).json({ error: `${sport.name} is not enabled yet.` });
            }
            resolvedSportId = sport.id;
            resolvedSportName = sport.name;
          }
        }

        if (movementId) {
          const [movement] = await db
            .select()
            .from(sportMovements)
            .where(eq(sportMovements.id, movementId));

          if (movement && (!resolvedSportId || movement.sportId === resolvedSportId)) {
            resolvedMovementId = movement.id;
            resolvedMovementName = movement.name;
            if (!resolvedSportId) {
              resolvedSportId = movement.sportId;
              const movementSport = await getSportById(movement.sportId);
              if (movementSport) {
                if (!isSportEnabledRecord(movementSport)) {
                  return res.status(400).json({ error: `${movementSport.name} is not enabled yet.` });
                }
                resolvedSportName = movementSport.name;
              }
            }
          }
        }

        if (!resolvedSportId && !resolvedSportName) {
          const enabledPrimarySport = await getEnabledPrimarySport();
          if (enabledPrimarySport) {
            resolvedSportId = enabledPrimarySport.id;
            resolvedSportName = enabledPrimarySport.name;
          }
        }

        const finalFilename = req.file.filename
          || `${randomUUID().toUpperCase()}${path.extname(req.file.originalname || "") || ".mp4"}`;
        const finalPath = storageMode === "r2"
          ? await storeVideoBuffer({
              buffer: req.file.buffer,
              contentType: req.file.mimetype,
              filename: finalFilename,
            })
          : (normalizeStoredVideoPath(req.file.path) || finalFilename);
        finalPathToCleanup = finalPath;
        const uploadStartedAtMs = Number((req as Request & { uploadStartMs?: number }).uploadStartMs);
        const uploadCompletedAtMs = Date.now();
        const sourceFilename = null;
        const evaluationVideoId = null;

        const extractedMetadata = await withLocalMediaFile(finalPath, finalFilename, async (localPath) =>
          extractVideoMetadata(localPath)
        );
        const resolvedCapturedAt = recordedAtOverride || extractedMetadata.capturedAt || new Date();
        const uploadMetadata = {
          ...extractedMetadata,
          capturedAt: resolvedCapturedAt,
        };

        if (resolvedSportName && !isPrimaryEnabledSportName(resolvedSportName)) {
          await deleteStoredMedia(finalPathToCleanup);
          finalPathToCleanup = null;
          return res.status(400).json({ error: "Only tennis videos are allowed to be uploaded." });
        }

        const analysis = await storage.createAnalysis(
          finalFilename,
          finalPath,
          userId,
          resolvedSportId,
          resolvedMovementId,
          requestedSessionType,
          requestedFocusKey,
          uploadMetadata,
          sourceFilename,
          evaluationVideoId,
          requesterUserId,
        );
        finalPathToCleanup = null;

        try {
          await seedUploadPipelineTiming(
            analysis.id,
            {
              startedAt: Number.isFinite(uploadStartedAtMs)
                ? new Date(uploadStartedAtMs).toISOString()
                : null,
              completedAt: new Date(uploadCompletedAtMs).toISOString(),
              elapsedMs: Number.isFinite(uploadStartedAtMs)
                ? Math.max(uploadCompletedAtMs - uploadStartedAtMs, 0)
                : null,
            },
            {
              configKey: getConfigKey(resolvedSportName || "tennis", resolvedMovementName || "auto-detect"),
              modelVersion: readModelRegistryConfig().activeModelVersion,
              auditActorUserId: requesterUserId,
            },
          );
        } catch (timingError) {
          console.warn("Failed to seed upload pipeline timing:", timingError);
        }

        processAnalysis(analysis.id).catch(console.error);

        res.json({
          id: analysis.id,
          status: analysis.status,
          message: "Video uploaded successfully. Processing started.",
        });
      } catch (error: any) {
        console.error("Upload error:", error);
        if (finalPathToCleanup) {
          try {
            await deleteStoredMedia(finalPathToCleanup);
          } catch (cleanupError) {
            console.warn("Failed to clean up rejected upload:", cleanupError);
          }
        }
        res.status(500).json({ error: error.message || "Upload failed" });
      }
    },
  );

  app.get("/api/analyses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const sportId = req.query.sportId as string | undefined;

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);

      const allAnalyses = isAdmin
        ? await storage.getAllAnalyses(null, sportId)
        : await storage.getAllAnalyses(userId, sportId);
      res.json(allAnalyses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const includeAll = isAdmin && String(req.query.includeAll || "").trim().toLowerCase() === "true";
      const traceId = String(req.query.traceId || "").trim();
      let traceModelVersion: string | null = null;

      let traceAnalysisIds: string[] | null = null;
      if (traceId) {
        const [requestedRun] = await db
          .select()
          .from(analysisRecalculationRuns)
          .where(eq(analysisRecalculationRuns.traceId, traceId))
          .limit(1);

        if (!requestedRun) {
          return res.json([]);
        }

        traceModelVersion = String(requestedRun.selectedModelVersion || "").trim() || null;

        if (!isAdmin && requestedRun.requestedByUserId !== userId) {
          return res.status(403).json({ error: "You do not have access to this recalculation trace" });
        }

        const runItems = await db
          .select({ analysisId: analysisRecalculationRunItems.analysisId })
          .from(analysisRecalculationRunItems)
          .where(eq(analysisRecalculationRunItems.traceId, traceId));

        traceAnalysisIds = runItems.map((item) => item.analysisId);
        if (!traceAnalysisIds.length) {
          return res.json([]);
        }
      }

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);

      const query = db
        .select({
          id: analyses.id,
          userId: analyses.userId,
          sportId: analyses.sportId,
          movementId: analyses.movementId,
          requestedSessionType: analyses.requestedSessionType,
          requestedFocusKey: analyses.requestedFocusKey,
          sportName: sports.name,
          movementName: sportMovements.name,
          videoFilename: analyses.videoFilename,
          sourceFilename: analyses.sourceFilename,
          evaluationVideoId: analyses.evaluationVideoId,
          videoPath: analyses.videoPath,
          status: analyses.status,
          detectedMovement: analyses.detectedMovement,
          rejectionReason: analyses.rejectionReason,
          capturedAt: analyses.capturedAt,
          createdAt: analyses.createdAt,
          updatedAt: analyses.updatedAt,
          userName: users.name,
          overallScore: metrics.overallScore,
          metricValues: metrics.metricValues,
          scoreOutputs: metrics.scoreOutputs,
          configKey: metrics.configKey,
          modelVersion: metrics.modelVersion,
          metricUpdatedAt: metrics.updatedAt,
        })
        .from(analyses)
        .leftJoin(users, eq(analyses.userId, users.id))
        .leftJoin(sports, eq(analyses.sportId, sports.id))
        .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
        .leftJoin(metrics, eq(analyses.id, metrics.analysisId));

      const whereClauses = [];
      if (!isAdmin) {
        whereClauses.push(eq(analyses.userId, userId));
      }
      if (traceAnalysisIds) {
        whereClauses.push(inArray(analyses.id, traceAnalysisIds));
      }

      const filteredQuery = whereClauses.length ? query.where(and(...whereClauses)) : query;
      const rows = await filteredQuery.orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);

      const dedupedRows = Array.from(
        rows.reduce((acc, row) => {
          const existing = acc.get(row.id);
          if (!existing) {
            acc.set(row.id, row);
            return acc;
          }

          const existingMatchesTraceModel = traceModelVersion && existing.modelVersion === traceModelVersion;
          const nextMatchesTraceModel = traceModelVersion && row.modelVersion === traceModelVersion;
          if (nextMatchesTraceModel && !existingMatchesTraceModel) {
            acc.set(row.id, row);
            return acc;
          }
          if (existingMatchesTraceModel && !nextMatchesTraceModel) {
            return acc;
          }

          const existingMetricUpdatedAt = existing.metricUpdatedAt ? new Date(existing.metricUpdatedAt).getTime() : 0;
          const nextMetricUpdatedAt = row.metricUpdatedAt ? new Date(row.metricUpdatedAt).getTime() : 0;
          if (nextMetricUpdatedAt > existingMetricUpdatedAt) {
            acc.set(row.id, row);
            return acc;
          }

          if (!existing.modelVersion && row.modelVersion) {
            acc.set(row.id, row);
          }

          return acc;
        }, new Map<string, (typeof rows)[number]>()),
      ).map(([, row]) => row);

      const normalizedRows = dedupedRows.map((row) => {
        const normalized = normalizeScoreRow(row);
        return {
          ...normalized,
          sectionScores: computeSummarySectionScores({
            scoreOutputs: row.scoreOutputs,
          }),
        };
      });

      if (isAdmin && !includeAll) {
        return res.json(await Promise.all(normalizedRows.map((row) => attachVideoUrl(row))));
      }

      res.json(await Promise.all(normalizedRows.map((row) => attachVideoUrl(row))));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/coach/ask", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const question = String(req.body?.question || "").trim();
      const sportName = String(req.body?.sportName || "").trim();
      const movementName = String(req.body?.movementName || "").trim();
      const requestedPlayerId = String(req.body?.playerId || "").trim();

      if (!question) {
        return res.status(400).json({ error: "question is required" });
      }

      const targetPlayerId =
        isAdmin && requestedPlayerId && requestedPlayerId.toLowerCase() !== "all"
          ? requestedPlayerId
          : userId;

      const rows = await db
        .select({
          id: analyses.id,
          userId: analyses.userId,
          status: analyses.status,
          videoFilename: analyses.videoFilename,
          detectedMovement: analyses.detectedMovement,
          capturedAt: analyses.capturedAt,
          createdAt: analyses.createdAt,
          overallScore: metrics.overallScore,
          scoreOutputs: metrics.scoreOutputs,
          configKey: metrics.configKey,
        })
        .from(analyses)
        .leftJoin(metrics, eq(analyses.id, metrics.analysisId))
        .where(eq(analyses.userId, targetPlayerId))
        .orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);

      const sportFilter = normalizeFilterToken(sportName);
      const movementFilter = normalizeFilterToken(movementName);

      const filtered = rows.filter((row) => {
        const config = String(row.configKey || "").toLowerCase();
        if (sportFilter && config && !config.startsWith(sportFilter)) return false;

        if (!movementFilter || movementFilter === "auto-detect") return true;
        const detected = normalizeFilterToken(row.detectedMovement);
        const configFlat = normalizeFilterToken(config);
        return detected.includes(movementFilter) || configFlat.includes(movementFilter);
      });

      const scored = filtered
        .map((row) => normalizeScoreRow(row))
        .filter((row) => row.status === "completed" && typeof row.overallScore === "number")
        .map((row) => ({ ...row, overallScore: Number(row.overallScore) }));

      if (!scored.length) {
        return res.json({
          answer:
            "I do not have completed scored sessions for this filter yet. Upload and complete at least one analysis, then ask again for trend and drill guidance.",
          confidence: "low",
          dataWindowSessions: 0,
          citations: {
            totalSessions: 0,
          },
        });
      }

      const recent = scored.slice(0, 7);
      const recentThree = scored.slice(0, 3).map((r) => r.overallScore);
      const previousThree = scored.slice(3, 6).map((r) => r.overallScore);
      const recentAvg = mean(recentThree);
      const previousAvg = mean(previousThree);
      const overallDelta =
        recentAvg !== null && previousAvg !== null ? round1(recentAvg - previousAvg) : null;

      const metricKeys = ["power", "control", "timing", "technique"] as const;
      const metricSummary = metricKeys.map((key) => {
        const latest = readSubScoreValue(scored[0]?.scoreOutputs, key);
        const recentMetric = scored
          .slice(0, 3)
          .map((r) => readSubScoreValue(r.scoreOutputs, key))
          .filter((v): v is number => v !== null);
        const prevMetric = scored
          .slice(3, 6)
          .map((r) => readSubScoreValue(r.scoreOutputs, key))
          .filter((v): v is number => v !== null);
        const delta =
          recentMetric.length && prevMetric.length
            ? round1((mean(recentMetric) || 0) - (mean(prevMetric) || 0))
            : null;
        return { key, latest, delta };
      });

      const weakest = [...metricSummary]
        .filter((m) => m.latest !== null)
        .sort((a, b) => Number(a.latest) - Number(b.latest))
        .slice(0, 2);

      const movementBucket = new Map<string, number[]>();
      for (const row of scored.slice(0, 15)) {
        const label = getMovementLabel(row);
        const list = movementBucket.get(label) || [];
        list.push(Number(row.overallScore));
        movementBucket.set(label, list);
      }

      const topMovements = Array.from(movementBucket.entries())
        .map(([movement, values]) => ({ movement, avg: round1(mean(values) || 0), sessions: values.length }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 2);

      const q = question.toLowerCase();
      const asksWhy = /why|drop|decline|down|worse/.test(q);
      const asksPlan = /plan|today|train|improve|drill|practice/.test(q);
      const asksCompare = /compare|versus|vs|forehand|backhand|serve/.test(q);

      const parts: string[] = [];
      parts.push(
        `Based on your last ${recent.length} scored sessions, your latest overall score is ${Math.round(
          scored[0].overallScore,
        )}${overallDelta === null ? "" : ` and your short-term trend is ${overallDelta >= 0 ? "+" : ""}${overallDelta}.`}`,
      );

      if (asksWhy) {
        const downMetrics = metricSummary
          .filter((m) => m.delta !== null && m.delta < 0)
          .sort((a, b) => Number(a.delta) - Number(b.delta))
          .slice(0, 2);
        if (downMetrics.length) {
          parts.push(
            `The likely drivers are ${downMetrics
              .map((m) => `${formatMetricName(m.key)} (${m.delta})`)
              .join(" and ")}.`,
          );
        } else {
          parts.push("No major metric decline is visible in the recent window.");
        }
      }

      if (asksCompare && topMovements.length >= 2) {
        parts.push(
          `Movement comparison: ${topMovements[0].movement} averages ${topMovements[0].avg} over ${topMovements[0].sessions} sessions, while ${topMovements[1].movement} averages ${topMovements[1].avg} over ${topMovements[1].sessions} sessions.`,
        );
      }

      if (asksPlan || !asksWhy) {
        if (weakest.length) {
          const drillLines = weakest
            .map((metric) => `${formatMetricName(metric.key)}: ${getDrillForMetric(metric.key)}`)
            .join(" ");
          parts.push(`Suggested next session plan: ${drillLines}`);
        }
      }

      parts.push("Use this as coaching guidance from your own data, not medical advice.");

      res.json({
        answer: parts.join("\n\n"),
        confidence: scored.length >= 7 ? "high" : scored.length >= 3 ? "medium" : "low",
        dataWindowSessions: recent.length,
        citations: {
          totalSessions: scored.length,
          latestOverallScore: Math.round(scored[0].overallScore),
          overallDelta,
          weakestMetrics: weakest.map((m) => m.key),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to answer question" });
    }
  });

  app.get("/api/analyses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      const [analysisUser] = analysis.userId
        ? await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, analysis.userId))
            .limit(1)
        : [null];

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(analysisId);
      const insights = await storage.getCoachingInsights(analysisId);

      let selectedMovementName: string | null = null;
      if (analysis.movementId) {
        const [movement] = await db
          .select()
          .from(sportMovements)
          .where(eq(sportMovements.id, analysis.movementId));
        if (movement) {
          selectedMovementName = movement.name;
        }
      }

      const normalizedMetricsData = metricsData
        ? {
            ...metricsData,
            metricValues: normalizeMetricValuesForApi((metricsData as any).metricValues),
          }
        : null;

      res.json({
        analysis: await attachVideoUrl({
          ...analysis,
          userName: analysisUser?.name || null,
        }),
        metrics: normalizedMetricsData,
        coaching: insights || null,
        selectedMovementName,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/score-inputs", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(analysisId);
      if (!metricsData) {
        return res.status(404).json({ error: "Metrics not found for analysis" });
      }

      return res.json({
        analysisId,
        configKey: metricsData.configKey || null,
        modelVersion: metricsData.modelVersion || null,
        scoreInputs: (metricsData as any).scoreInputs || null,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch score inputs" });
    }
  });

  app.get("/api/analyses/:id/improved-tennis", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      let sportName = "tennis";
      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
        if (sport?.name) sportName = String(sport.name).toLowerCase();
      }

      if (sportName !== "tennis") {
        return res.status(400).json({ error: "Improved analysis is available for Tennis only" });
      }

      const metricsData = await storage.getMetrics(analysisId);

      const tacticalComponents = metricsData?.scoreOutputs && typeof metricsData.scoreOutputs === "object"
        ? ((metricsData.scoreOutputs as Record<string, unknown>).tactical as Record<string, unknown> | undefined)?.components ?? null
        : null;

      const baseMetricValues = (metricsData?.metricValues || {}) as Record<string, unknown>;
      const inputMetrics = {
        ...baseMetricValues,
      };

      const report = buildImprovedTennisReportFromMetrics(
        analysis.requestedSessionType,
        metricsData?.configKey,
        analysis.detectedMovement,
        inputMetrics,
        tacticalComponents,
        metricsData?.overallScore,
        metricsData?.aiDiagnostics,
      );

      return res.json({
        analysisId: analysis.id,
        sport: "tennis",
        report,
        inputMetrics,
        diagnosticsAvailable: false,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to build improved tennis analysis" });
    }
  });

  app.get("/api/shot-annotations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const rows = isAdmin
        ? await db
            .select()
            .from(analysisShotAnnotations)
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(1000)
        : await db
            .select()
            .from(analysisShotAnnotations)
            .where(eq(analysisShotAnnotations.userId, userId))
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(300);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/shot-annotation", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const whereClause = isAdmin
        ? eq(analysisShotAnnotations.analysisId, analysisId)
        : and(
            eq(analysisShotAnnotations.analysisId, analysisId),
            eq(analysisShotAnnotations.userId, userId),
          );

      const [annotation] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(whereClause as any)
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      if (!annotation) {
        return res.json(null);
      }

      res.json(annotation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/shot-annotation", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only annotate your own analyses" });
      }

      const totalShotsNum = Number(req.body?.totalShots);
      const orderedShotLabels = Array.isArray(req.body?.orderedShotLabels)
        ? req.body.orderedShotLabels.map((value: unknown) => String(value || "").trim()).filter(Boolean)
        : [];
      const usedForScoringShotIndexes = parseIntegerList(req.body?.usedForScoringShotIndexes);
      const includeInTraining = parseBooleanWithDefault(req.body?.includeInTraining, true);
      const notes = req.body?.notes ? String(req.body.notes) : null;

      if (!Number.isFinite(totalShotsNum) || totalShotsNum < 0) {
        return res.status(400).json({ error: "totalShots must be a non-negative number" });
      }

      if (orderedShotLabels.length !== Math.trunc(totalShotsNum)) {
        return res.status(400).json({
          error: "orderedShotLabels length must match totalShots",
        });
      }

      const [existing] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, analysisId),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(analysisShotAnnotations)
          .set({
            totalShots: Math.trunc(totalShotsNum),
            orderedShotLabels,
            usedForScoringShotIndexes,
            includeInTraining,
            notes,
            ...buildUpdateAuditFields(userId),
          })
          .where(eq(analysisShotAnnotations.id, existing.id));
      } else {
        await db.insert(analysisShotAnnotations).values({
          analysisId,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          includeInTraining,
          notes,
          ...buildInsertAuditFields(userId),
        });
      }

      const [saved] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, analysisId),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      const { sportName, movementName } = await resolveSportAndMovementNames(analysis);
      const dominantProfile = await resolveUserDominantProfile(analysis.userId);

      const manualLabels = (saved?.orderedShotLabels || orderedShotLabels).map((label) =>
        normalizeShotLabel(label),
      );

      const movementForManifest = String(
        analysis.detectedMovement || movementName || "unknown",
      )
        .trim()
        .toLowerCase();

      try {
        const syncResult = await syncVideoForModelTuning({
          sourceVideoPath: analysis.videoPath,
          sourceVideoFilename: analysis.videoFilename,
          movementType: movementForManifest,
          enabled: true,
          videoId: analysis.evaluationVideoId || undefined,
          analysisId: analysis.id,
          annotatorUserId: userId,
          actorUserId: userId,
        });

        if (syncResult.videoId !== analysis.evaluationVideoId) {
          await db
            .update(analyses)
            .set({
              evaluationVideoId: syncResult.videoId,
              ...buildUpdateAuditFields(userId),
            })
            .where(eq(analyses.id, analysis.id));
        }
      } catch (manifestError: any) {
        return res.status(500).json({
          error:
            manifestError?.message ||
            "Failed to sync model training dataset state",
        });
      }

      let discrepancySnapshotUpdated = false;
      try {
        const modelConfig = readModelRegistryConfig();
        const autoLabels = await resolveAutoLabelsForAnalysis(
          analysis,
          sportName,
          movementName,
          manualLabels,
          dominantProfile,
        );
        const snapshot = computeDiscrepancySnapshot(autoLabels, manualLabels);

        await db
          .insert(analysisShotDiscrepancies)
          .values({
            analysisId: analysis.id,
            userId,
            videoName: analysis.videoFilename,
            sportName,
            movementName,
            modelVersion: modelConfig.activeModelVersion,
            autoShots: snapshot.autoShots,
            manualShots: snapshot.manualShots,
            mismatches: snapshot.mismatches,
            mismatchRatePct: snapshot.mismatchRatePct,
            labelMismatches: snapshot.labelMismatches,
            countMismatch: snapshot.countMismatch,
            confusionPairs: snapshot.confusionPairs,
            ...buildInsertAuditFields(userId),
          })
          .onConflictDoUpdate({
            target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId, analysisShotDiscrepancies.modelVersion],
            set: {
              videoName: analysis.videoFilename,
              sportName,
              movementName,
              modelVersion: modelConfig.activeModelVersion,
              autoShots: snapshot.autoShots,
              manualShots: snapshot.manualShots,
              mismatches: snapshot.mismatches,
              mismatchRatePct: snapshot.mismatchRatePct,
              labelMismatches: snapshot.labelMismatches,
              countMismatch: snapshot.countMismatch,
              confusionPairs: snapshot.confusionPairs,
              ...buildUpdateAuditFields(userId),
            },
          });
        discrepancySnapshotUpdated = true;
      } catch (snapshotError) {
        console.warn("Discrepancy snapshot update failed:", snapshotError);
      }

      res.json({
        ...(saved || {
          analysisId: analysis.id,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          includeInTraining,
          notes,
        }),
        discrepancySnapshotUpdated,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/shot-report", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      if (!analysis.videoPath) {
        return res.status(404).json({ error: "Video file not found" });
      }

      let sportName = "tennis";
      let movementName = "auto-detect";

      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }

      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }

      const dominantProfile = await resolveUserDominantProfile(analysis.userId);
      const diagnostics = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => runPythonDiagnostics(
          localPath,
          sportName,
          movementName,
          dominantProfile,
        ),
      );

      const diagnosticsDetected = String(diagnostics?.detectedMovement || "").trim();
      if (
        diagnosticsDetected &&
        normalizeMovementToken(diagnosticsDetected) !== normalizeMovementToken(analysis.detectedMovement)
      ) {
        await db
          .update(analyses)
          .set({ detectedMovement: diagnosticsDetected, updatedAt: new Date() })
          .where(eq(analyses.id, analysis.id));
      }

      const [manualAnnotation] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, analysisId),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      res.json({
        analysisId,
        totalShots: diagnostics?.shotsDetected ?? 0,
        shots: diagnostics?.shotSegments ?? [],
        shotsUsedForScoring: diagnostics?.shotSegments?.filter((s: any) => s.includedForScoring) ?? [],
        manualAnnotation: manualAnnotation || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/discrepancy-summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const sportFilter = String(req.query.sportName || "").trim().toLowerCase();
      const movementFilter = normalizeMovementToken(req.query.movementName || "");
      const playerFilter = String(req.query.playerId || "").trim();
      const normalizedPlayerFilter = playerFilter.toLowerCase();
      const applyPlayerFilter = isAdmin && !!playerFilter && normalizedPlayerFilter !== "all";

      const analysisRows = isAdmin
        ? await db
            .select({
              analysis: analyses,
              sportName: sports.name,
              movementName: sportMovements.name,
              metricValues: metrics.metricValues,
            })
            .from(analyses)
            .leftJoin(sports, eq(analyses.sportId, sports.id))
            .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
            .leftJoin(metrics, eq(metrics.analysisId, analyses.id))
        : await db
            .select({
              analysis: analyses,
              sportName: sports.name,
              movementName: sportMovements.name,
              metricValues: metrics.metricValues,
            })
            .from(analyses)
            .leftJoin(sports, eq(analyses.sportId, sports.id))
            .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
            .leftJoin(metrics, eq(metrics.analysisId, analyses.id))
            .where(eq(analyses.userId, userId));

      const filteredAnalysesForRate = analysisRows.filter((row) => {
        if (row.analysis.status !== "completed") return false;
        if (applyPlayerFilter && row.analysis.userId !== playerFilter) return false;

        if (sportFilter) {
          const rowSport = String(row.sportName || "").trim().toLowerCase();
          if (rowSport && rowSport !== sportFilter) return false;
        }

        if (movementFilter) {
          const rowMovement = normalizeMovementToken(
            row.movementName || row.analysis.detectedMovement || "",
          );
          if (rowMovement !== movementFilter) return false;
        }

        return true;
      });

      const analysisDateById = new Map(
        filteredAnalysesForRate.map((row) => {
          const videoDate = row.analysis.capturedAt || row.analysis.createdAt;
          return [row.analysis.id, videoDate] as const;
        }),
      );

      const analysisShotCountById = new Map(
        filteredAnalysesForRate.map((row) => [
          row.analysis.id,
          readShotCountFromMetricValues(row.metricValues),
        ] as const),
      );

      const dayTotalShots = new Map<string, number>();
      for (const row of filteredAnalysesForRate) {
        const videoDate = row.analysis.capturedAt || row.analysis.createdAt;
        const dayKey = videoDate.toISOString().slice(0, 10);
        const shotCount = analysisShotCountById.get(row.analysis.id) || 0;
        dayTotalShots.set(dayKey, (dayTotalShots.get(dayKey) || 0) + shotCount);
      }

      const rows = isAdmin
        ? await db
            .select({
              annotation: analysisShotAnnotations,
              analysis: analyses,
              userName: sql<string | null>`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
              sportName: sports.name,
              movementName: sportMovements.name,
            })
            .from(analysisShotAnnotations)
            .innerJoin(analyses, eq(analysisShotAnnotations.analysisId, analyses.id))
            .leftJoin(sports, eq(analyses.sportId, sports.id))
            .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(200)
        : await db
            .select({
              annotation: analysisShotAnnotations,
              analysis: analyses,
              userName: sql<string | null>`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
              sportName: sports.name,
              movementName: sportMovements.name,
            })
            .from(analysisShotAnnotations)
            .innerJoin(analyses, eq(analysisShotAnnotations.analysisId, analyses.id))
            .leftJoin(sports, eq(analyses.sportId, sports.id))
            .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
            .where(eq(analysisShotAnnotations.userId, userId))
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(30);

      const filteredRows = rows.filter((row) => {
        if (applyPlayerFilter && row.analysis.userId !== playerFilter) return false;
        if (!sportFilter) return true;
        const rowSport = String(row.sportName || "").trim().toLowerCase();
        if (!rowSport) return true;
        return rowSport === sportFilter;
      }).filter((row) => {
        if (!movementFilter) return true;
        const rowMovement = normalizeMovementToken(
          row.movementName || row.analysis.detectedMovement || "",
        );
        return rowMovement === movementFilter;
      });

      const existingSnapshots = isAdmin
        ? await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(eq(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion))
        : await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(
              and(
                eq(analysisShotDiscrepancies.userId, userId),
                eq(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion),
              ),
            );

      const snapshotByAnalysisId = new Map(
        existingSnapshots.map((item) => [`${item.analysisId}:${item.userId}:${item.modelVersion}`, item]),
      );

      const topVideos: Array<{
        analysisId: string;
        videoName: string;
        userName: string | null;
        createdAt: string;
        sportName: string;
        movementName: string;
        autoShots: number;
        manualShots: number;
        mismatches: number;
        mismatchRatePct: number;
      }> = [];

      const confusionMap = new Map<string, number>();
      const dayTotalMismatches = new Map<string, number>();
      const analysisHasMismatch = new Map<string, boolean>();
      let videosAnnotated = 0;
      let totalManualShots = 0;
      let totalMismatches = 0;

      for (const row of filteredRows) {
        const annotation = row.annotation;
        const analysis = row.analysis;
        const sportName = row.sportName || "Tennis";
        const movementName = row.movementName || analysis.detectedMovement || "forehand";

        const annotationOwnerId = annotation.userId;
        const snapshotKey = `${analysis.id}:${annotationOwnerId}:${modelConfig.activeModelVersion}`;
        let snapshot = snapshotByAnalysisId.get(snapshotKey);
        if (!snapshot) {
          const modelConfig = readModelRegistryConfig();
          const manualLabels = (annotation.orderedShotLabels || []).map((label) =>
            normalizeShotLabel(label),
          );
          const autoLabels = await resolveAutoLabelsForAnalysis(
            analysis,
            sportName,
            movementName,
            manualLabels,
            await resolveUserDominantProfile(analysis.userId),
          );
          const computed = computeDiscrepancySnapshot(autoLabels, manualLabels);

          await db
            .insert(analysisShotDiscrepancies)
            .values({
              analysisId: analysis.id,
              userId: annotationOwnerId,
              videoName: analysis.videoFilename,
              sportName,
              movementName,
              modelVersion: modelConfig.activeModelVersion,
              autoShots: computed.autoShots,
              manualShots: computed.manualShots,
              mismatches: computed.mismatches,
              mismatchRatePct: computed.mismatchRatePct,
              labelMismatches: computed.labelMismatches,
              countMismatch: computed.countMismatch,
              confusionPairs: computed.confusionPairs,
            })
            .onConflictDoUpdate({
              target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId, analysisShotDiscrepancies.modelVersion],
              set: {
                videoName: analysis.videoFilename,
                sportName,
                movementName,
                modelVersion: modelConfig.activeModelVersion,
                autoShots: computed.autoShots,
                manualShots: computed.manualShots,
                mismatches: computed.mismatches,
                mismatchRatePct: computed.mismatchRatePct,
                labelMismatches: computed.labelMismatches,
                countMismatch: computed.countMismatch,
                confusionPairs: computed.confusionPairs,
                updatedAt: new Date(),
              },
            });

          const [fresh] = await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(
              and(
                eq(analysisShotDiscrepancies.analysisId, analysis.id),
                eq(analysisShotDiscrepancies.userId, annotationOwnerId),
                eq(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion),
              ),
            )
            .limit(1);

          snapshot = fresh;
          if (snapshot) {
            snapshotByAnalysisId.set(snapshotKey, snapshot);
          }
        }

        if (!snapshot) continue;

        videosAnnotated += 1;
        totalManualShots += Number(snapshot.manualShots || 0);
        totalMismatches += Number(snapshot.mismatches || 0);

        const confusionPairs = Array.isArray(snapshot.confusionPairs)
          ? snapshot.confusionPairs
          : [];
        for (const pair of confusionPairs) {
          const key = `${normalizeShotLabel(pair.from)}=>${normalizeShotLabel(pair.to)}`;
          confusionMap.set(key, (confusionMap.get(key) || 0) + Number(pair.count || 0));
        }

        const manualShots = Number(snapshot.manualShots || 0);
        const mismatches = Number(snapshot.mismatches || 0);
        const hasMismatch = mismatches > 0;
        const previous = analysisHasMismatch.get(analysis.id) || false;
        if (hasMismatch && !previous) {
          analysisHasMismatch.set(analysis.id, true);
        } else if (!analysisHasMismatch.has(analysis.id)) {
          analysisHasMismatch.set(analysis.id, false);
        }

        const videoDate = analysisDateById.get(analysis.id) || analysis.capturedAt || analysis.createdAt;
        const dayKey = videoDate.toISOString().slice(0, 10);
        dayTotalMismatches.set(
          dayKey,
          (dayTotalMismatches.get(dayKey) || 0) + mismatches,
        );

        topVideos.push({
          analysisId: analysis.id,
          videoName: analysis.videoFilename,
          userName: row.userName || null,
          createdAt: videoDate.toISOString(),
          sportName,
          movementName,
          autoShots: Number(snapshot.autoShots || 0),
          manualShots: Number(snapshot.manualShots || 0),
          mismatches: Number(snapshot.mismatches || 0),
          mismatchRatePct: Number(snapshot.mismatchRatePct || 0),
        });
      }

      const rankedVideos = [...topVideos].sort((a, b) => {
        if (b.mismatchRatePct !== a.mismatchRatePct) {
          return b.mismatchRatePct - a.mismatchRatePct;
        }
        return b.mismatches - a.mismatches;
      });

      const labelConfusions = Array.from(confusionMap.entries())
        .map(([pair, count]) => {
          const [from, to] = pair.split("=>");
          return { from, to, count };
        })
        .filter((item) => {
          if (!movementFilter) return true;
          return (
            normalizeMovementToken(item.from) === movementFilter ||
            normalizeMovementToken(item.to) === movementFilter
          );
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const totalVideosConsidered = filteredAnalysesForRate.length;
      const videosWithDiscrepancy = Array.from(analysisHasMismatch.values()).filter(Boolean).length;
      const totalShots = Array.from(analysisShotCountById.values()).reduce(
        (sum, shotCount) => sum + shotCount,
        0,
      );
      const mismatchRatePct = Number(
        ((totalMismatches / Math.max(totalShots, 1)) * 100).toFixed(1),
      );

      const trend7d: Array<{ day: string; mismatchRatePct: number }> = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - offset);
        const dayKey = date.toISOString().slice(0, 10);
        const totalShotsForDay = dayTotalShots.get(dayKey) || 0;
        const mismatchesForDay = dayTotalMismatches.get(dayKey) || 0;
        const dayRate = totalShotsForDay
          ? Number(((mismatchesForDay / Math.max(totalShotsForDay, 1)) * 100).toFixed(1))
          : 0;
        trend7d.push({ day: dayKey, mismatchRatePct: dayRate });
      }

      res.json({
        summary: {
          videosAnnotated,
          totalVideosConsidered,
          videosWithDiscrepancy,
          totalShots,
          totalManualShots,
          totalMismatches,
          mismatchRatePct,
        },
        trend7d,
        topVideos: rankedVideos,
        labelConfusions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/diagnostics", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const forceRefresh = String(req.query.refresh || "") === "1";
      const [metricRow] = await db
        .select({ aiDiagnostics: metrics.aiDiagnostics })
        .from(metrics)
        .where(eq(metrics.analysisId, analysis.id))
        .limit(1);

      const persistedDiagnostics =
        metricRow?.aiDiagnostics && typeof metricRow.aiDiagnostics === "object"
          ? metricRow.aiDiagnostics
          : null;

      if (persistedDiagnostics && !forceRefresh) {
        return res.json(persistedDiagnostics);
      }

      if (!analysis.videoPath) {
        return res.status(404).json({ error: "Video file not found" });
      }

      let sportName = "tennis";
      let movementName = "auto-detect";

      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }

      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }

      const dominantProfile = await resolveUserDominantProfile(analysis.userId);
      const diagnostics = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => runPythonDiagnostics(
          localPath,
          sportName,
          movementName,
          dominantProfile,
        ),
      );

      const refreshedDiagnostics = (() => {
        const pipelineTiming = extractPipelineTiming(persistedDiagnostics);
        const diagnosticsRecord = diagnostics && typeof diagnostics === "object"
          ? (diagnostics as Record<string, unknown>)
          : {};
        const validationScreening = persistedDiagnostics && typeof persistedDiagnostics === "object"
          ? (persistedDiagnostics as Record<string, unknown>).validationScreening
          : null;
        const diagnosticsWithValidation = validationScreening == null
          ? diagnosticsRecord
          : {
            ...diagnosticsRecord,
            validationScreening,
          };
        if (!pipelineTiming) return diagnosticsWithValidation;
        return attachPipelineTiming(diagnosticsWithValidation, pipelineTiming);
      })();

      await db
        .update(metrics)
        .set({ aiDiagnostics: refreshedDiagnostics })
        .where(eq(metrics.analysisId, analysis.id));

      invalidateSkeletonCache(analysis.id);

      const diagnosticsDetected = String(diagnostics?.detectedMovement || "").trim();
      if (
        diagnosticsDetected &&
        normalizeMovementToken(diagnosticsDetected) !== normalizeMovementToken(analysis.detectedMovement)
      ) {
        await db
          .update(analyses)
          .set({ detectedMovement: diagnosticsDetected, updatedAt: new Date() })
          .where(eq(analyses.id, analysis.id));
      }

      res.json(refreshedDiagnostics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/skeleton/shot/:shotId", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const shotId = Number(req.params.shotId);
      if (!Number.isInteger(shotId) || shotId <= 0) {
        return res.status(400).json({ error: "shotId must be a positive integer" });
      }

      const startFrame = req.query.startFrame != null ? Number(req.query.startFrame) : undefined;
      const endFrame = req.query.endFrame != null ? Number(req.query.endFrame) : undefined;

      const shotSkeleton = await getShotSkeleton(analysis.id, shotId, startFrame, endFrame);
      if (!shotSkeleton) {
        return res.status(404).json({ error: "Skeleton data not found for shot" });
      }

      return res.json(shotSkeleton);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch shot skeleton" });
    }
  });

  app.get("/api/analyses/:id/skeleton/shot/:shotId/playback", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const shotId = Number(req.params.shotId);
      if (!Number.isInteger(shotId) || shotId <= 0) {
        return res.status(400).json({ error: "shotId must be a positive integer" });
      }

      const startFrame = req.query.startFrame != null ? Number(req.query.startFrame) : undefined;
      const endFrame = req.query.endFrame != null ? Number(req.query.endFrame) : undefined;

      const playbackData = await getShotSkeleton(analysis.id, shotId, startFrame, endFrame);
      if (!playbackData) {
        return res.status(404).json({ error: "Skeleton playback data not found" });
      }

      return res.json(playbackData);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch skeleton playback data" });
    }
  });

  app.get("/api/analyses/:id/skeleton/shot/:shotId/frame/:frameNumber", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const shotId = Number(req.params.shotId);
      const frameNumber = Number(req.params.frameNumber);
      if (!Number.isInteger(shotId) || shotId <= 0) {
        return res.status(400).json({ error: "shotId must be a positive integer" });
      }
      if (!Number.isInteger(frameNumber) || frameNumber <= 0) {
        return res.status(400).json({ error: "frameNumber must be a positive integer" });
      }

      const frameSkeleton = await getFrameSkeleton(analysis.id, shotId, frameNumber);
      if (!frameSkeleton) {
        return res.status(404).json({ error: "Skeleton data not found for frame" });
      }

      return res.json(frameSkeleton);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch frame skeleton" });
    }
  });

  app.get("/api/analyses/:id/ghost-correction/:shotId", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const shotId = Number(req.params.shotId);
      if (!Number.isInteger(shotId) || shotId <= 0) {
        return res.status(400).json({ error: "shotId must be a positive integer" });
      }

      const shotSkeleton = await getShotSkeleton(analysis.id, shotId);
      if (!shotSkeleton || !shotSkeleton.frames.length) {
        return res.status(404).json({ error: "Skeleton data not found for shot" });
      }

      const [metricsRow] = await db
        .select({
          metricValues: metrics.metricValues,
          configKey: metrics.configKey,
        })
        .from(metrics)
        .where(eq(metrics.analysisId, analysis.id))
        .limit(1);

      if (!metricsRow) {
        return res.status(404).json({ error: "Metrics not found" });
      }

      const configKey = String(metricsRow.configKey || "").trim();
      const sportConfig = configKey ? getSportConfig(configKey) : undefined;
      if (!sportConfig) {
        return res.status(404).json({ error: "Sport config not found" });
      }

      const metricValues =
        metricsRow.metricValues && typeof metricsRow.metricValues === "object"
          ? (metricsRow.metricValues as Record<string, number>)
          : {};

      const metricsWithRanges = sportConfig.metrics.filter((m) => m.optimalRange);

      let bestMetricKey: string | null = null;
      let maxDeviation = 0;

      for (const def of metricsWithRanges) {
        const value = Number(metricValues[def.key]);
        if (!Number.isFinite(value) || !def.optimalRange) continue;

        const [lo, hi] = def.optimalRange;
        const rangeSpan = Math.max(hi - lo, 1e-6);
        let deviation = 0;

        if (value < lo) deviation = (lo - value) / rangeSpan;
        else if (value > hi) deviation = (value - hi) / rangeSpan;

        if (deviation > maxDeviation) {
          maxDeviation = deviation;
          bestMetricKey = def.key;
        }
      }

      if (!bestMetricKey) {
        return res.json({
          frames: shotSkeleton.frames,
          correction: null,
          metricValues,
          configKey,
        });
      }

      const bestDef = sportConfig.metrics.find((m) => m.key === bestMetricKey)!;
      const playerValue = Number(metricValues[bestMetricKey]);
      const [lo, hi] = bestDef.optimalRange!;

      return res.json({
        frames: shotSkeleton.frames,
        correction: {
          metricKey: bestMetricKey,
          label: bestDef.label,
          unit: bestDef.unit,
          playerValue,
          optimalRange: [lo, hi],
          deviation: maxDeviation,
          direction: playerValue < lo ? "increase" : "decrease",
        },
        metricValues,
        configKey,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch ghost correction data" });
    }
  });

  app.get("/api/analyses/:id/video-metadata", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      if (!analysis.videoPath) {
        return res.status(404).json({ error: "Video file not found" });
      }

      const extractedMetadata = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => extractVideoMetadata(localPath),
      );
      return res.json(extractedMetadata || {});
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to extract video metadata" });
    }
  });

  app.get("/api/analyses/:id/comparison", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(analysisId);

      const periodMap: Record<string, number | null> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "all": null,
      };
      const period = (req.query.period as string) || "30d";
      if (!(period in periodMap)) {
        return res.status(400).json({ error: "Invalid period. Use 7d, 30d, 90d, or all." });
      }
      const periodDays = periodMap[period];

      const result = await storage.getHistoricalMetricAverages(
        analysis.userId!,
        new Date(analysis.capturedAt || analysis.createdAt),
        periodDays,
        analysis.sportId,
        metricsData?.configKey || null,
      );

      res.json(result);
    } catch (error: any) {
      console.error("Comparison error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/metric-trends", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(analysisId);
      if (!metricsData) {
        return res.json({ period: "30d", points: [] });
      }

      const periodMap: Record<string, number | null> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "all": null,
      };
      const period = (req.query.period as string) || "30d";
      if (!(period in periodMap)) {
        return res.status(400).json({ error: "Invalid period. Use 7d, 30d, 90d, or all." });
      }
      const periodDays = periodMap[period];

      const baseDate = new Date(analysis.capturedAt || analysis.createdAt);
      const conditions = [
        eq(analyses.status, "completed"),
        eq(metrics.configKey, metricsData.configKey),
        sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) <= ${baseDate}`,
      ];

      if (analysis.userId) {
        conditions.push(eq(analyses.userId, analysis.userId));
      }

      if (analysis.sportId) {
        conditions.push(eq(analyses.sportId, analysis.sportId));
      }

      if (periodDays !== null) {
        const startDate = new Date(baseDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
        conditions.push(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) >= ${startDate}`);
      }

      const rows = await db
        .select({
          analysisId: analyses.id,
          videoFilename: analyses.videoFilename,
          sourceFilename: analyses.sourceFilename,
          videoContentHash: analyses.videoContentHash,
          capturedAt: analyses.capturedAt,
          createdAt: analyses.createdAt,
          overallScore: metrics.overallScore,
          scoreOutputs: metrics.scoreOutputs,
          metricValues: metrics.metricValues,
        })
        .from(analyses)
        .innerJoin(metrics, eq(analyses.id, metrics.analysisId))
        .where(and(...conditions))
        .orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) asc`);

      const points = rows.map((row) => {
        const normalized = normalizeScoreRow(row);
        const sectionScores = computeSummarySectionScores({
          scoreOutputs: row.scoreOutputs,
        });
        return {
        analysisId: row.analysisId,
        videoFilename: row.videoFilename,
        sourceFilename: row.sourceFilename,
        videoContentHash: row.videoContentHash,
        capturedAt: (row.capturedAt || row.createdAt).toISOString(),
        overallScore:
          typeof normalized.overallScore === "number" && Number.isFinite(normalized.overallScore)
            ? Number(normalized.overallScore)
            : null,
        subScores: normalizeTacticalScoresToApi100(
          (row.scoreOutputs as Record<string, unknown> | null | undefined) || null,
        ) as Record<string, number | null>,
        sectionScores,
        scoreOutputs:
          row.scoreOutputs && typeof row.scoreOutputs === "object"
            ? (row.scoreOutputs as Record<string, unknown>)
            : null,
        metricValues:
          row.metricValues && typeof row.metricValues === "object"
            ? normalizeMetricValuesForApi(row.metricValues)
            : {},
        };
      });

      res.json({
        period,
        points,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/recalculate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const requestedModelVersion = normalizeModelVersionToken(req.body?.modelVersion);
      const useDraftModel = req.body?.useDraftModel === true || String(req.body?.useDraftModel || "").toLowerCase() === "true";

      if (!isAdmin && (requestedModelVersion || useDraftModel)) {
        return res.status(403).json({ error: "Admin access required to select a recalculation model version" });
      }

      let selectedModelVersion = readModelRegistryConfig().activeModelVersion;
      let selectedModelSource: "active" | "saved" | "draft" = "active";
      let classificationModelSelection: { selectedModelKey: string; modelVersion: string } | null = null;

      if (isAdmin && (requestedModelVersion || useDraftModel)) {
        const status = await getTennisTrainingStatus();
        const savedVersions = new Set<string>([
          status.activeVersion,
          ...status.history
            .map((entry) => normalizeModelVersionToken(entry.savedModelVersion))
            .filter((value): value is string => Boolean(value)),
        ]);
        const hasDraftCandidate = status.history.some((entry) => entry.status === "succeeded" && !entry.savedModelVersion);

        if (useDraftModel) {
          if (!requestedModelVersion) {
            return res.status(400).json({ error: "modelVersion is required when selecting a draft model" });
          }
          if (requestedModelVersion !== status.draftVersion) {
            return res.status(400).json({ error: `Draft model ${requestedModelVersion} is not the current draft version (${status.draftVersion})` });
          }
          if (!hasDraftCandidate) {
            return res.status(400).json({ error: "Draft model artifact is not available yet. Train a new model before recalculating with draft." });
          }

          await ensureLocalClassificationModelArtifact({
            selectedModelKey: "tennis-active",
            modelVersion: requestedModelVersion,
          });

          selectedModelVersion = requestedModelVersion;
          selectedModelSource = "draft";
          classificationModelSelection = {
            selectedModelKey: "tennis-active",
            modelVersion: requestedModelVersion,
          };
        } else if (requestedModelVersion) {
          if (!savedVersions.has(requestedModelVersion)) {
            return res.status(400).json({ error: `Saved model version ${requestedModelVersion} is not available` });
          }

          const shouldPinSavedArtifact = requestedModelVersion !== status.activeVersion || hasDraftCandidate;
          if (shouldPinSavedArtifact) {
            await ensureLocalClassificationModelArtifact({
              selectedModelKey: `tennis-version:${requestedModelVersion}`,
              modelVersion: requestedModelVersion,
            });

            classificationModelSelection = {
              selectedModelKey: `tennis-version:${requestedModelVersion}`,
              modelVersion: requestedModelVersion,
            };
            selectedModelSource = "saved";
          }

          selectedModelVersion = requestedModelVersion;
        }
      }

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);
      const rawAnalyses = isAdmin
        ? await storage.getAllAnalyses(null)
        : await storage.getAllAnalyses(userId);
      const storageMode = await getVideoStorageMode();
      const userAnalyses = rawAnalyses;

      type UploadCandidate = {
        filename: string;
        fullPath: string;
        ext: string;
        mtimeMs: number;
      };

      const videoExts = new Set([".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"]);

      const collectUploadVideoFiles = (root: string): UploadCandidate[] => {
        const collected: UploadCandidate[] = [];
        const walk = (dir: string) => {
          let entries: fs.Dirent[] = [];
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
              continue;
            }
            if (!entry.isFile()) {
              continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            if (!videoExts.has(ext)) {
              continue;
            }

            try {
              const stats = fs.statSync(fullPath);
              collected.push({
                filename: entry.name,
                fullPath,
                ext,
                mtimeMs: stats.mtimeMs,
              });
            } catch {
              continue;
            }
          }
        };

        walk(root);
        return collected;
      };

      const uploadFiles = collectUploadVideoFiles(uploadDir);

      const existingPaths = new Set(
        userAnalyses
          .filter((analysis) => analysis.videoPath && isStoredMediaLocallyAccessible(analysis.videoPath))
          .map((analysis) => getStoredMediaLocalPath(analysis.videoPath))
          .filter((localPath): localPath is string => Boolean(localPath))
          .map((localPath) => path.resolve(localPath)),
      );

      const unassignedUploadFiles = new Map(
        uploadFiles
          .filter((file) => !existingPaths.has(path.resolve(file.fullPath)))
          .map((file) => [path.resolve(file.fullPath), file] as const),
      );

      const runnableAnalyses: typeof userAnalyses = [];
      let autoRelinkedAnalyses = 0;
      const skippedDetails: Array<{ id: string; reason: string; filename: string }> = [];

      for (const analysis of userAnalyses) {
        if (analysis.videoPath && (storageMode === "r2" || isStoredMediaLocallyAccessible(analysis.videoPath))) {
          runnableAnalyses.push(analysis);
          continue;
        }

        if (storageMode === "r2") {
          skippedDetails.push({
            id: analysis.id,
            reason: "Video reference is missing from configured storage",
            filename: path.basename(analysis.videoFilename || ""),
          });
          continue;
        }

        const currentFilename = path.basename(analysis.videoFilename || "");
        const exactNameCandidate = currentFilename
          ? [...unassignedUploadFiles.values()].find((f) => f.filename === currentFilename)
          : undefined;

        if (exactNameCandidate && fs.existsSync(exactNameCandidate.fullPath)) {
          const normalizedVideoPath = normalizeStoredVideoPath(exactNameCandidate.fullPath) || exactNameCandidate.filename;
          await db
            .update(analyses)
            .set({
              videoFilename: exactNameCandidate.filename,
              videoPath: normalizedVideoPath,
              updatedAt: new Date(),
            })
            .where(eq(analyses.id, analysis.id));

          runnableAnalyses.push({
            ...analysis,
            videoFilename: exactNameCandidate.filename,
            videoPath: normalizedVideoPath,
          });
          unassignedUploadFiles.delete(path.resolve(exactNameCandidate.fullPath));
          autoRelinkedAnalyses += 1;
          continue;
        }

        const originalExt = path.extname(currentFilename).toLowerCase();
        let candidates = [...unassignedUploadFiles.values()].filter((file) => {
          if (!originalExt) return true;
          return file.ext === originalExt;
        });

        if (candidates.length === 0) {
          candidates = [...unassignedUploadFiles.values()];
        }

        if (candidates.length === 0) {
          skippedDetails.push({
            id: analysis.id,
            reason: "No unassigned files found in uploads",
            filename: currentFilename,
          });
          continue;
        }

        const analysisCreatedAt = new Date(analysis.createdAt).getTime();
        const bestCandidate = candidates
          .map((file) => ({
            file,
            delta: Math.abs(file.mtimeMs - analysisCreatedAt),
          }))
          .sort((a, b) => a.delta - b.delta)[0]?.file;

        if (!bestCandidate) {
          skippedDetails.push({
            id: analysis.id,
            reason: "Could not find a relink candidate",
            filename: currentFilename,
          });
          continue;
        }

        const normalizedVideoPath = normalizeStoredVideoPath(bestCandidate.fullPath) || bestCandidate.filename;

        await db
          .update(analyses)
          .set({
            videoFilename: bestCandidate.filename,
            videoPath: normalizedVideoPath,
            updatedAt: new Date(),
          })
          .where(eq(analyses.id, analysis.id));

        unassignedUploadFiles.delete(path.resolve(bestCandidate.fullPath));
        runnableAnalyses.push({
          ...analysis,
          videoFilename: bestCandidate.filename,
          videoPath: normalizedVideoPath,
        });
        autoRelinkedAnalyses += 1;
      }

      const ids = runnableAnalyses.map((analysis) => analysis.id);
      const traceId = randomUUID();
      const annotationRows = ids.length
        ? await db
            .select({
              analysisId: analysisShotAnnotations.analysisId,
              userId: analysisShotAnnotations.userId,
            })
            .from(analysisShotAnnotations)
            .where(inArray(analysisShotAnnotations.analysisId, ids))
        : [];
      const analysesWithAnnotationsQueued = new Set(
        annotationRows.map((row) => row.analysisId),
      ).size;

      await db.insert(analysisRecalculationRuns).values({
        traceId,
        requestedByUserId: userId,
        scope: isAdmin ? "all" : "user",
        selectedModelVersion,
        selectedModelSource,
      });

      if (ids.length > 0) {
        await db.insert(analysisRecalculationRunItems).values(
          ids.map((analysisId) => ({
            traceId,
            analysisId,
          })),
        );
      }

      if (ids.length > 0) {
        await db
          .update(analyses)
          .set({
            status: "processing",
            rejectionReason: null,
            updatedAt: new Date(),
          })
          .where(inArray(analyses.id, ids));
      }

      void (async () => {
        for (const id of ids) {
          try {
            await processAnalysis(id, {
              forceFreshDiagnostics: true,
              classificationModelSelection,
            });
            const snapshotResult = await refreshDiscrepancySnapshotsForAnalysis(id, {
              modelVersion: selectedModelVersion,
              classificationModelSelection,
            });
            if (snapshotResult.refreshed > 0 || snapshotResult.skipped > 0) {
              console.log(
                `Discrepancy refresh for ${id}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}, modelVersion=${selectedModelVersion}`,
              );
            }
          } catch (err) {
            console.error(`Recalculate failed for ${id}:`, err);
          }
        }
      })();

      res.json({
        traceId,
        message: "Recalculation started",
        scope: isAdmin ? "all" : "user",
        totalAnalyses: userAnalyses.length,
        queuedAnalyses: ids.length,
        queuedAnalysisIds: ids,
        autoRelinkedAnalyses,
        skippedAnalyses: userAnalyses.length - ids.length,
        skippedDetails,
        willRefreshDiscrepancies: true,
        queuedDiscrepancySnapshots: annotationRows.length,
        analysesWithAnnotationsQueued,
        selectedModelVersion,
        selectedModelSource,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/relink-and-recalculate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const analysisId = getRouteParam(req.params.id);
      const filename = (req.body?.filename || "").toString().trim();
      const storageMode = await getVideoStorageMode();

      if (storageMode === "r2") {
        return res.status(400).json({ error: "Relink is only available when videoStorageMode is filesystem" });
      }

      if (!filename) {
        return res.status(400).json({ error: "filename is required" });
      }

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only relink your own analyses" });
      }

      const safeFilename = path.basename(filename);
      const relinkedPath = path.join(uploadDir, safeFilename);
      const normalizedVideoPath = normalizeStoredVideoPath(relinkedPath) || safeFilename;

      if (!fs.existsSync(relinkedPath)) {
        return res.status(404).json({ error: "File not found in uploads folder" });
      }

      await db
        .update(analyses)
        .set({
          videoFilename: safeFilename,
          videoPath: normalizedVideoPath,
          ...buildUpdateAuditFields(userId),
        })
        .where(eq(analyses.id, analysisId));

      const relinkAnnotationRows = await db
        .select({
          analysisId: analysisShotAnnotations.analysisId,
          userId: analysisShotAnnotations.userId,
        })
        .from(analysisShotAnnotations)
        .where(eq(analysisShotAnnotations.analysisId, analysisId));

      void (async () => {
        try {
          await processAnalysis(analysisId, { forceFreshDiagnostics: true });
          const snapshotResult = await refreshDiscrepancySnapshotsForAnalysis(analysisId);
          if (snapshotResult.refreshed > 0 || snapshotResult.skipped > 0) {
            console.log(
              `Discrepancy refresh for ${analysisId}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}`,
            );
          }
        } catch (err) {
          console.error(`Relink+recalculate failed for ${analysisId}:`, err);
        }
      })();

      res.json({
        message: "Relinked and recalculation started",
        analysisId,
        filename: safeFilename,
        willRefreshDiscrepancies: true,
        queuedDiscrepancySnapshots: relinkAnnotationRows.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/retry", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const analysisId = getRouteParam(req.params.id);

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only retry your own analyses" });
      }

      if (analysis.status === "pending" || analysis.status === "processing") {
        return res.status(409).json({ error: "Analysis is already processing" });
      }

      void (async () => {
        try {
          await processAnalysis(analysisId);
          const snapshotResult = await refreshDiscrepancySnapshotsForAnalysis(analysisId);
          if (snapshotResult.refreshed > 0 || snapshotResult.skipped > 0) {
            console.log(
              `Retry discrepancy refresh for ${analysisId}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}`,
            );
          }
        } catch (err) {
          console.error(`Retry failed for ${analysisId}:`, err);
        }
      })();

      res.json({
        message: "Retry started",
        analysisId,
        status: "processing",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const [feedback] = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, analysisId),
            eq(analysisFeedback.userId, req.session.userId!),
          ),
        )
        .limit(1);
      res.json(feedback || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const { rating, comment } = req.body;
      if (!rating || !["up", "down"].includes(rating)) {
        return res.status(400).json({ error: "Rating must be 'up' or 'down'" });
      }

      const existing = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, analysisId),
            eq(analysisFeedback.userId, req.session.userId!),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(analysisFeedback)
          .set({
            rating,
            comment: comment || null,
            ...buildUpdateAuditFields(req.session.userId!),
          })
          .where(eq(analysisFeedback.id, existing[0].id));
      } else {
        await db.insert(analysisFeedback).values({
          analysisId,
          userId: req.session.userId!,
          rating,
          comment: comment || null,
          ...buildInsertAuditFields(req.session.userId!),
        });
      }

      const [feedback] = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, analysisId),
            eq(analysisFeedback.userId, req.session.userId!),
          ),
        )
        .limit(1);
      res.json(feedback);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/analyses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = getRouteParam(req.params.id);
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (analysis.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only delete your own analyses" });
      }

      await deleteStoredMedia(analysis.videoPath);

      await storage.deleteAnalysis(analysisId);
      res.json({ message: "Analysis deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
