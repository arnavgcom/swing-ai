import { db } from "./db";
import { analyses, metrics, coachingInsights, sportMovements, sports, users } from "@shared/schema";
import { and, desc, eq, isNotNull, ne, or } from "drizzle-orm";
import { execFile } from "child_process";
import { createHash } from "crypto";
import { getConfigKey } from "@shared/sport-configs";
import { readModelRegistryConfig } from "./model-registry";
import {
  normalizeRuntimeScoreToHundred,
  toPersistedScoreTen,
} from "./score-scale";
import { buildScoreInputsPayload } from "./score-input-params";
import { buildScoreOutputsPayload } from "./score-output-params";
import { extractStandardizedTacticalScores10 } from "./tactical-scores";
import fs from "fs";
import path from "path";
import type { AiDiagnosticsPayload, ScoreInputsPayload, ScoreOutputsPayload } from "@shared/schema";

interface PythonResult {
  configKey: string;
  overallScore: number;
  subScores: Record<string, number>;
  metricValues: Record<string, number>;
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

const PERCENT_LIKE_METRIC_KEYS = new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency",
]);

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function normalizeMetricScaleForPersistence(metricKey: string, value: number): number {
  if (!Number.isFinite(value)) return value;
  if (!PERCENT_LIKE_METRIC_KEYS.has(metricKey)) return round1(value);

  // Legacy analyzers may emit these metrics on a 0-100 scale; persist as 0-10.
  const scaled = value > 10 ? value / 10 : value;
  return round1(Math.max(0, Math.min(10, scaled)));
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
    path.resolve(process.cwd(), ".venv", "bin", "python3"),
    path.resolve(process.cwd(), ".venv", "bin", "python"),
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
  dominantProfile?: string | null,
): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();

    const args = [
      "-m",
      "python_analysis.run_analysis",
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

    execFile(
      pythonExecutable,
      args,
      {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Python analysis error:", error.message);
          if (stderr) console.error("Python stderr:", stderr);
          reject(new Error(`Python analysis failed: ${error.message}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          if (result.rejected) {
            resolve(result as PythonResult);
            return;
          }
          resolve(result as PythonResult);
        } catch (parseError) {
          console.error("Failed to parse Python output:", stdout);
          if (stderr) console.error("Python stderr:", stderr);
          reject(new Error("Failed to parse analysis results"));
        }
      },
    );
  });
}

function runPythonDiagnostics(
  videoPath: string,
  sportName: string,
  movementName: string,
  dominantProfile?: string | null,
): Promise<AiDiagnosticsPayload> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();

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

    execFile(
      pythonExecutable,
      args,
      {
        cwd: process.cwd(),
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
          resolve(result as AiDiagnosticsPayload);
        } catch {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error("Failed to parse diagnostics results"));
        }
      },
    );
  });
}

export async function processAnalysis(analysisId: string): Promise<void> {
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
      const [sport] = await db
        .select()
        .from(sports)
        .where(eq(sports.id, analysis.sportId));
      if (sport) {
        sportName = sport.name;
      }
    }

    const videoContentHash = await computeVideoContentHash(analysis.videoPath);
    if (videoContentHash) {
      await db
        .update(analyses)
        .set({ videoContentHash, updatedAt: new Date() })
        .where(eq(analyses.id, analysis.id));
      analysis.videoContentHash = videoContentHash;
    }

    let dominantProfile: string | null = null;
    if (analysis.userId) {
      const [profile] = await db
        .select({ dominantProfile: users.dominantProfile })
        .from(users)
        .where(eq(users.id, analysis.userId))
        .limit(1);
      dominantProfile = profile?.dominantProfile ?? null;
    }

    const modelRegistryConfig = readModelRegistryConfig();

    const reusablePayload = await findReusableAnalysisPayload(
      analysis,
      modelRegistryConfig.activeModelVersion,
    );
    if (reusablePayload) {
      let normalizedReusableMetrics = normalizeMetricValuesForPersistence(
        reusablePayload.metricValues || {},
        reusablePayload.aiDiagnostics,
      );
      let reusableDiagnosticsPayload: AiDiagnosticsPayload | null = reusablePayload.aiDiagnostics;

      if (!hasAllRequiredUploadDiagnosticsMetrics(normalizedReusableMetrics)) {
        try {
          const diagnosticsMovement = reusablePayload.detectedMovement || movementName;
          reusableDiagnosticsPayload = await runPythonDiagnostics(
            analysis.videoPath,
            sportName,
            diagnosticsMovement,
            dominantProfile,
          );
          normalizedReusableMetrics = normalizeMetricValuesForPersistence(
            normalizedReusableMetrics,
            reusableDiagnosticsPayload,
          );
        } catch (diagnosticsError: any) {
          console.warn(
            `Diagnostics backfill failed for reused analysis ${analysisId}: ${diagnosticsError?.message || diagnosticsError}`,
          );
        }
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
        });

        await tx.insert(coachingInsights).values({
          analysisId,
          ...reusablePayload.coaching,
        });
      });

      await db
        .update(analyses)
        .set({
          status: "completed",
          detectedMovement: reusablePayload.detectedMovement || movementName,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));

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

    console.log(
      `Starting Python analysis for: ${analysis.videoPath} (${sportName}/${movementName}, config: ${configKey})`,
    );
    const result = await runPythonAnalysis(
      analysis.videoPath,
      sportName,
      movementName,
      dominantProfile,
    );

    if (result.rejected) {
      console.log(
        `Analysis ${analysisId} rejected: ${result.rejectionReason}`,
      );
      await db
        .update(analyses)
        .set({
          status: "rejected",
          rejectionReason: result.rejectionReason || "Video content does not match the selected sport.",
          updatedAt: new Date(),
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

    const runtimeOverallScore100 = normalizeRuntimeScoreToHundred(result.overallScore);

    if (runtimeOverallScore100 != null && runtimeOverallScore100 < 15) {
      const sportLabel = sportName.charAt(0).toUpperCase() + sportName.slice(1);
      console.log(
        `Analysis ${analysisId} auto-rejected: score ${runtimeOverallScore100} below minimum threshold`,
      );
      await db
        .update(analyses)
        .set({
          status: "rejected",
          rejectionReason: `The video content could not be reliably analyzed as a ${sportLabel} movement. Please upload a clearer video of your ${sportLabel} technique.`,
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));
      return;
    }

    let diagnosticsPayload: AiDiagnosticsPayload | null = null;
    try {
      diagnosticsPayload = await runPythonDiagnostics(
        analysis.videoPath,
        sportName,
        actualMovement,
        dominantProfile,
      );
    } catch (diagnosticsError: any) {
      console.warn(
        `Diagnostics generation failed for analysis ${analysisId}: ${diagnosticsError?.message || diagnosticsError}`,
      );
    }

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

    await db.transaction(async (tx) => {
      await tx.delete(coachingInsights).where(eq(coachingInsights.analysisId, analysisId));
      await tx.delete(metrics).where(eq(metrics.analysisId, analysisId));

      await tx.insert(metrics).values({
        analysisId,
        configKey: resolvedConfigKey,
        modelVersion: modelRegistryConfig.activeModelVersion,
        overallScore: persistedOverallScore,
        metricValues,
        scoreInputs,
        scoreOutputs,
        aiDiagnostics: diagnosticsPayload,
      });

      await tx.insert(coachingInsights).values({
        analysisId,
        ...result.coaching,
      });
    });

    await db
      .update(analyses)
      .set({
        status: "completed",
        detectedMovement: actualMovement,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(analyses.id, analysisId));

    console.log(`Analysis ${analysisId} completed successfully`);
  } catch (error) {
    console.error("Analysis processing error:", error);
    await db
      .update(analyses)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));
  }
}
