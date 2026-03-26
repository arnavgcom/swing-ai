import { db } from "./db";
import { analyses, appSettings, metrics, coachingInsights, sportMovements, sports, users } from "@shared/schema";
import { and, desc, eq, isNotNull, ne, or } from "drizzle-orm";
import { spawn } from "child_process";
import { createHash } from "crypto";
import { getConfigKey, getSportConfig } from "@shared/sport-configs";
import {
  attachPipelineTiming,
  extractPipelineTiming,
  isPipelineStageKey,
  updatePipelineTiming,
  type PipelineStageKey,
  type PipelineStageStatus,
  type PipelineTiming,
} from "@shared/pipeline-timing";
import { normalizeMetricValueToTenScale } from "@shared/metric-scale";
import {
  isVideoValidationMode,
  type ValidationScreeningSnapshot,
  type VideoValidationMode,
} from "@shared/video-validation";
import { readModelRegistryConfig } from "./model-registry";
import {
  toPersistedScoreTen,
} from "./score-scale";
import { buildScoreInputsPayload } from "./score-input-params";
import { buildScoreOutputsPayload } from "./score-output-params";
import { extractStandardizedTacticalScores10 } from "./tactical-scores";
import fs from "fs";
import path from "path";
import type { AiDiagnosticsPayload, ScoreInputsPayload, ScoreOutputsPayload } from "@shared/schema";
import { withLocalMediaFile } from "./media-storage";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import { PROJECT_ROOT, resolveProjectPath } from "./env";
import {
  getTennisUploadValidationSampleCount,
  validateTennisVideoUpload,
} from "./tennis-upload-validation";
import { getEnabledPrimarySport, getSportById, isSportEnabledRecord } from "./sport-availability";
import {
  getDriveMovementClassificationModelPythonEnv,
  getDriveMovementClassificationModelPythonEnvForSelection,
} from "./classification-model-settings";
import { getPoseLandmarkerPythonEnv } from "./pose-landmarker-settings";

type ClassificationModelExecutionSelection = {
  selectedModelKey: string;
  modelVersion?: string | null;
};

interface PythonResult {
  configKey: string;
  overallScore: number;
  subScores: Record<string, number>;
  metricValues: Record<string, number>;
  analysisArtifactPath?: string;
  shotCount?: number;
  shotSpeed?: number;
  coaching: {
    keyStrength: string;
    improvementArea: string;
    trainingSuggestion: string;
    simpleExplanation: string;
  };
  detectedMovement?: string;
  movementOverridden?: boolean;
  userSelectedMovement?: string;
  rejected?: boolean;
  rejectionReason?: string;
  error?: string;
}

interface PythonMetricEnrichmentResult {
  configKey?: string;
  metricValues: Record<string, number>;
  error?: string;
}

type AnalysisFpsMode = "3fps" | "6fps" | "12fps" | "15fps" | "24fps" | "30fps" | "full";
type AnalysisFpsStep = "step1" | "step2" | "step3";

const VIDEO_VALIDATION_MODE_KEY = "videoValidationMode";
const ANALYSIS_FPS_MODE_KEY = "analysisFpsMode";
const ASYNC_METRIC_ENRICHMENT_KEYS_BY_CONFIG: Record<string, string[]> = {
  "tennis-forehand": ["elbowAngle"],
  "tennis-backhand": ["elbowAngle"],
  "tennis-volley": ["rhythmConsistency"],
  "tennis-game": ["rallyLength"],
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

function shouldUseCoreMetricComputation(configKey: string): boolean {
  return String(configKey || "").trim().toLowerCase().startsWith("tennis-");
}

function hasPendingAsyncMetricEnrichment(configKey: string, metricValues: Record<string, unknown> | null | undefined): boolean {
  const requiredKeys = ASYNC_METRIC_ENRICHMENT_KEYS_BY_CONFIG[configKey] || [];
  if (!requiredKeys.length) return false;
  return requiredKeys.some((key) => !Number.isFinite(Number(metricValues?.[key])));
}

function buildValidationScreeningSnapshot(validationMode: VideoValidationMode): ValidationScreeningSnapshot {
  const uploadGuardSampleCount = getTennisUploadValidationSampleCount(validationMode);
  return {
    uploadGuardMode: validationMode,
    uploadGuardApplied: uploadGuardSampleCount != null,
    uploadGuardSampleCount,
    pipelineValidationMode: validationMode,
    pipelineValidationApplied: validationMode !== "disabled",
  };
}

function mergeValidationScreeningSnapshot(
  diagnosticsPayload: Record<string, unknown>,
  validationScreening: ValidationScreeningSnapshot | null | undefined,
): Record<string, unknown> {
  if (!validationScreening) return diagnosticsPayload;
  return {
    ...diagnosticsPayload,
    validationScreening,
  };
}

type AnalysisFpsSettings = {
  lowImpactStep: AnalysisFpsStep;
  highImpactStep: AnalysisFpsStep;
  tennisAutoDetectUsesHighImpact: boolean;
  tennisMatchPlayUsesHighImpact: boolean;
};

type AnalysisFpsRoutingReason =
  | "serve-selected"
  | "tennis-auto-detect-override"
  | "tennis-match-play-override"
  | "default-low-impact";

type AnalysisFpsRuntimeSnapshot = {
  effectiveStep: AnalysisFpsStep;
  lowImpactStep: AnalysisFpsStep;
  highImpactStep: AnalysisFpsStep;
  tennisAutoDetectUsesHighImpact: boolean;
  tennisMatchPlayUsesHighImpact: boolean;
  routingReason: AnalysisFpsRoutingReason;
};

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

type CoachingPayload = PythonResult["coaching"];

type PipelineProgressEvent = {
  type: "pipeline_timing";
  stageKey: PipelineStageKey;
  status: PipelineStageStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  elapsedMs?: number | null;
  note?: string | null;
};

const DEFAULT_PIPELINE_CONFIG_KEY = "tennis-forehand";
const DEFAULT_PIPELINE_MODEL_VERSION = "0.1";

function isPipelineStageStatus(value: unknown): value is PipelineStageStatus {
  return value === "pending" || value === "running" || value === "completed" || value === "failed";
}

function parsePipelineProgressLine(line: string): PipelineProgressEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.type !== "pipeline_timing") return null;
    if (!isPipelineStageKey(parsed.stageKey) || !isPipelineStageStatus(parsed.status)) return null;

    return {
      type: "pipeline_timing",
      stageKey: parsed.stageKey,
      status: parsed.status,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
      completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      elapsedMs: Number.isFinite(Number(parsed.elapsedMs)) ? Number(parsed.elapsedMs) : null,
      note: typeof parsed.note === "string" ? parsed.note : null,
    };
  } catch {
    return null;
  }
}

async function upsertAnalysisDiagnosticsPayload(
  analysisId: string,
  aiDiagnostics: AiDiagnosticsPayload,
  options: {
    configKey?: string | null;
    modelVersion?: string | null;
    auditActorUserId?: string | null;
  } = {},
): Promise<void> {
  const [existingRow] = await db
    .select({
      id: metrics.id,
      configKey: metrics.configKey,
      modelVersion: metrics.modelVersion,
    })
    .from(metrics)
    .where(eq(metrics.analysisId, analysisId))
    .orderBy(desc(metrics.createdAt))
    .limit(1);

  const configKey = options.configKey || existingRow?.configKey || DEFAULT_PIPELINE_CONFIG_KEY;
  const modelVersion = options.modelVersion || existingRow?.modelVersion || DEFAULT_PIPELINE_MODEL_VERSION;

  if (existingRow) {
    await db
      .update(metrics)
      .set({
        configKey,
        modelVersion,
        aiDiagnostics,
        ...buildUpdateAuditFields(options.auditActorUserId ?? null),
      })
      .where(eq(metrics.id, existingRow.id));
    return;
  }

  await db.insert(metrics).values({
    analysisId,
    configKey,
    modelVersion,
    aiDiagnostics,
    ...buildInsertAuditFields(options.auditActorUserId ?? null),
  });
}

export async function persistPipelineTimingUpdate(
  analysisId: string,
  update: {
    stageKey: PipelineStageKey;
    status: PipelineStageStatus;
    startedAt?: string | null;
    completedAt?: string | null;
    elapsedMs?: number | null;
    note?: string | null;
  },
  options: {
    configKey?: string | null;
    modelVersion?: string | null;
    auditActorUserId?: string | null;
    existingTiming?: PipelineTiming | null;
  } = {},
): Promise<PipelineTiming> {
  let basePayload: Record<string, unknown> = {};
  let baseTiming = options.existingTiming || null;

  if (!baseTiming) {
    const [existingRow] = await db
      .select({ aiDiagnostics: metrics.aiDiagnostics })
      .from(metrics)
      .where(eq(metrics.analysisId, analysisId))
      .orderBy(desc(metrics.createdAt))
      .limit(1);

    if (existingRow?.aiDiagnostics && typeof existingRow.aiDiagnostics === "object") {
      basePayload = existingRow.aiDiagnostics as Record<string, unknown>;
      baseTiming = extractPipelineTiming(basePayload);
    }
  }

  const nextTiming = updatePipelineTiming(baseTiming, update);
  const nextPayload = attachPipelineTiming(basePayload, nextTiming) as AiDiagnosticsPayload;
  await upsertAnalysisDiagnosticsPayload(analysisId, nextPayload, options);
  return nextTiming;
}

export async function seedUploadPipelineTiming(
  analysisId: string,
  uploadTiming: {
    startedAt?: string | null;
    completedAt?: string | null;
    elapsedMs?: number | null;
  },
  options: {
    configKey?: string | null;
    modelVersion?: string | null;
    auditActorUserId?: string | null;
  } = {},
): Promise<PipelineTiming> {
  return persistPipelineTimingUpdate(
    analysisId,
    {
      stageKey: "upload",
      status: "completed",
      startedAt: uploadTiming.startedAt,
      completedAt: uploadTiming.completedAt,
      elapsedMs: uploadTiming.elapsedMs,
    },
    options,
  );
}

async function resolveLockedMovementForRepeatUpload(
  analysis: typeof analyses.$inferSelect,
): Promise<string | null> {
  if (!analysis.userId || !analysis.sportId) return null;

  const hashValue = String(analysis.videoContentHash || "").trim();
  if (hashValue) {
    const [priorByHash] = await db
      .select({ detectedMovement: analyses.detectedMovement })
      .from(analyses)
      .where(
        and(
          eq(analyses.userId, analysis.userId),
          eq(analyses.sportId, analysis.sportId),
          eq(analyses.status, "completed"),
          ne(analyses.id, analysis.id),
          isNotNull(analyses.detectedMovement),
          eq(analyses.videoContentHash, hashValue),
        ),
      )
      .orderBy(desc(analyses.createdAt))
      .limit(1);

    const movementByHash = String(priorByHash?.detectedMovement || "").trim();
    if (movementByHash.length > 0) {
      return movementByHash;
    }
  }

  const filenameCandidates = [analysis.sourceFilename, analysis.videoFilename]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);

  if (!filenameCandidates.length) return null;

  const filenamePredicates = filenameCandidates.map((candidate) =>
    or(eq(analyses.videoFilename, candidate), eq(analyses.sourceFilename, candidate)),
  );

  const [prior] = await db
    .select({ detectedMovement: analyses.detectedMovement })
    .from(analyses)
    .where(
      and(
        eq(analyses.userId, analysis.userId),
        eq(analyses.sportId, analysis.sportId),
        eq(analyses.status, "completed"),
        ne(analyses.id, analysis.id),
        isNotNull(analyses.detectedMovement),
        filenamePredicates.length === 1 ? filenamePredicates[0]! : or(...filenamePredicates),
      ),
    )
    .orderBy(desc(analyses.createdAt))
    .limit(1);

  const lockedMovement = String(prior?.detectedMovement || "").trim();
  return lockedMovement.length > 0 ? lockedMovement : null;
}

async function computeVideoContentHash(videoPath: string): Promise<string | null> {
  if (!videoPath || !fs.existsSync(videoPath)) return null;

  const hash = createHash("sha256");
  return await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(videoPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", (error) => reject(error));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

type ReusableAnalysisPayload = {
  detectedMovement: string | null;
  configKey: string;
  modelVersion: string;
  overallScore: number | null;
  metricValues: Record<string, number> | null;
  scoreInputs: ScoreInputsPayload | null;
  scoreOutputs: ScoreOutputsPayload | null;
  aiDiagnostics: AiDiagnosticsPayload | null;
  coaching: {
    keyStrength: string;
    improvementArea: string;
    trainingSuggestion: string;
    simpleExplanation: string;
  };
};

async function findReusableAnalysisPayload(
  analysis: typeof analyses.$inferSelect,
  activeModelVersion: string,
): Promise<ReusableAnalysisPayload | null> {
  const hashValue = String(analysis.videoContentHash || "").trim();
  if (!analysis.userId || !analysis.sportId) return null;

  const filenameCandidates = [analysis.sourceFilename, analysis.videoFilename]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);

  const filenamePredicates = filenameCandidates.map((candidate) =>
    or(eq(analyses.videoFilename, candidate), eq(analyses.sourceFilename, candidate)),
  );

  const duplicateMatchers: any[] = [];
  if (hashValue) {
    duplicateMatchers.push(eq(analyses.videoContentHash, hashValue));
  }
  if (filenamePredicates.length === 1) {
    duplicateMatchers.push(filenamePredicates[0]);
  } else if (filenamePredicates.length > 1) {
    duplicateMatchers.push(or(...filenamePredicates));
  }
  if (!duplicateMatchers.length) return null;

  const conditions = [
    eq(analyses.userId, analysis.userId),
    eq(analyses.sportId, analysis.sportId),
    eq(analyses.status, "completed"),
    ne(analyses.id, analysis.id),
    duplicateMatchers.length === 1 ? duplicateMatchers[0] : or(...duplicateMatchers),
  ];

  if (analysis.movementId) {
    conditions.push(eq(analyses.movementId, analysis.movementId));
  }

  const [row] = await db
    .select({
      detectedMovement: analyses.detectedMovement,
      configKey: metrics.configKey,
      modelVersion: metrics.modelVersion,
      overallScore: metrics.overallScore,
      metricValues: metrics.metricValues,
      scoreInputs: metrics.scoreInputs,
      scoreOutputs: metrics.scoreOutputs,
      aiDiagnostics: metrics.aiDiagnostics,
      keyStrength: coachingInsights.keyStrength,
      improvementArea: coachingInsights.improvementArea,
      trainingSuggestion: coachingInsights.trainingSuggestion,
      simpleExplanation: coachingInsights.simpleExplanation,
    })
    .from(analyses)
    .leftJoin(metrics, eq(metrics.analysisId, analyses.id))
    .leftJoin(coachingInsights, eq(coachingInsights.analysisId, analyses.id))
    .where(and(...conditions))
    .orderBy(desc(analyses.createdAt))
    .limit(1);

  if (!row) return null;
  if (!row.configKey || !row.modelVersion || row.modelVersion !== activeModelVersion) return null;
  if (row.overallScore == null || !row.metricValues) return null;
  if (!row.keyStrength || !row.improvementArea || !row.trainingSuggestion || !row.simpleExplanation) return null;

  return {
    detectedMovement: row.detectedMovement,
    configKey: row.configKey,
    modelVersion: row.modelVersion,
    overallScore: Number(row.overallScore),
    metricValues: row.metricValues as Record<string, number>,
    scoreInputs: (row.scoreInputs as ScoreInputsPayload | null) || null,
    scoreOutputs: (row.scoreOutputs as ScoreOutputsPayload | null) || null,
    aiDiagnostics: (row.aiDiagnostics as AiDiagnosticsPayload | null) || null,
    coaching: {
      keyStrength: row.keyStrength,
      improvementArea: row.improvementArea,
      trainingSuggestion: row.trainingSuggestion,
      simpleExplanation: row.simpleExplanation,
    },
  };
}

function canonicalKey(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shouldDropPersistedMetricKey(key: string): boolean {
  const c = canonicalKey(key);
  return (
    c === "follow"
    || c === "followthrough"
    || c === "followthroughquality"
    || c === "followthroughscore"
    || c === "stability"
    || c === "stabilityscore"
  );
}

function sanitizePersistedMap(values: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(values || {})) {
    if (shouldDropPersistedMetricKey(key)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}

const REQUIRED_METRIC_KEYS = [
  "backswingDuration",
  "balanceScore",
  "ballSpeed",
  "contactDistance",
  "contactHeight",
  "contactTiming",
  "elbowAngle",
  "followThroughDuration",
  "hipRotationSpeed",
  "kneeBendAngle",
  "racketLagAngle",
  "reactionTime",
  "recoveryTime",
  "rhythmConsistency",
  "shoulderRotation",
  "shoulderRotationSpeed",
  "shotConsistency",
  "shotCount",
  "shotSpeed",
  "spinRate",
  "splitStepTime",
  "stanceAngle",
  "swingPathAngle",
  "trajectoryArc",
  "wristSpeed",
] as const;

const REQUIRED_UPLOAD_DIAGNOSTIC_METRIC_KEYS = [
  "contactDistance",
  "kneeBendAngle",
  "racketLagAngle",
  "recoveryTime",
  "splitStepTime",
  "stanceAngle",
] as const;

const REQUIRED_METRIC_ALIASES: Record<string, string[]> = {
  backswingDuration: ["backswingDuration"],
  balanceScore: ["balanceScore"],
  ballSpeed: ["ballSpeed", "avgBallSpeed", "shuttleSpeed"],
  contactDistance: ["contactDistance"],
  contactHeight: ["contactHeight"],
  contactTiming: ["contactTiming"],
  elbowAngle: ["elbowAngle"],
  followThroughDuration: ["followThroughDuration"],
  hipRotationSpeed: ["hipRotationSpeed", "hipRotation"],
  kneeBendAngle: ["kneeBendAngle"],
  racketLagAngle: ["racketLagAngle"],
  reactionTime: ["reactionTime", "reactionSpeed"],
  recoveryTime: ["recoveryTime", "recoverySpeed"],
  rhythmConsistency: ["rhythmConsistency"],
  shoulderRotation: ["shoulderRotation", "shoulderRotationSpeed"],
  shoulderRotationSpeed: ["shoulderRotationSpeed", "shoulderRotation"],
  shotConsistency: ["shotConsistency"],
  shotCount: ["shotCount"],
  shotSpeed: ["shotSpeed", "ballSpeed", "avgBallSpeed"],
  spinRate: ["spinRate"],
  splitStepTime: ["splitStepTime", "splitStepTiming"],
  stanceAngle: ["stanceAngle"],
  swingPathAngle: ["swingPathAngle", "trajectoryArc"],
  trajectoryArc: ["trajectoryArc"],
  wristSpeed: ["wristSpeed"],
};

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function normalizeMetricScaleForPersistence(metricKey: string, value: number): number {
  return normalizeMetricValueToTenScale(metricKey, value);
}

function readDiagnosticsComputedMetric(
  diagnostics: AiDiagnosticsPayload | null,
  metricKey: string,
): number | null {
  if (!diagnostics || typeof diagnostics !== "object") return null;
  const computed = (diagnostics as Record<string, unknown>).computedMetrics;
  if (!computed || typeof computed !== "object") return null;
  const value = (computed as Record<string, unknown>)[metricKey];
  return toFiniteNumber(value);
}

function normalizeMetricValuesForPersistence(
  rawMetricValues: Record<string, unknown>,
  diagnostics: AiDiagnosticsPayload | null,
): Record<string, number> {
  const out: Record<string, number> = {};

  for (const [key, raw] of Object.entries(rawMetricValues || {})) {
    const value = toFiniteNumber(raw);
    if (value == null) continue;
    out[key] = value;
  }

  // Diagnostics may compute metrics not returned by sport analyzers.
  const diagnosticsToCanonical: Array<{ diagnosticsKey: string; metricKey: string }> = [
    { diagnosticsKey: "hipRotation", metricKey: "hipRotationSpeed" },
    { diagnosticsKey: "reactionTime", metricKey: "reactionTime" },
    { diagnosticsKey: "contactDistance", metricKey: "contactDistance" },
    { diagnosticsKey: "kneeBendAngle", metricKey: "kneeBendAngle" },
    { diagnosticsKey: "racketLagAngle", metricKey: "racketLagAngle" },
    { diagnosticsKey: "recoveryTime", metricKey: "recoveryTime" },
    { diagnosticsKey: "splitStepTime", metricKey: "splitStepTime" },
    { diagnosticsKey: "stanceAngle", metricKey: "stanceAngle" },
  ];

  for (const { diagnosticsKey, metricKey } of diagnosticsToCanonical) {
    const value = readDiagnosticsComputedMetric(diagnostics, diagnosticsKey);
    if (value != null && !Number.isFinite(Number(out[metricKey]))) {
      out[metricKey] = value;
    }
  }

  const byCanonical = new Map<string, number>();
  for (const [key, value] of Object.entries(out)) {
    byCanonical.set(canonicalKey(key), value);
  }

  for (const targetKey of REQUIRED_METRIC_KEYS) {
    if (Number.isFinite(Number(out[targetKey]))) continue;
    const aliases = REQUIRED_METRIC_ALIASES[targetKey] || [targetKey];
    for (const alias of aliases) {
      const candidate = byCanonical.get(canonicalKey(alias));
      if (candidate == null) continue;
      out[targetKey] = candidate;
      break;
    }
  }

  for (const [key, value] of Object.entries(out)) {
    out[key] = normalizeMetricScaleForPersistence(key, Number(value));
  }

  return out;
}

type UserMetricPreferences = {
  selectedMetricKeys: string[];
  selectedMetricKeysBySport: Record<string, string[]>;
};

async function loadUserAnalysisPreferences(
  userId: string | null | undefined,
): Promise<{ dominantProfile: string | null; userMetricPreferences: UserMetricPreferences | null }> {
  if (!userId) {
    return {
      dominantProfile: null,
      userMetricPreferences: null,
    };
  }

  const [profile] = await db
    .select({
      dominantProfile: users.dominantProfile,
      selectedMetricKeys: users.selectedMetricKeys,
      selectedMetricKeysBySport: users.selectedMetricKeysBySport,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    dominantProfile: profile?.dominantProfile ?? null,
    userMetricPreferences: {
      selectedMetricKeys: Array.isArray(profile?.selectedMetricKeys) ? profile.selectedMetricKeys : [],
      selectedMetricKeysBySport:
        profile?.selectedMetricKeysBySport && typeof profile.selectedMetricKeysBySport === "object"
          ? (profile.selectedMetricKeysBySport as Record<string, string[]>)
          : {},
    },
  };
}

type CoachingFactorDefinition = {
  key: string;
  label: string;
  section: "technical" | "tactical" | "movement";
  inputKey: string;
};

type CoachingFactor = CoachingFactorDefinition & {
  score: number;
  parameters: string[];
};

type MetricSnapshot = {
  key: string;
  label: string;
  unit: string;
  value: number;
  optimalRange?: [number, number];
  inRange: boolean;
};

const COACHING_FACTOR_DEFINITIONS: CoachingFactorDefinition[] = [
  { key: "balance", label: "Balance", section: "technical", inputKey: "Balance" },
  { key: "inertia", label: "Inertia", section: "technical", inputKey: "Inertia" },
  { key: "oppositeForce", label: "Opposite Force", section: "technical", inputKey: "Opposite Force" },
  { key: "momentum", label: "Momentum", section: "technical", inputKey: "Momentum" },
  { key: "elastic", label: "Elastic Energy", section: "technical", inputKey: "Elastic Energy" },
  { key: "contact", label: "Contact", section: "technical", inputKey: "Contact" },
  { key: "power", label: "Power", section: "tactical", inputKey: "power" },
  { key: "control", label: "Control", section: "tactical", inputKey: "control" },
  { key: "timing", label: "Timing", section: "tactical", inputKey: "timing" },
  { key: "technique", label: "Technique", section: "tactical", inputKey: "technique" },
  { key: "ready", label: "Ready", section: "movement", inputKey: "Ready" },
  { key: "read", label: "Read", section: "movement", inputKey: "Read" },
  { key: "react", label: "React", section: "movement", inputKey: "React" },
  { key: "respond", label: "Respond", section: "movement", inputKey: "Respond" },
  { key: "recover", label: "Recover", section: "movement", inputKey: "Recover" },
];

const DRILL_SUGGESTION_BY_METRIC: Array<{ keys: string[]; message: string }> = [
  {
    keys: ["reactionTime", "splitStepTime"],
    message: "Add split-step timing and live-reaction drills so your first move starts earlier.",
  },
  {
    keys: ["balanceScore", "stanceAngle", "recoveryTime"],
    message: "Use balance and recovery footwork drills to stabilize your base before and after contact.",
  },
  {
    keys: ["hipRotationSpeed", "shoulderRotation", "shoulderRotationSpeed"],
    message: "Work on hip-to-shoulder sequencing drills to create cleaner rotation through the shot.",
  },
  {
    keys: ["contactDistance", "contactHeight", "contactTiming"],
    message: "Run spacing and contact-point reps to make your strike window more repeatable.",
  },
  {
    keys: ["racketLagAngle", "swingPathAngle", "spinRate"],
    message: "Use shadow swings and guided path drills to refine racket delivery and shape at contact.",
  },
  {
    keys: ["ballSpeed", "shotSpeed", "wristSpeed"],
    message: "Build controlled acceleration with progressive speed reps instead of chasing power too early.",
  },
];

function toSportPreferenceKey(configKey: string): string {
  return String(configKey || "").split("-")[0]?.trim().toLowerCase() || "";
}

function titleCase(value: string): string {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatScore10(value: number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(1)}/10`;
}

function formatMetricValue(value: number, unit: string): string {
  if (unit.startsWith("/")) {
    return `${value.toFixed(1)}${unit}`;
  }
  if (unit === "%") {
    return `${Math.round(value)}%`;
  }
  const decimals = Math.abs(value) >= 100 ? 0 : 1;
  return unit ? `${value.toFixed(decimals)} ${unit}` : value.toFixed(decimals);
}

function formatRange(range?: [number, number], unit?: string): string | null {
  if (!range || range.length !== 2) return null;
  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (unit?.startsWith("/")) {
    return `${min.toFixed(1)}-${max.toFixed(1)}${unit}`;
  }
  if (unit === "%") {
    return `${Math.round(min)}-${Math.round(max)}%`;
  }
  const decimals = Math.max(Math.abs(min), Math.abs(max)) >= 100 ? 0 : 1;
  return unit
    ? `${min.toFixed(decimals)}-${max.toFixed(decimals)} ${unit}`
    : `${min.toFixed(decimals)}-${max.toFixed(decimals)}`;
}

function resolveSelectedMetricKeysForCoaching(
  configKey: string,
  preferences: UserMetricPreferences | null,
): string[] {
  if (!preferences) return [];

  const sportKey = toSportPreferenceKey(configKey);
  const scoped = sportKey ? preferences.selectedMetricKeysBySport?.[sportKey] : null;
  const fallback = Array.isArray(preferences.selectedMetricKeys) ? preferences.selectedMetricKeys : [];
  const base = Array.isArray(scoped) && scoped.length > 0 ? scoped : fallback;

  return Array.from(new Set(base.map((key) => String(key || "").trim()).filter(Boolean)));
}

function buildMetricSnapshotMap(
  configKey: string,
  metricValues: Record<string, number>,
): Map<string, MetricSnapshot> {
  const config = getSportConfig(configKey);
  const metricDefs = new Map(
    (config?.metrics || []).map((metric) => [canonicalKey(metric.key), metric]),
  );

  const snapshots = new Map<string, MetricSnapshot>();
  for (const [rawKey, rawValue] of Object.entries(metricValues || {})) {
    const key = String(rawKey || "").trim();
    const value = Number(rawValue);
    if (!key || !Number.isFinite(value)) continue;

    const def = metricDefs.get(canonicalKey(key));
    const optimalRange = def?.optimalRange;
    const inRange = !!(
      optimalRange
      && Number.isFinite(optimalRange[0])
      && Number.isFinite(optimalRange[1])
      && value >= optimalRange[0]
      && value <= optimalRange[1]
    );

    snapshots.set(key, {
      key,
      label: def?.label || titleCase(key),
      unit: def?.unit || "",
      value,
      optimalRange,
      inRange,
    });
  }

  return snapshots;
}

function extractCoachingFactors(
  scoreInputs: ScoreInputsPayload | null,
  scoreOutputs: ScoreOutputsPayload | null,
): CoachingFactor[] {
  if (!scoreInputs || !scoreOutputs) return [];

  return COACHING_FACTOR_DEFINITIONS
    .map((definition) => {
      const sectionOutputs = (scoreOutputs as Record<string, unknown>)[definition.section];
      const components = sectionOutputs && typeof sectionOutputs === "object"
        ? (sectionOutputs as Record<string, unknown>).components
        : null;
      const rawScore = components && typeof components === "object"
        ? (components as Record<string, unknown>)[definition.key]
        : null;
      const score = Number(rawScore);
      if (!Number.isFinite(score)) return null;

      const sectionInputs = (scoreInputs as Record<string, unknown>)[definition.section];
      const detail = sectionInputs && typeof sectionInputs === "object"
        ? (sectionInputs as Record<string, unknown>)[definition.inputKey]
        : null;
      const parameters = detail && typeof detail === "object" && Array.isArray((detail as Record<string, unknown>).parameters)
        ? ((detail as Record<string, unknown>).parameters as unknown[])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
        : [];

      return {
        ...definition,
        score,
        parameters,
      };
    })
    .filter((item): item is CoachingFactor => item !== null)
    .sort((a, b) => b.score - a.score);
}

function chooseSignals(
  factor: CoachingFactor | null,
  selectedMetricKeys: string[],
  snapshots: Map<string, MetricSnapshot>,
  mode: "positive" | "improvement",
): MetricSnapshot[] {
  const selectedCanonical = new Set(selectedMetricKeys.map((key) => canonicalKey(key)));
  const factorParameterCanon = new Set((factor?.parameters || []).map((key) => canonicalKey(key)));

  const all = [...snapshots.values()].filter((snapshot) =>
    mode === "positive" ? snapshot.inRange : !snapshot.inRange,
  );

  const prioritized = all
    .map((snapshot) => ({
      snapshot,
      selected: selectedCanonical.has(canonicalKey(snapshot.key)),
      linked: factorParameterCanon.has(canonicalKey(snapshot.key)),
    }))
    .sort((left, right) => {
      if (left.selected !== right.selected) return left.selected ? -1 : 1;
      if (left.linked !== right.linked) return left.linked ? -1 : 1;
      return left.snapshot.label.localeCompare(right.snapshot.label, undefined, { sensitivity: "base" });
    })
    .map((item) => item.snapshot);

  return prioritized.slice(0, 2);
}

function metricSignalText(snapshot: MetricSnapshot, mode: "positive" | "improvement"): string {
  const valueText = formatMetricValue(snapshot.value, snapshot.unit);
  const rangeText = formatRange(snapshot.optimalRange, snapshot.unit);

  if (mode === "positive") {
    return `${snapshot.label} is a real positive at ${valueText}${rangeText ? `, right in the target window of ${rangeText}` : ""}`;
  }

  if (!snapshot.optimalRange) {
    return `${snapshot.label} at ${valueText} is the next area to tighten`;
  }

  const direction = snapshot.value < snapshot.optimalRange[0] ? "below" : "above";
  return `${snapshot.label} is ${direction} the target window at ${valueText}${rangeText ? `, with the goal set at ${rangeText}` : ""}`;
}

function buildTrainingSuggestion(parameters: string[], selectedSignals: MetricSnapshot[]): string {
  const parameterCanon = new Set(parameters.map((key) => canonicalKey(key)));
  const matched = DRILL_SUGGESTION_BY_METRIC.find((entry) =>
    entry.keys.some((key) => parameterCanon.has(canonicalKey(key))),
  );

  const trackedMetrics = selectedSignals.map((snapshot) => snapshot.label);
  const trackLine = trackedMetrics.length > 0
    ? ` Keep an eye on ${trackedMetrics.join(trackedMetrics.length > 1 ? " and " : "")} across your next few sessions so the improvement is measurable.`
    : "";

  return `${matched?.message || "Build the next training block around the weakest score factor, then recheck the supporting metrics after each session."}${trackLine}`;
}

function buildPersonalizedCoaching(args: {
  configKey: string;
  detectedMovement: string | null | undefined;
  overallScore: number | null;
  scoreInputs: ScoreInputsPayload | null;
  scoreOutputs: ScoreOutputsPayload | null;
  metricValues: Record<string, number>;
  preferences: UserMetricPreferences | null;
}): CoachingPayload {
  const config = getSportConfig(args.configKey);
  const movementLabel = titleCase(args.detectedMovement || config?.movementName || "session");
  const selectedMetricKeys = resolveSelectedMetricKeysForCoaching(args.configKey, args.preferences);
  const metricSnapshots = buildMetricSnapshotMap(args.configKey, args.metricValues);
  const factors = extractCoachingFactors(args.scoreInputs, args.scoreOutputs);

  const bestFactor = factors[0] || null;
  const weakestFactor = factors.length > 0 ? [...factors].sort((a, b) => a.score - b.score)[0] : null;

  const sectionScores = [
    { label: "Technical", score: Number(args.scoreOutputs?.technical?.overall) },
    { label: "Tactical", score: Number(args.scoreOutputs?.tactical?.overall) },
    { label: "Movement", score: Number(args.scoreOutputs?.movement?.overall) },
  ].filter((entry) => Number.isFinite(entry.score));

  const bestSection = sectionScores.slice().sort((a, b) => b.score - a.score)[0] || null;
  const weakestSection = sectionScores.slice().sort((a, b) => a.score - b.score)[0] || null;

  const positiveSignals = chooseSignals(bestFactor, selectedMetricKeys, metricSnapshots, "positive");
  const improvementSignals = chooseSignals(weakestFactor, selectedMetricKeys, metricSnapshots, "improvement");

  const intro = args.overallScore != null && args.overallScore >= 8
    ? "Excellent work. This session shows high-quality patterns you can trust and build on."
    : args.overallScore != null && args.overallScore >= 6.5
      ? "There is a strong base here, and several indicators are moving in the right direction."
      : "There is still work to do, but this session already shows a few encouraging building blocks.";

  const strengthLines = [intro];
  if (bestSection && bestFactor) {
    strengthLines.push(
      `${bestSection.label} leads this session at ${formatScore10(bestSection.score)}, with ${bestFactor.label} setting the tone at ${formatScore10(bestFactor.score)}.`,
    );
  }
  if (positiveSignals.length > 0) {
    strengthLines.push(`Shout-out: ${positiveSignals.map((signal) => metricSignalText(signal, "positive")).join("; ")}. These are the indicators to keep owning.`);
  } else if (bestFactor?.parameters?.length) {
    strengthLines.push(`Shout-out: the indicators feeding ${bestFactor.label} are giving you a strong platform to build from.`);
  }

  const improvementLines: string[] = [];
  if (weakestSection && weakestFactor) {
    improvementLines.push(
      `${weakestSection.label} is the clearest opportunity right now at ${formatScore10(weakestSection.score)}, especially ${weakestFactor.label} at ${formatScore10(weakestFactor.score)}.`,
    );
  } else {
    improvementLines.push("The next jump will come from tightening the weakest score factor and the metrics underneath it.");
  }
  if (improvementSignals.length > 0) {
    improvementLines.push(`Priority focus: ${improvementSignals.map((signal) => metricSignalText(signal, "improvement")).join("; ")}.`);
  } else if (weakestFactor?.parameters?.length) {
    improvementLines.push(`Focus on the indicators behind ${weakestFactor.label}: ${weakestFactor.parameters.map((key) => titleCase(key)).join(", ")}.`);
  }

  const trainingSuggestion = buildTrainingSuggestion(weakestFactor?.parameters || [], improvementSignals);
  const simpleExplanation = `${movementLabel} scored ${formatScore10(args.overallScore)} overall. Your best edge today was ${bestFactor ? `${bestFactor.label} at ${formatScore10(bestFactor.score)}` : "your strongest component"}, and the next gain is in ${weakestFactor ? `${weakestFactor.label} at ${formatScore10(weakestFactor.score)}` : "the weakest component"}.`;

  return {
    keyStrength: strengthLines.join(" "),
    improvementArea: improvementLines.join(" "),
    trainingSuggestion,
    simpleExplanation,
  };
}

function hasAllRequiredUploadDiagnosticsMetrics(metricValues: Record<string, unknown>): boolean {
  for (const key of REQUIRED_UPLOAD_DIAGNOSTIC_METRIC_KEYS) {
    if (!Number.isFinite(Number(metricValues[key]))) {
      return false;
    }
  }
  return true;
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

function runPythonAnalysis(
  videoPath: string,
  sportName: string,
  movementName: string,
  validationMode: VideoValidationMode,
  analysisFpsSnapshot: AnalysisFpsRuntimeSnapshot,
  metricComputationMode: "core" | "full",
  dominantProfile?: string | null,
  classificationModelSelection?: ClassificationModelExecutionSelection | null,
  onProgress?: (event: PipelineProgressEvent) => Promise<void> | void,
): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const pythonExecutable = resolvePythonExecutable();
      const [poseEnv, classificationModelEnv] = await Promise.all([
        getPoseLandmarkerPythonEnv(),
        classificationModelSelection
          ? getDriveMovementClassificationModelPythonEnvForSelection(classificationModelSelection)
          : getDriveMovementClassificationModelPythonEnv(),
      ]);

      const args = [
        "-m",
        "python_analysis.run_analysis",
        videoPath,
        "--sport",
        sportName.toLowerCase(),
        "--movement",
        movementName.toLowerCase().replace(/\s+/g, "-"),
        "--validation-mode",
        validationMode,
        "--analysis-fps-mode",
        analysisFpsSnapshot.effectiveStep,
        "--low-impact-fps-step",
        analysisFpsSnapshot.lowImpactStep,
        "--high-impact-fps-step",
        analysisFpsSnapshot.highImpactStep,
        "--tennis-auto-detect-uses-high-impact",
        String(analysisFpsSnapshot.tennisAutoDetectUsesHighImpact),
        "--tennis-match-play-uses-high-impact",
        String(analysisFpsSnapshot.tennisMatchPlayUsesHighImpact),
        "--analysis-fps-routing-reason",
        analysisFpsSnapshot.routingReason,
        "--metric-computation-mode",
        metricComputationMode,
      ];

      const dominant = String(dominantProfile || "").trim().toLowerCase();
      if (dominant === "right" || dominant === "left") {
        args.push("--dominant-profile", dominant);
      }

      const child = spawn(pythonExecutable, args, {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...poseEnv, ...classificationModelEnv },
      });

      let stdout = "";
      let stderr = "";
      let stderrBuffer = "";
      let progressChain = Promise.resolve();
      let settled = false;

      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        child.kill("SIGKILL");
      }, 3600000);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        stderrBuffer += text;

        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || "";
        for (const line of lines) {
          const event = parsePipelineProgressLine(line);
          if (!event || !onProgress) continue;
          progressChain = progressChain
            .then(() => Promise.resolve(onProgress(event)))
            .catch((error) => {
              console.warn("Pipeline progress update failed:", error);
            });
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeoutHandle);
        settled = true;
        reject(new Error(`Python analysis failed: ${error.message}`));
      });

      child.on("close", async (code, signal) => {
        clearTimeout(timeoutHandle);
        if (settled) return;
        settled = true;

        if (stderrBuffer) {
          stderr += `${stderr.endsWith("\n") || !stderr ? "" : "\n"}${stderrBuffer}`;
        }

        try {
          await progressChain;
        } catch {
          // Ignore progress propagation errors.
        }

        if (signal) {
          reject(new Error(`Python analysis terminated by signal ${signal}`));
          return;
        }

        if (code !== 0) {
          if (stderr) console.error("Python analysis stderr:", stderr);
          reject(new Error(`Python analysis failed with exit code ${code}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim()) as PythonResult;
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result);
        } catch {
          if (stderr) console.error("Python analysis stderr:", stderr);
          reject(new Error("Failed to parse analysis results"));
        }
      });
    })().catch((error: Error) => {
      reject(error);
    });
  });
}

function runPythonMetricEnrichment(
  videoPath: string,
  configKey: string,
  analysisArtifactPath: string,
): Promise<PythonMetricEnrichmentResult> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();

    const args = [
      "-m",
      "python_analysis.run_metric_enrichment",
      videoPath,
      "--config-key",
      configKey,
      "--analysis-artifact",
      analysisArtifactPath,
    ];

    const child = spawn(pythonExecutable, args, {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, 3600000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      settled = true;
      reject(new Error(`Python metric enrichment failed: ${error.message}`));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;

      if (code !== 0) {
        if (stderr) console.error("Python metric enrichment stderr:", stderr);
        const suffix = signal ? ` (signal: ${signal})` : "";
        reject(new Error(`Python metric enrichment failed: exit code ${code ?? "unknown"}${suffix}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result?.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result as PythonMetricEnrichmentResult);
      } catch {
        if (stderr) console.error("Python metric enrichment stderr:", stderr);
        reject(new Error("Failed to parse metric enrichment results"));
      }
    });
  });
}

async function backfillAnalysisEnrichment(args: {
  analysisId: string;
  videoPath: string;
  sportName: string;
  movementName: string;
  dominantProfile?: string | null;
  analysisArtifactPath?: string | null;
  configKey?: string | null;
  modelVersion?: string | null;
  auditActorUserId?: string | null;
  classificationModelSelection?: ClassificationModelExecutionSelection | null;
}): Promise<void> {
  const enrichmentStartedAt = Date.now();
  let pipelineTiming: PipelineTiming | null = await persistPipelineTimingUpdate(
    args.analysisId,
    {
      stageKey: "diagnostics",
      status: "running",
      startedAt: new Date(enrichmentStartedAt).toISOString(),
    },
    {
      configKey: args.configKey,
      modelVersion: args.modelVersion,
      auditActorUserId: args.auditActorUserId,
    },
  );

  try {
    const [analysisRow] = await db
      .select({
        userId: analyses.userId,
        detectedMovement: analyses.detectedMovement,
      })
      .from(analyses)
      .where(eq(analyses.id, args.analysisId))
      .limit(1);

    const [metricRow] = await db
      .select({
        id: metrics.id,
        configKey: metrics.configKey,
        modelVersion: metrics.modelVersion,
        overallScore: metrics.overallScore,
        metricValues: metrics.metricValues,
        scoreOutputs: metrics.scoreOutputs,
        aiDiagnostics: metrics.aiDiagnostics,
      })
      .from(metrics)
      .where(eq(metrics.analysisId, args.analysisId))
      .orderBy(desc(metrics.createdAt))
      .limit(1);

    const configKey = metricRow?.configKey || args.configKey || DEFAULT_PIPELINE_CONFIG_KEY;
    const analysisArtifactPath = String(args.analysisArtifactPath || "").trim();
    const shouldRunMetricEnrichment = Boolean(
      analysisArtifactPath
      && metricRow
      && hasPendingAsyncMetricEnrichment(
        configKey,
        (metricRow.metricValues as Record<string, unknown> | null) || {},
      ),
    );

    const [diagnosticsResult, metricEnrichmentResult] = await Promise.allSettled([
      runPythonDiagnostics(
        args.videoPath,
        args.sportName,
        args.movementName,
        args.dominantProfile,
        args.analysisArtifactPath,
        args.classificationModelSelection,
      ),
      shouldRunMetricEnrichment
        ? runPythonMetricEnrichment(args.videoPath, configKey, analysisArtifactPath)
        : Promise.resolve(null),
    ]);

    const diagnosticsPayload = diagnosticsResult.status === "fulfilled"
      ? diagnosticsResult.value
      : null;
    const diagnosticsError = diagnosticsResult.status === "rejected"
      ? diagnosticsResult.reason
      : null;
    const metricEnrichmentPayload = metricEnrichmentResult.status === "fulfilled"
      ? metricEnrichmentResult.value
      : null;
    const metricEnrichmentError = metricEnrichmentResult.status === "rejected"
      ? metricEnrichmentResult.reason
      : null;

    const existingDiagnosticsRecord = metricRow?.aiDiagnostics && typeof metricRow.aiDiagnostics === "object"
      ? (metricRow.aiDiagnostics as Record<string, unknown>)
      : {};
    const existingValidationScreening = existingDiagnosticsRecord.validationScreening as ValidationScreeningSnapshot | undefined;

    const diagnosticsFailureMessage = diagnosticsError ? String((diagnosticsError as Error).message || diagnosticsError) : null;
    const metricEnrichmentFailureMessage = metricEnrichmentError
      ? String((metricEnrichmentError as Error).message || metricEnrichmentError)
      : null;
    const finalStatus = diagnosticsFailureMessage && metricEnrichmentFailureMessage ? "failed" : "completed";
    const noteParts = [
      diagnosticsFailureMessage ? `diagnostics: ${diagnosticsFailureMessage}` : null,
      metricEnrichmentFailureMessage ? `metric enrichment: ${metricEnrichmentFailureMessage}` : null,
    ].filter((value): value is string => Boolean(value));

    pipelineTiming = await persistPipelineTimingUpdate(
      args.analysisId,
      {
        stageKey: "diagnostics",
        status: finalStatus,
        completedAt: new Date().toISOString(),
        elapsedMs: Date.now() - enrichmentStartedAt,
        note: noteParts.length ? noteParts.join(" | ") : null,
      },
      {
        configKey: args.configKey,
        modelVersion: args.modelVersion,
        auditActorUserId: args.auditActorUserId,
        existingTiming: pipelineTiming,
      },
    );

    const diagnosticsBaseRecord = diagnosticsPayload && typeof diagnosticsPayload === "object"
      ? mergeValidationScreeningSnapshot(
        diagnosticsPayload as Record<string, unknown>,
        existingValidationScreening,
      )
      : mergeValidationScreeningSnapshot(existingDiagnosticsRecord, existingValidationScreening);
    const diagnosticsWithTiming = attachPipelineTiming(
      diagnosticsBaseRecord,
      pipelineTiming,
    ) as AiDiagnosticsPayload;

    if (!metricRow || !analysisRow) {
      await upsertAnalysisDiagnosticsPayload(args.analysisId, diagnosticsWithTiming, {
        configKey: args.configKey,
        modelVersion: args.modelVersion,
        auditActorUserId: args.auditActorUserId,
      });
      if (diagnosticsError && metricEnrichmentError) {
        throw diagnosticsError;
      }
      return;
    }

    const metricEnrichmentResultValue = metricEnrichmentPayload as PythonMetricEnrichmentResult | null;
    const enrichedMetricValues = (metricEnrichmentResultValue?.metricValues || {}) as Record<string, unknown>;
    const mergedMetricValuesRaw: Record<string, unknown> = {
      ...(((metricRow.metricValues as Record<string, unknown> | null) || {})),
      ...enrichedMetricValues,
    };
    const normalizedMetricValues = normalizeMetricValuesForPersistence(
      mergedMetricValuesRaw,
      diagnosticsWithTiming,
    );
    const metricValues = sanitizePersistedMap(normalizedMetricValues);
    const scoreInputs = buildScoreInputsPayload(configKey, metricValues);
    const tacticalComponents = extractStandardizedTacticalScores10(
      sanitizePersistedMap(
        ((metricRow.scoreOutputs as any)?.tactical?.components as Record<string, number> | null)
          || ((metricRow.scoreOutputs as any)?.tacticalComponents as Record<string, number> | null)
          || {},
      ),
    );
    const scoreOutputs = buildScoreOutputsPayload({
      configKey,
      detectedMovement: analysisRow.detectedMovement || args.movementName,
      tacticalComponents,
      metricValues,
      overallScore: metricRow.overallScore == null ? null : Number(metricRow.overallScore),
    });
    const { userMetricPreferences } = await loadUserAnalysisPreferences(analysisRow.userId);
    const coaching = buildPersonalizedCoaching({
      configKey,
      detectedMovement: analysisRow.detectedMovement || args.movementName,
      overallScore: metricRow.overallScore == null ? null : Number(metricRow.overallScore),
      scoreInputs,
      scoreOutputs,
      metricValues,
      preferences: userMetricPreferences,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(metrics)
        .set({
          configKey,
          modelVersion: metricRow.modelVersion || args.modelVersion || DEFAULT_PIPELINE_MODEL_VERSION,
          metricValues,
          scoreInputs,
          scoreOutputs,
          aiDiagnostics: diagnosticsWithTiming,
          ...buildUpdateAuditFields(args.auditActorUserId ?? null),
        })
        .where(eq(metrics.id, metricRow.id));

      await tx.delete(coachingInsights).where(eq(coachingInsights.analysisId, args.analysisId));
      await tx.insert(coachingInsights).values({
        analysisId: args.analysisId,
        ...coaching,
        ...buildInsertAuditFields(args.auditActorUserId ?? null),
      });
    });

    if (diagnosticsFailureMessage) {
      console.warn(
        `Diagnostics generation failed for analysis ${args.analysisId}: ${diagnosticsFailureMessage}`,
      );
    }
    if (metricEnrichmentFailureMessage) {
      console.warn(
        `Metric enrichment failed for analysis ${args.analysisId}: ${metricEnrichmentFailureMessage}`,
      );
    }
  } catch (error: any) {
    await persistPipelineTimingUpdate(
      args.analysisId,
      {
        stageKey: "diagnostics",
        status: "failed",
        completedAt: new Date().toISOString(),
        note: error?.message || String(error),
      },
      {
        configKey: args.configKey,
        modelVersion: args.modelVersion,
        auditActorUserId: args.auditActorUserId,
        existingTiming: pipelineTiming,
      },
    );
    console.warn(
      `Diagnostics generation failed for analysis ${args.analysisId}: ${error?.message || error}`,
    );
  } finally {
    const artifactPath = String(args.analysisArtifactPath || "").trim();
    if (artifactPath) {
      try {
        fs.unlinkSync(artifactPath);
      } catch (cleanupError) {
        console.warn(
          `Failed to remove analysis artifact for ${args.analysisId}: ${String(cleanupError)}`,
        );
      }
    }
  }
}

async function getVideoValidationMode(): Promise<VideoValidationMode> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, VIDEO_VALIDATION_MODE_KEY))
    .limit(1);

  const rawMode = setting?.value && typeof setting.value === "object"
    ? (setting.value as Record<string, unknown>).mode
    : null;

  return isVideoValidationMode(rawMode) ? rawMode : "disabled";
}

async function getAnalysisFpsSettings(): Promise<AnalysisFpsSettings> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, ANALYSIS_FPS_MODE_KEY))
    .limit(1);

  const rawValue = setting?.value && typeof setting.value === "object"
    ? (setting.value as Record<string, unknown>)
    : null;

  return {
    lowImpactStep: coerceLowImpactStep(rawValue?.lowImpactStep ?? rawValue?.lowImpactMode),
    highImpactStep: coerceHighImpactStep(rawValue?.highImpactStep ?? rawValue?.highImpactMode),
    tennisAutoDetectUsesHighImpact: Boolean(rawValue?.tennisAutoDetectUsesHighImpact),
    tennisMatchPlayUsesHighImpact: Boolean(rawValue?.tennisMatchPlayUsesHighImpact),
  };
}

function resolveAnalysisFpsModeForMovement(
  sportName: string | null | undefined,
  movementName: string | null | undefined,
  requestedSessionType: string | null | undefined,
  settings: AnalysisFpsSettings,
): AnalysisFpsRuntimeSnapshot {
  const normalizedSport = String(sportName || "").trim().toLowerCase();
  const normalized = String(movementName || "").trim().toLowerCase();
  const normalizedSessionType = String(requestedSessionType || "").trim().toLowerCase();
  if (normalized === "serve") {
    return {
      effectiveStep: settings.highImpactStep,
      lowImpactStep: settings.lowImpactStep,
      highImpactStep: settings.highImpactStep,
      tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
      routingReason: "serve-selected",
    };
  }
  if (normalizedSport === "tennis" && normalized === "auto-detect" && settings.tennisAutoDetectUsesHighImpact) {
    return {
      effectiveStep: settings.highImpactStep,
      lowImpactStep: settings.lowImpactStep,
      highImpactStep: settings.highImpactStep,
      tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
      routingReason: "tennis-auto-detect-override",
    };
  }
  if (normalizedSport === "tennis" && normalizedSessionType === "match-play" && settings.tennisMatchPlayUsesHighImpact) {
    return {
      effectiveStep: settings.highImpactStep,
      lowImpactStep: settings.lowImpactStep,
      highImpactStep: settings.highImpactStep,
      tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
      routingReason: "tennis-match-play-override",
    };
  }
  return {
    effectiveStep: settings.lowImpactStep,
    lowImpactStep: settings.lowImpactStep,
    highImpactStep: settings.highImpactStep,
    tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
    tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
    routingReason: "default-low-impact",
  };
}

function runPythonDiagnostics(
  videoPath: string,
  sportName: string,
  movementName: string,
  dominantProfile?: string | null,
  analysisArtifactPath?: string | null,
  classificationModelSelection?: ClassificationModelExecutionSelection | null,
): Promise<AiDiagnosticsPayload> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const pythonExecutable = resolvePythonExecutable();
      const [poseEnv, classificationModelEnv] = await Promise.all([
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

      if (analysisArtifactPath) {
        args.push("--analysis-artifact", analysisArtifactPath);
      }

      const child = spawn(pythonExecutable, args, {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...poseEnv, ...classificationModelEnv },
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        child.kill("SIGKILL");
      }, 3600000);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timeoutHandle);
        settled = true;
        reject(new Error(`Python diagnostics failed: ${error.message}`));
      });

      child.on("close", (code, signal) => {
        clearTimeout(timeoutHandle);
        if (settled) return;
        settled = true;

        if (signal) {
          reject(new Error(`Python diagnostics terminated by signal ${signal}`));
          return;
        }

        if (code !== 0) {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error(`Python diagnostics failed with exit code ${code}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result?.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result as AiDiagnosticsPayload);
        } catch {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error("Failed to parse diagnostics results"));
        }
      });
    })().catch((error: Error) => {
      reject(error);
    });
  });
}

export async function processAnalysis(
  analysisId: string,
  options?: {
    forceFreshDiagnostics?: boolean;
    classificationModelSelection?: ClassificationModelExecutionSelection | null;
  },
): Promise<void> {
  let pipelineTiming: PipelineTiming | null = null;
  try {
    await db
      .update(analyses)
      .set({ status: "processing", rejectionReason: null, updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));

    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, analysisId));

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    const auditActorUserId = analysis.createdByUserId || analysis.userId || null;

    let sportName = "tennis";
    let movementName = "auto-detect";

    if (analysis.movementId) {
      const [movement] = await db
        .select()
        .from(sportMovements)
        .where(eq(sportMovements.id, analysis.movementId));
      if (movement) {
        movementName = movement.name;
      }
    }

    if (analysis.sportId) {
      const sport = await getSportById(analysis.sportId);
      if (sport) {
        if (!isSportEnabledRecord(sport)) {
          await db
            .update(analyses)
            .set({
              status: "failed",
              rejectionReason: `${sport.name} is currently disabled and was not executed.`,
              ...buildUpdateAuditFields(auditActorUserId),
            })
            .where(eq(analyses.id, analysisId));
          return;
        }
        sportName = sport.name;
      }
    } else {
      const enabledPrimarySport = await getEnabledPrimarySport();
      if (!enabledPrimarySport) {
        await db
          .update(analyses)
          .set({
            status: "failed",
            rejectionReason: "No enabled sport is available for execution.",
            ...buildUpdateAuditFields(auditActorUserId),
          })
          .where(eq(analyses.id, analysisId));
        return;
      }
      sportName = enabledPrimarySport.name;
    }

    let dominantProfile: string | null = null;
    let userMetricPreferences: UserMetricPreferences | null = null;
    const [videoValidationMode, analysisFpsSettings] = await Promise.all([
      getVideoValidationMode(),
      getAnalysisFpsSettings(),
    ]);
    const validationScreening = buildValidationScreeningSnapshot(videoValidationMode);
    const profileContext = await loadUserAnalysisPreferences(analysis.userId);
    dominantProfile = profileContext.dominantProfile;
    userMetricPreferences = profileContext.userMetricPreferences;

    await withLocalMediaFile(analysis.videoPath, analysis.videoFilename, async (localVideoPath) => {
      if (String(sportName || "").trim().toLowerCase() === "tennis") {
        const tennisUploadGuard = await validateTennisVideoUpload(
          localVideoPath,
          videoValidationMode,
          dominantProfile,
        );
        if (!tennisUploadGuard.accepted) {
          await db
            .update(analyses)
            .set({
              status: "rejected",
              rejectionReason:
                tennisUploadGuard.reason
                || "Only tennis videos are allowed. Upload a clear tennis stroke or rally clip.",
              ...buildUpdateAuditFields(auditActorUserId),
            })
            .where(eq(analyses.id, analysisId));
          return;
        }
      }

      const videoContentHashPromise = computeVideoContentHash(localVideoPath)
        .then(async (videoContentHash) => {
          if (!videoContentHash) return null;
          await db
            .update(analyses)
            .set({ videoContentHash, updatedAt: new Date() })
            .where(eq(analyses.id, analysis.id));
          analysis.videoContentHash = videoContentHash;
          return videoContentHash;
        })
        .catch((hashError) => {
          console.warn(
            `Video hash computation failed for analysis ${analysisId}: ${String(hashError)}`,
          );
          return null;
        });

      const modelRegistryConfig = readModelRegistryConfig();
      const selectedModelVersion = String(
        options?.classificationModelSelection?.modelVersion || modelRegistryConfig.activeModelVersion,
      ).trim() || modelRegistryConfig.activeModelVersion;
      const initialConfigKey = getConfigKey(sportName, movementName);

      const applyPipelineUpdate = async (
        update: {
          stageKey: PipelineStageKey;
          status: PipelineStageStatus;
          startedAt?: string | null;
          completedAt?: string | null;
          elapsedMs?: number | null;
          note?: string | null;
        },
      ) => {
        pipelineTiming = await persistPipelineTimingUpdate(analysisId, update, {
          configKey: initialConfigKey,
          modelVersion: selectedModelVersion,
          auditActorUserId,
          existingTiming: pipelineTiming,
        });
      };

      const reusablePayload = options?.forceFreshDiagnostics
        ? null
        : await findReusableAnalysisPayload(
          analysis,
          selectedModelVersion,
        );
      if (reusablePayload) {
        const needsDiagnosticsBackfill = !hasAllRequiredUploadDiagnosticsMetrics(
          normalizeMetricValuesForPersistence(
            reusablePayload.metricValues || {},
            reusablePayload.aiDiagnostics,
          ),
        );
        const needsAsyncMetricEnrichment = hasPendingAsyncMetricEnrichment(
          reusablePayload.configKey,
          reusablePayload.metricValues,
        );
        let normalizedReusableMetrics = normalizeMetricValuesForPersistence(
          reusablePayload.metricValues || {},
          reusablePayload.aiDiagnostics,
        );
        let reusableDiagnosticsPayload: AiDiagnosticsPayload | null = reusablePayload.aiDiagnostics;

        if (needsDiagnosticsBackfill || needsAsyncMetricEnrichment) {
          pipelineTiming = updatePipelineTiming(pipelineTiming, {
            stageKey: "diagnostics",
            status: "pending",
          });
          const queuedDiagnostics = reusableDiagnosticsPayload && typeof reusableDiagnosticsPayload === "object"
            ? (reusableDiagnosticsPayload as Record<string, unknown>)
            : {};
          reusableDiagnosticsPayload = attachPipelineTiming(
            mergeValidationScreeningSnapshot(queuedDiagnostics, validationScreening),
            pipelineTiming,
          ) as AiDiagnosticsPayload;
        }

        const sanitizedMetricValues = sanitizePersistedMap(normalizedReusableMetrics);
        const reusableScoreInputs = buildScoreInputsPayload(
          reusablePayload.configKey,
          sanitizedMetricValues,
        );
        const reusableTacticalComponents = extractStandardizedTacticalScores10(
          sanitizePersistedMap(
            ((reusablePayload.scoreOutputs as any)?.tactical?.components as Record<string, number> | null)
              || ((reusablePayload.scoreOutputs as any)?.tacticalComponents as Record<string, number> | null)
              || {},
          ),
        );
        const reusableScoreOutputs = buildScoreOutputsPayload({
          configKey: reusablePayload.configKey,
          detectedMovement: reusablePayload.detectedMovement,
          tacticalComponents: reusableTacticalComponents,
          metricValues: sanitizedMetricValues,
          overallScore: reusablePayload.overallScore,
        });
        const reusableCoaching = buildPersonalizedCoaching({
          configKey: reusablePayload.configKey,
          detectedMovement: reusablePayload.detectedMovement || movementName,
          overallScore: reusablePayload.overallScore,
          scoreInputs: reusableScoreInputs,
          scoreOutputs: reusableScoreOutputs,
          metricValues: sanitizedMetricValues,
          preferences: userMetricPreferences,
        });

        await db.transaction(async (tx) => {
          await tx.delete(coachingInsights).where(eq(coachingInsights.analysisId, analysisId));
          await tx.delete(metrics).where(eq(metrics.analysisId, analysisId));

          await tx.insert(metrics).values({
            analysisId,
            configKey: reusablePayload.configKey,
            modelVersion: reusablePayload.modelVersion,
            overallScore: reusablePayload.overallScore,
            metricValues: sanitizedMetricValues,
            scoreInputs: reusableScoreInputs,
            scoreOutputs: reusableScoreOutputs,
            aiDiagnostics: reusableDiagnosticsPayload,
            ...buildInsertAuditFields(auditActorUserId),
          });

          await tx.insert(coachingInsights).values({
            analysisId,
            ...reusableCoaching,
            ...buildInsertAuditFields(auditActorUserId),
          });
        });

        await db
          .update(analyses)
          .set({
            status: "completed",
            detectedMovement: reusablePayload.detectedMovement || movementName,
            rejectionReason: null,
            ...buildUpdateAuditFields(auditActorUserId),
          })
          .where(eq(analyses.id, analysisId));

        if (needsDiagnosticsBackfill || needsAsyncMetricEnrichment) {
          void backfillAnalysisEnrichment({
            analysisId,
            videoPath: localVideoPath,
            sportName,
            movementName: reusablePayload.detectedMovement || movementName,
            dominantProfile,
            configKey: reusablePayload.configKey,
            modelVersion: selectedModelVersion,
            auditActorUserId,
            classificationModelSelection: options?.classificationModelSelection,
          });
        }

        void videoContentHashPromise;

        console.log(`Analysis ${analysisId} reused scores from prior identical video hash`);
        return;
      }

      if (String(movementName || "").toLowerCase() === "auto-detect") {
        const lockedMovement = await resolveLockedMovementForRepeatUpload(analysis);
        if (lockedMovement) {
          console.log(
            `Deterministic movement lock for repeated upload: using prior detected movement "${lockedMovement}" instead of auto-detect`,
          );
          movementName = lockedMovement;
        }
      }

      const configKey = getConfigKey(sportName, movementName);
      const analysisFpsSnapshot = resolveAnalysisFpsModeForMovement(
        sportName,
        movementName,
        analysis.requestedSessionType,
        analysisFpsSettings,
      );

      console.log(
        `Starting Python analysis for: ${analysis.videoPath} (${sportName}/${movementName}, config: ${configKey})`,
      );
      const result = await runPythonAnalysis(
        localVideoPath,
        sportName,
        movementName,
        videoValidationMode,
        analysisFpsSnapshot,
        shouldUseCoreMetricComputation(configKey) ? "core" : "full",
        dominantProfile,
        options?.classificationModelSelection,
        async (event) => {
          await applyPipelineUpdate(event);
        },
      );

      if (result.rejected) {
        console.warn(
          `Analysis ${analysisId} rejected by pipeline validation mode ${videoValidationMode}: ${result.rejectionReason}`,
        );
        await db
          .update(analyses)
          .set({
            status: "rejected",
            rejectionReason: result.rejectionReason || "Video content does not match the selected validation mode.",
            ...buildUpdateAuditFields(auditActorUserId),
          })
          .where(eq(analyses.id, analysisId));
        return;
      }

      const actualMovement = result.detectedMovement || movementName;
      const wasOverridden = result.movementOverridden || false;

      if (wasOverridden) {
        console.log(
          `Movement override: user selected "${movementName}" but detected "${actualMovement}". Score: ${result.overallScore}`,
        );
      } else {
        console.log(
          `Python analysis complete. Overall score: ${result.overallScore}`,
        );
      }

      pipelineTiming = updatePipelineTiming(pipelineTiming, {
        stageKey: "diagnostics",
        status: "pending",
      });
      const diagnosticsPayload = pipelineTiming
        ? attachPipelineTiming(
          mergeValidationScreeningSnapshot({}, validationScreening),
          pipelineTiming,
        ) as AiDiagnosticsPayload
        : null;

      const metricValuesRaw: Record<string, unknown> = { ...result.metricValues };
      if (result.shotCount != null) {
        metricValuesRaw.shotCount = result.shotCount;
      }
      if (result.shotSpeed != null && Number.isFinite(result.shotSpeed)) {
        metricValuesRaw.shotSpeed = result.shotSpeed;
      }

      const normalizedMetricValues = normalizeMetricValuesForPersistence(
        metricValuesRaw,
        diagnosticsPayload,
      );

      const resolvedConfigKey = result.configKey || configKey;
      const metricValues = sanitizePersistedMap(normalizedMetricValues);
      const persistedTacticalScores = extractStandardizedTacticalScores10(
        sanitizePersistedMap(result.subScores || {}),
      );
      const persistedOverallScore = toPersistedScoreTen(result.overallScore);
      const scoreInputs = buildScoreInputsPayload(resolvedConfigKey, metricValues);
      const scoreOutputs = buildScoreOutputsPayload({
        configKey: resolvedConfigKey,
        detectedMovement: actualMovement,
        tacticalComponents: persistedTacticalScores,
        metricValues,
        overallScore: persistedOverallScore,
      });
      const coaching = buildPersonalizedCoaching({
        configKey: resolvedConfigKey,
        detectedMovement: actualMovement,
        overallScore: persistedOverallScore,
        scoreInputs,
        scoreOutputs,
        metricValues,
        preferences: userMetricPreferences,
      });

      await db.transaction(async (tx) => {
        await tx.delete(coachingInsights).where(eq(coachingInsights.analysisId, analysisId));
        await tx.delete(metrics).where(eq(metrics.analysisId, analysisId));

        await tx.insert(metrics).values({
          analysisId,
          configKey: resolvedConfigKey,
          modelVersion: selectedModelVersion,
          overallScore: persistedOverallScore,
          metricValues,
          scoreInputs,
          scoreOutputs,
          aiDiagnostics: diagnosticsPayload,
          ...buildInsertAuditFields(auditActorUserId),
        });

        await tx.insert(coachingInsights).values({
          analysisId,
          ...coaching,
          ...buildInsertAuditFields(auditActorUserId),
        });
      });

      await db
        .update(analyses)
        .set({
          status: "completed",
          detectedMovement: actualMovement,
          rejectionReason: null,
          ...buildUpdateAuditFields(auditActorUserId),
        })
        .where(eq(analyses.id, analysisId));

      void backfillAnalysisEnrichment({
        analysisId,
        videoPath: localVideoPath,
        sportName,
        movementName: actualMovement,
        dominantProfile,
        analysisArtifactPath: result.analysisArtifactPath,
        configKey: resolvedConfigKey,
        modelVersion: selectedModelVersion,
        auditActorUserId,
        classificationModelSelection: options?.classificationModelSelection,
      });

      void videoContentHashPromise;

      console.log(`Analysis ${analysisId} completed successfully`);
    });
  } catch (error) {
    console.error("Analysis processing error:", error);
    const failureMessage = error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : "Processing failed unexpectedly. Please try again.";
    const currentTiming = pipelineTiming as PipelineTiming | null;
    const currentStageKey = currentTiming?.currentStageKey ?? null;
    if (currentStageKey) {
      try {
        pipelineTiming = await persistPipelineTimingUpdate(
          analysisId,
          {
            stageKey: currentStageKey,
            status: "failed",
            note: failureMessage,
          },
          { existingTiming: currentTiming },
        );
      } catch (timingError) {
        console.warn("Failed to persist pipeline timing failure state:", timingError);
      }
    }
    await db
      .update(analyses)
      .set({
        status: "failed",
        rejectionReason: failureMessage,
        ...buildUpdateAuditFields(null),
      })
      .where(eq(analyses.id, analysisId));
  }
}
