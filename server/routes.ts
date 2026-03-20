import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage, type AnalysisMetadataInput } from "./storage";
import { processAnalysis } from "./analysis-engine";
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
  scoringModelRegistryEntries,
  scoringModelRegistryDatasetMetrics,
  analyses,
  metrics,
  coachingInsights,
} from "@shared/schema";
import { eq, asc, and, desc, inArray, sql } from "drizzle-orm";
import {
  getSportConfig,
  getAllConfigs,
  type MetricDefinition,
  type SportCategoryConfig,
} from "@shared/sport-configs";
import {
  getEvaluationDatasetVideoMap,
  incrementModelVersion,
  isMovementMatch,
  readEvaluationDatasetManifest,
  readModelRegistryConfig,
  syncVideoForModelTuning,
  updateManifestActiveModelVersion,
  validateEvaluationDatasetManifest,
  writeModelRegistryConfig,
} from "./model-registry";
import { persistedScoreToApiHundred } from "./score-scale";
import { normalizeTacticalScoresToApi100, readTacticalScoreValue } from "./tactical-scores";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import {
  copyStoredMediaToPath,
  deleteStoredMedia,
  ensureVideoStorageModeSetting,
  getVideoStorageMode,
  isStoredMediaLocallyAccessible,
  resolveMediaUrl,
  setVideoStorageMode,
  storeVideoBuffer,
  withLocalMediaFile,
} from "./media-storage";
import { PROJECT_ROOT, resolveProjectPath } from "./env";

const uploadDir = resolveProjectPath("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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

async function runVideoUploadMiddleware(req: Request, res: Response, next: Express.NextFunction) {
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
): Promise<any> {
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
        cwd: PROJECT_ROOT,
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

type ImprovedTennisScoreDetail = {
  key: string;
  label: string;
  score: number;
  explanation: string;
};

type ImprovedTennisReport = {
  stroke: ImprovedTennisStrokeType;
  biomechanics: ImprovedTennisScoreDetail[];
  movement: ImprovedTennisScoreDetail[];
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

function buildImprovedTennisReportFromMetrics(
  detectedMovement: unknown,
  metricValuesRaw: unknown,
): ImprovedTennisReport {
  const metricValues =
    metricValuesRaw && typeof metricValuesRaw === "object"
      ? (metricValuesRaw as Record<string, unknown>)
      : {};

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
  const splitStepTime = improvedPickMetric(metricValues, ["splitStepTime", "splitStepTiming", "split_step_time"]);
  const reactionTime = improvedPickMetric(metricValues, ["reactionTime", "reactionSpeed", "reaction_time"]);
  const recoveryTime = improvedPickMetric(metricValues, ["recoveryTime", "recoverySpeed", "recovery_time"]);
  const ballSpeed = improvedPickMetric(metricValues, ["ballSpeed", "avgBallSpeed", "ball_speed"]);

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
    stroke,
    biomechanics,
    movement,
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

const MODEL_EVALUATION_MODE_KEY = "modelEvaluationMode";

function getModelEvaluationModeKey(userId?: string): string {
  const uid = String(userId || "").trim();
  if (!uid) return MODEL_EVALUATION_MODE_KEY;
  return `${MODEL_EVALUATION_MODE_KEY}:${uid}`;
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
        unit: row.unit || existing.unit,
        optimalRange: [Number(row.optimalMin), Number(row.optimalMax)],
      });
      continue;
    }

    metricsByKey.set(key, {
      key,
      label: row.metricLabel || key,
      unit: row.unit || "",
      icon: "analytics-outline",
      category: "technique",
      color: "#60A5FA",
      description: "Optimal range configured in database.",
      optimalRange: [Number(row.optimalMin), Number(row.optimalMax)],
    });
  }

  const metrics: MetricDefinition[] = Array.from(metricsByKey.values()).map((metric) => {
    const row = byMetricKey.get(metric.key);
    if (!row) return metric;
    return {
      ...metric,
      label: row.metricLabel || metric.label,
      unit: row.unit || metric.unit,
      optimalRange: [Number(row.optimalMin), Number(row.optimalMax)],
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

async function getModelEvaluationMode(userId?: string): Promise<boolean> {
  const scopedKey = getModelEvaluationModeKey(userId);
  const [scopedSetting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, scopedKey))
    .limit(1);

  if (scopedSetting?.value && typeof scopedSetting.value === "object") {
    return Boolean((scopedSetting.value as Record<string, unknown>).enabled);
  }

  // Backward compatibility with legacy global key.
  const [legacySetting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, MODEL_EVALUATION_MODE_KEY))
    .limit(1);

  if (!legacySetting?.value || typeof legacySetting.value !== "object") return false;
  return Boolean((legacySetting.value as Record<string, unknown>).enabled);
}

async function setModelEvaluationMode(enabled: boolean, userId?: string, actorUserId?: string | null): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: getModelEvaluationModeKey(userId),
      value: { enabled },
      ...buildInsertAuditFields(actorUserId || userId),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { enabled },
        ...buildUpdateAuditFields(actorUserId || userId),
      },
    });
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
    sourceFilename ? `model_evaluation_datasets/dataset/${sourceFilename}` : "",
    videoFilename,
    videoFilename ? `model_evaluation_datasets/dataset/${videoFilename}` : "",
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
    update scoring_model_registry_entries
    set
      updated_at = coalesce(updated_at, created_at, now()),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id)
    where updated_at is null
       or updated_by_user_id is null
  `);

  await db.execute(sql`
    update scoring_model_registry_dataset_metrics as dm
    set
      created_at = coalesce(dm.created_at, dm.updated_at, re.created_at, now()),
      updated_at = coalesce(dm.updated_at, dm.created_at, re.updated_at, re.created_at, now()),
      created_by_user_id = coalesce(dm.created_by_user_id, re.created_by_user_id),
      updated_by_user_id = coalesce(dm.updated_by_user_id, dm.created_by_user_id, re.updated_by_user_id, re.created_by_user_id)
    from scoring_model_registry_entries as re
    where dm.registry_entry_id = re.id
      and (
        dm.created_at is null
        or dm.updated_at is null
        or dm.created_by_user_id is null
        or dm.updated_by_user_id is null
      )
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
): Promise<{ refreshed: number; skipped: number }> {
  const modelConfig = readModelRegistryConfig();
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
          modelVersion: modelConfig.activeModelVersion,
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
          target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId],
          set: {
            videoName: analysis.videoFilename,
            sportName,
            movementName,
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

  await db.execute(sql`alter table sports add column if not exists created_at timestamp default now()`);
  await db.execute(sql`alter table sports add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table sports add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table sports add column if not exists updated_by_user_id varchar`);

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
      notes text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
      ,created_by_user_id varchar
      ,updated_by_user_id varchar
    )
  `);

  await db.execute(sql`alter table analysis_shot_annotations add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table analysis_shot_annotations add column if not exists updated_by_user_id varchar`);

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
    create unique index if not exists analysis_shot_discrepancies_analysis_user_uq
    on analysis_shot_discrepancies (analysis_id, user_id)
  `);

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

  await db.execute(sql`alter table app_settings add column if not exists created_at timestamp default now()`);
  await db.execute(sql`alter table app_settings add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table app_settings add column if not exists updated_by_user_id varchar`);

  await ensureVideoStorageModeSetting();

  await db.execute(sql`
    create table if not exists scoring_model_registry_entries (
      id varchar primary key default gen_random_uuid(),
      model_version varchar not null,
      model_version_description text not null,
      movement_type text not null,
      movement_detection_accuracy_pct real not null,
      scoring_accuracy_pct real not null,
      datasets_used jsonb not null default '[]'::jsonb,
      manifest_model_version varchar not null default '0.1',
      manifest_datasets jsonb not null default '[]'::jsonb,
      created_by_user_id varchar references users(id),
      updated_by_user_id varchar references users(id),
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `);

  await db.execute(sql`alter table scoring_model_registry_entries add column if not exists updated_by_user_id varchar`);
  await db.execute(sql`alter table scoring_model_registry_entries add column if not exists updated_at timestamp default now()`);

  await db.execute(sql`
    create table if not exists scoring_model_registry_dataset_metrics (
      id varchar primary key default gen_random_uuid(),
      registry_entry_id varchar not null references scoring_model_registry_entries(id),
      dataset_name text not null,
      movement_type text not null,
      movement_detection_accuracy_pct real not null,
      scoring_accuracy_pct real not null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      created_by_user_id varchar,
      updated_by_user_id varchar
    )
  `);

  await db.execute(sql`alter table scoring_model_registry_dataset_metrics add column if not exists created_at timestamp default now()`);
  await db.execute(sql`alter table scoring_model_registry_dataset_metrics add column if not exists updated_at timestamp default now()`);
  await db.execute(sql`alter table scoring_model_registry_dataset_metrics add column if not exists created_by_user_id varchar`);
  await db.execute(sql`alter table scoring_model_registry_dataset_metrics add column if not exists updated_by_user_id varchar`);

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
  await db.execute(sql`alter table scoring_model_registry_entries add column if not exists manifest_model_version varchar not null default '0.1'`);
  await db.execute(sql`alter table scoring_model_registry_entries add column if not exists manifest_datasets jsonb not null default '[]'::jsonb`);

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

  const markStaleProcessingAsFailed = async (userId?: string) => {
    if (userId) {
      await db.execute(sql`
        update analyses
        set status = 'failed',
            rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
            updated_at = now()
        where status = 'processing'
          and updated_at < now() - interval '10 minutes'
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
        and updated_at < now() - interval '10 minutes'
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

  app.get("/api/model-evaluation/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const enabled = await getModelEvaluationMode(userId);
      const modelConfig = readModelRegistryConfig();
      const manifest = readEvaluationDatasetManifest(modelConfig);
      const totalVideos = manifest.datasets.reduce((sum, dataset) => sum + dataset.videos.length, 0);

      res.json({
        enabled,
        isAdmin,
        modelVersion: modelConfig.activeModelVersion,
        modelVersionChangeDescription: modelConfig.modelVersionChangeDescription,
        datasetCount: manifest.datasets.length,
        totalVideos,
      });
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

      const config = readModelRegistryConfig();
      const manifestValidation = validateEvaluationDatasetManifest(config);
      res.json({ ...config, manifestValidation });
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
      const evaluationDatasetManifestPath = String(req.body?.evaluationDatasetManifestPath || "").trim();

      if (!activeModelVersion) {
        return res.status(400).json({ error: "activeModelVersion is required" });
      }
      if (!evaluationDatasetManifestPath) {
        return res.status(400).json({ error: "evaluationDatasetManifestPath is required" });
      }

      const next = writeModelRegistryConfig({
        activeModelVersion,
        modelVersionChangeDescription,
        evaluationDatasetManifestPath,
      });
      const manifestValidation = validateEvaluationDatasetManifest(next);
      res.json({ ...next, manifestValidation });
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
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/model-evaluation/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const enabled = Boolean(req.body?.enabled);
      await setModelEvaluationMode(enabled, userId, userId);
      res.json({ enabled });
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

      res.json({
        ...dashboard,
        modelEvaluationMode: await getModelEvaluationMode(userId),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/scoring-model/registry/save", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const evaluationModeEnabled = await getModelEvaluationMode(userId);
      if (!evaluationModeEnabled) {
        return res.status(400).json({ error: "Model Evaluation Mode must be enabled" });
      }

      const dashboard = await buildScoringModelDashboard(
        userId,
        true,
        String(req.body?.movementName || req.query.movementName || ""),
        String(req.body?.playerId || req.query.playerId || ""),
      );
      const configBeforeSave = readModelRegistryConfig();
      const manifestBeforeSave = readEvaluationDatasetManifest(configBeforeSave);
      const manifestModelVersion = String(
        manifestBeforeSave.activeModelVersion || configBeforeSave.activeModelVersion || dashboard.modelVersion,
      ).trim();

      const [entry] = await db
        .insert(scoringModelRegistryEntries)
        .values({
          modelVersion: dashboard.modelVersion,
          modelVersionDescription: dashboard.modelVersionDescription,
          movementType: dashboard.movementType,
          movementDetectionAccuracyPct: dashboard.movementDetectionAccuracyPct,
          scoringAccuracyPct: dashboard.scoringAccuracyPct,
          datasetsUsed: dashboard.datasetsUsed,
          manifestModelVersion,
          manifestDatasets: manifestBeforeSave.datasets,
          createdByUserId: userId,
          updatedByUserId: userId,
          ...buildInsertAuditFields(userId),
        })
        .returning();

      if (dashboard.datasetMetrics.length > 0) {
        await db.insert(scoringModelRegistryDatasetMetrics).values(
          dashboard.datasetMetrics.map((metric) => ({
            registryEntryId: entry.id,
            datasetName: metric.datasetName,
            movementType: metric.movementType,
            movementDetectionAccuracyPct: metric.movementDetectionAccuracyPct,
            scoringAccuracyPct: metric.scoringAccuracyPct,
            ...buildInsertAuditFields(userId),
          })),
        );
      }

      const nextModelVersion = incrementModelVersion(dashboard.modelVersion);
      const nextConfig = writeModelRegistryConfig({
        ...configBeforeSave,
        activeModelVersion: nextModelVersion,
      });
      updateManifestActiveModelVersion(nextModelVersion, nextConfig);

      res.json({ id: entry.id, saved: true, nextModelVersion });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scoring-model/registry", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const entries = await db
        .select()
        .from(scoringModelRegistryEntries)
        .orderBy(desc(scoringModelRegistryEntries.createdAt))
        .limit(100);

      const entryIds = entries.map((entry) => entry.id);
      const datasetMetrics = entryIds.length
        ? await db
            .select()
            .from(scoringModelRegistryDatasetMetrics)
            .where(inArray(scoringModelRegistryDatasetMetrics.registryEntryId, entryIds))
        : [];

      const metricsByEntry = new Map<string, typeof datasetMetrics>();
      for (const metric of datasetMetrics) {
        const current = metricsByEntry.get(metric.registryEntryId) || [];
        current.push(metric);
        metricsByEntry.set(metric.registryEntryId, current);
      }

      const analysisRows = await db
        .select({
          analysis: analyses,
        })
        .from(analyses)
        .orderBy(desc(analyses.createdAt));

      const normalizeFilenameToken = (value: string): string => {
        return path.basename(String(value || "").trim()).toLowerCase();
      };

      const selectedAnalysisIdsByEntry = new Map<string, string[]>();
      const allSelectedAnalysisIds = new Set<string>();

      for (const entry of entries) {
        const manifestDatasets = Array.isArray(entry.manifestDatasets)
          ? entry.manifestDatasets
          : [];

        const manifestVideos = manifestDatasets.flatMap((dataset: any) => {
          const videos = Array.isArray(dataset?.videos) ? dataset.videos : [];
          return videos.map((video: any) => ({
            videoId: String(video?.videoId || "").trim(),
            filename: String(video?.filename || "").trim(),
          }));
        });

        const selectedIds = new Set<string>();
        for (const manifestVideo of manifestVideos) {
          const manifestVideoId = manifestVideo.videoId;
          const manifestFilenameBase = normalizeFilenameToken(manifestVideo.filename);

          const match = analysisRows.find((row) => {
            const analysisVideoId = String(row.analysis.evaluationVideoId || "").trim();
            if (manifestVideoId && analysisVideoId && analysisVideoId === manifestVideoId) {
              return true;
            }

            const sourceFilenameBase = normalizeFilenameToken(String(row.analysis.sourceFilename || ""));
            const videoFilenameBase = normalizeFilenameToken(String(row.analysis.videoFilename || ""));

            return (
              !!manifestFilenameBase
              && (sourceFilenameBase === manifestFilenameBase || videoFilenameBase === manifestFilenameBase)
            );
          });

          if (match?.analysis?.id) {
            selectedIds.add(match.analysis.id);
          }
        }

        const ids = Array.from(selectedIds);
        selectedAnalysisIdsByEntry.set(entry.id, ids);
        for (const id of ids) {
          allSelectedAnalysisIds.add(id);
        }
      }

      const selectedDiscrepancySnapshots = allSelectedAnalysisIds.size
        ? await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(inArray(analysisShotDiscrepancies.analysisId, Array.from(allSelectedAnalysisIds)))
        : [];

      const historyByAnalysisId = new Map<string, Array<typeof analysisShotDiscrepancies.$inferSelect>>();
      for (const snapshot of selectedDiscrepancySnapshots) {
        const list = historyByAnalysisId.get(snapshot.analysisId) || [];
        list.push(snapshot);
        historyByAnalysisId.set(snapshot.analysisId, list);
      }
      for (const [analysisId, list] of historyByAnalysisId.entries()) {
        historyByAnalysisId.set(
          analysisId,
          [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
      }

      const modelVersions = Array.from(
        new Set(entries.map((entry) => String(entry.modelVersion || "").trim()).filter(Boolean)),
      );

      const versionDiscrepancySnapshots = modelVersions.length
        ? await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(inArray(analysisShotDiscrepancies.modelVersion, modelVersions))
        : [];

      const mismatchByVersion = new Map<string, { mismatches: number; manualShots: number }>();
      for (const snapshot of versionDiscrepancySnapshots) {
        const version = String(snapshot.modelVersion || "").trim();
        if (!version) continue;
        const current = mismatchByVersion.get(version) || { mismatches: 0, manualShots: 0 };
        current.mismatches += Number(snapshot.mismatches || 0);
        current.manualShots += Number(snapshot.manualShots || 0);
        mismatchByVersion.set(version, current);
      }

      res.json(
        entries.map((entry) => {
          const targetVersion = String(entry.modelVersion || "").trim();
          const selectedAnalysisIds = selectedAnalysisIdsByEntry.get(entry.id) || [];

          let manifestManualShots = 0;
          let manifestMismatches = 0;

          for (const analysisId of selectedAnalysisIds) {
            const history = historyByAnalysisId.get(analysisId) || [];
            if (!history.length) continue;
            const targetSnapshot = history.find(
              (snapshot) => String(snapshot.modelVersion || "").trim() === targetVersion,
            );
            const snapshot = targetSnapshot || history[0];
            manifestManualShots += Number(snapshot.manualShots || 0);
            manifestMismatches += Number(snapshot.mismatches || 0);
          }

          const manifestMismatchRatePct = manifestManualShots > 0
            ? Number(((manifestMismatches / manifestManualShots) * 100).toFixed(1))
            : null;

          const versionWide = mismatchByVersion.get(targetVersion);
          const versionMismatchRatePct = versionWide && versionWide.manualShots > 0
            ? Number(((versionWide.mismatches / versionWide.manualShots) * 100).toFixed(1))
            : null;

          const fallbackMismatchRatePct = Number(
            (100 - Number(entry.scoringAccuracyPct || 0)).toFixed(1),
          );

          const mismatchRatePct =
            manifestMismatchRatePct
            ?? versionMismatchRatePct
            ?? fallbackMismatchRatePct;

          return {
            ...entry,
            mismatchRatePct: Math.max(0, Math.min(100, mismatchRatePct)),
            datasetMetrics: metricsByEntry.get(entry.id) || [],
          };
        }),
      );
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scoring-model/registry/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const [entry] = await db
        .select()
        .from(scoringModelRegistryEntries)
        .where(eq(scoringModelRegistryEntries.id, req.params.id))
        .limit(1);

      if (!entry) {
        return res.status(404).json({ error: "Registry entry not found" });
      }

      const datasetMetrics = await db
        .select()
        .from(scoringModelRegistryDatasetMetrics)
        .where(eq(scoringModelRegistryDatasetMetrics.registryEntryId, entry.id));

      const manifestDatasets = Array.isArray(entry.manifestDatasets)
        ? entry.manifestDatasets
        : [];
      const manifestVideos = manifestDatasets.flatMap((dataset: any) => {
        const datasetName = String(dataset?.name || "").trim();
        const videos = Array.isArray(dataset?.videos) ? dataset.videos : [];
        return videos.map((video: any) => ({
          datasetName,
          videoId: String(video?.videoId || "").trim(),
          filename: String(video?.filename || "").trim(),
          movementType: String(video?.movementType || "").trim(),
        }));
      });

      const analysisRows = await db
        .select({
          analysis: analyses,
          userName: users.name,
        })
        .from(analyses)
        .leftJoin(users, eq(analyses.userId, users.id))
        .orderBy(desc(analyses.createdAt));

      const normalizeFilenameToken = (value: string): string => {
        return path.basename(String(value || "").trim()).toLowerCase();
      };

      const selectedByAnalysisId = new Map<string, {
        analysis: typeof analyses.$inferSelect;
        userName: string | null;
        movementType: string;
      }>();

      for (const manifestVideo of manifestVideos) {
        const manifestVideoId = manifestVideo.videoId;
        const manifestFilename = manifestVideo.filename;
        const manifestFilenameBase = normalizeFilenameToken(manifestFilename);

        const match = analysisRows.find((row) => {
          const analysisVideoId = String(row.analysis.evaluationVideoId || "").trim();
          if (manifestVideoId && analysisVideoId && analysisVideoId === manifestVideoId) {
            return true;
          }

          const sourceFilenameBase = normalizeFilenameToken(String(row.analysis.sourceFilename || ""));
          const videoFilenameBase = normalizeFilenameToken(String(row.analysis.videoFilename || ""));

          return (
            !!manifestFilenameBase
            && (sourceFilenameBase === manifestFilenameBase || videoFilenameBase === manifestFilenameBase)
          );
        });

        if (!match) continue;

        if (!selectedByAnalysisId.has(match.analysis.id)) {
          selectedByAnalysisId.set(match.analysis.id, {
            analysis: match.analysis,
            userName: match.userName || null,
            movementType: manifestVideo.movementType,
          });
        }
      }

      const selectedRows = [...selectedByAnalysisId.values()];
      const selectedAnalysisIds = selectedRows.map((row) => row.analysis.id);

      const discrepancyRows = selectedAnalysisIds.length
        ? await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(inArray(analysisShotDiscrepancies.analysisId, selectedAnalysisIds))
        : [];

      const discrepancyHistoryByAnalysisId = new Map<string, Array<typeof analysisShotDiscrepancies.$inferSelect>>();
      for (const snapshot of discrepancyRows) {
        const list = discrepancyHistoryByAnalysisId.get(snapshot.analysisId) || [];
        list.push(snapshot);
        discrepancyHistoryByAnalysisId.set(snapshot.analysisId, list);
      }
      for (const [analysisId, list] of discrepancyHistoryByAnalysisId.entries()) {
        discrepancyHistoryByAnalysisId.set(
          analysisId,
          [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
      }

      const snapshotsByAnalysisId = new Map<string, typeof analysisShotDiscrepancies.$inferSelect>();
      for (const snapshot of discrepancyRows) {
        const current = snapshotsByAnalysisId.get(snapshot.analysisId);
        if (!current) {
          snapshotsByAnalysisId.set(snapshot.analysisId, snapshot);
          continue;
        }

        const currentIsTargetVersion = current.modelVersion === entry.modelVersion;
        const nextIsTargetVersion = snapshot.modelVersion === entry.modelVersion;

        if (!currentIsTargetVersion && nextIsTargetVersion) {
          snapshotsByAnalysisId.set(snapshot.analysisId, snapshot);
          continue;
        }

        if (currentIsTargetVersion && !nextIsTargetVersion) {
          continue;
        }

        if (new Date(snapshot.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
          snapshotsByAnalysisId.set(snapshot.analysisId, snapshot);
        }
      }

      let filteredRows = selectedRows.map((row) => {
        return {
          analysis: row.analysis,
          userName: row.userName,
          movementType: row.movementType,
          discrepancy: snapshotsByAnalysisId.get(row.analysis.id) || null,
        };
      });

      if (filteredRows.length === 0) {
        const fallbackRows = await db
          .select({
            discrepancy: analysisShotDiscrepancies,
            analysis: analyses,
            userName: users.name,
          })
          .from(analysisShotDiscrepancies)
          .innerJoin(analyses, eq(analysisShotDiscrepancies.analysisId, analyses.id))
          .leftJoin(users, eq(analyses.userId, users.id))
          .where(eq(analysisShotDiscrepancies.modelVersion, entry.modelVersion))
          .orderBy(
            desc(analysisShotDiscrepancies.mismatchRatePct),
            desc(analysisShotDiscrepancies.mismatches),
            desc(analysisShotDiscrepancies.updatedAt),
          );

        filteredRows = fallbackRows.map((row) => ({
          analysis: row.analysis,
          userName: row.userName || null,
          movementType: row.discrepancy.movementName,
          discrepancy: row.discrepancy,
        }));
      }

      const confusionMap = new Map<string, number>();
      let totalManualShots = 0;
      let totalMismatches = 0;
      let videosWithDiscrepancy = 0;

      const topVideos = filteredRows.map((row) => {
        const manualShots = Number(row.discrepancy?.manualShots || 0);
        const mismatches = Number(row.discrepancy?.mismatches || 0);
        if (mismatches > 0) {
          videosWithDiscrepancy += 1;
        }

        totalManualShots += manualShots;
        totalMismatches += mismatches;

        const confusionPairs = Array.isArray(row.discrepancy?.confusionPairs)
          ? row.discrepancy?.confusionPairs
          : [];
        for (const pair of confusionPairs as Array<{ from?: string; to?: string; count?: number }>) {
          const from = normalizeShotLabel(pair.from || "unknown");
          const to = normalizeShotLabel(pair.to || "unknown");
          const key = `${from}=>${to}`;
          confusionMap.set(key, (confusionMap.get(key) || 0) + Number(pair.count || 0));
        }

        const createdAt = row.analysis.capturedAt || row.analysis.createdAt;
        const snapshotHistory = discrepancyHistoryByAnalysisId.get(row.analysis.id) || [];
        const currentModelVersion = String(row.discrepancy?.modelVersion || "").trim();
        const previousSnapshot = snapshotHistory.find(
          (snapshot) => String(snapshot.modelVersion || "").trim() !== currentModelVersion,
        );
        const currentMismatchRatePct = Number(row.discrepancy?.mismatchRatePct || 0);
        const previousMismatchRatePct = Number(previousSnapshot?.mismatchRatePct || 0);
        const mismatchDeltaPct = previousSnapshot
          ? Number((currentMismatchRatePct - previousMismatchRatePct).toFixed(1))
          : 0;
        const isNewVideo = !previousSnapshot;

        return {
          analysisId: row.analysis.id,
          videoName: row.analysis.videoFilename,
          userName: row.userName || null,
          createdAt: createdAt.toISOString(),
          sportName: row.discrepancy?.sportName || "Tennis",
          movementName: row.discrepancy?.movementName || row.movementType || row.analysis.detectedMovement || "unknown",
          autoShots: Number(row.discrepancy?.autoShots || 0),
          manualShots,
          mismatches,
          mismatchRatePct: currentMismatchRatePct,
          mismatchDeltaPct,
          isNewVideo,
        };
      });

      const labelConfusions = Array.from(confusionMap.entries())
        .map(([pair, count]) => {
          const [from, to] = pair.split("=>");
          return { from, to, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const mismatchRatePct = Number(
        ((totalMismatches / Math.max(totalManualShots, 1)) * 100).toFixed(1),
      );

      res.json({
        ...entry,
        datasetMetrics,
        summary: {
          videosAnnotated: filteredRows.length,
          totalVideosConsidered: filteredRows.length,
          videosWithDiscrepancy,
          totalShots: totalManualShots,
          totalManualShots,
          totalMismatches,
          mismatchRatePct,
        },
        topVideos,
        labelConfusions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports", async (_req: Request, res: Response) => {
    try {
      const allSports = await db
        .select()
        .from(sports)
        .orderBy(asc(sports.sortOrder));
      res.json(allSports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports/:sportId/movements", async (req: Request, res: Response) => {
    try {
      const movements = await db
        .select()
        .from(sportMovements)
        .where(eq(sportMovements.sportId, req.params.sportId))
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
      const config = getSportConfig(req.params.configKey);
      if (!config) {
        return res.status(404).json({ error: "Sport config not found" });
      }

      const rangeRows = await fetchMetricRangeRows({
        configKey: req.params.configKey,
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

      res.json(rows);
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
      const optimalMin = Number(req.body?.optimalMin);
      const optimalMax = Number(req.body?.optimalMax);
      const isActive = req.body?.isActive == null ? true : Boolean(req.body?.isActive);

      if (!configKey || !metricKey || !sportName || !movementName || !unit) {
        return res.status(400).json({
          error: "configKey, metricKey, sportName, movementName, and unit are required",
        });
      }

      if (!Number.isFinite(optimalMin) || !Number.isFinite(optimalMax)) {
        return res.status(400).json({ error: "optimalMin and optimalMax must be numbers" });
      }

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
          unit,
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
            unit,
            optimalMin,
            optimalMax,
            isActive,
            source: "admin",
            ...buildUpdateAuditFields(userId),
          },
        });

      const rows = await fetchMetricRangeRows({ configKey, metricKey, includeInactive: true });
      res.json(rows[0] || null);
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
        const optimalMin = Number(raw.optimalMin);
        const optimalMax = Number(raw.optimalMax);
        const isActive = raw.isActive == null ? true : Boolean(raw.isActive);

        if (!configKey || !metricKey || !sportName || !movementName || !unit) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: configKey, metricKey, sportName, movementName, and unit are required`,
          });
        }

        if (!Number.isFinite(optimalMin) || !Number.isFinite(optimalMax)) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: optimalMin and optimalMax must be numbers`,
          });
        }

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
          unit,
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
    runVideoUploadMiddleware,
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }

        const storageMode = await getVideoStorageMode();

        const requesterUserId = req.session.userId!;

        const evaluationModeEnabled = await getModelEvaluationMode(requesterUserId);
        const originalFilename = path.basename(String(req.file.originalname || "")).trim();

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

        let resolvedSportId: string | null = null;
        let resolvedMovementId: string | null = null;
        let resolvedSportName = "";
        let resolvedMovementName = "";

        if (sportId) {
          const [sport] = await db.select().from(sports).where(eq(sports.id, sportId));
          if (sport) {
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
              const [movementSport] = await db
                .select()
                .from(sports)
                .where(eq(sports.id, movement.sportId));
              if (movementSport) {
                resolvedSportName = movementSport.name;
              }
            }
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
          : req.file.path;
        const sourceFilename = evaluationModeEnabled && originalFilename
          ? originalFilename
          : null;
        const evaluationVideoId = null;

        const extractedMetadata = await withLocalMediaFile(finalPath, finalFilename, async (localPath) =>
          extractVideoMetadata(localPath)
        );

        const analysis = await storage.createAnalysis(
          finalFilename,
          finalPath,
          userId,
          resolvedSportId,
          resolvedMovementId,
          extractedMetadata,
          sourceFilename,
          evaluationVideoId,
          requesterUserId,
        );

        processAnalysis(analysis.id).catch(console.error);

        res.json({
          id: analysis.id,
          status: analysis.status,
          message: "Video uploaded successfully. Processing started.",
        });
      } catch (error: any) {
        console.error("Upload error:", error);
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
      const evaluationModeEnabled = isAdmin ? await getModelEvaluationMode(userId) : false;
      const evaluationVideoMap = evaluationModeEnabled
        ? getEvaluationDatasetVideoMap(readModelRegistryConfig())
        : null;

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);

      const query = db
        .select({
          id: analyses.id,
          userId: analyses.userId,
          sportId: analyses.sportId,
          movementId: analyses.movementId,
          videoFilename: analyses.videoFilename,
          sourceFilename: analyses.sourceFilename,
          evaluationVideoId: analyses.evaluationVideoId,
          videoPath: analyses.videoPath,
          status: analyses.status,
          detectedMovement: analyses.detectedMovement,
          capturedAt: analyses.capturedAt,
          createdAt: analyses.createdAt,
          updatedAt: analyses.updatedAt,
          userName: users.name,
          overallScore: metrics.overallScore,
          metricValues: metrics.metricValues,
          scoreOutputs: metrics.scoreOutputs,
          configKey: metrics.configKey,
          modelVersion: metrics.modelVersion,
        })
        .from(analyses)
        .leftJoin(users, eq(analyses.userId, users.id))
        .leftJoin(metrics, eq(analyses.id, metrics.analysisId));

      const rows = isAdmin
        ? await query.orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`)
        : await query
            .where(eq(analyses.userId, userId))
            .orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);

      const normalizedRows = rows.map((row) => {
        const normalized = normalizeScoreRow(row);
        return {
          ...normalized,
          sectionScores: computeSummarySectionScores({
            scoreOutputs: row.scoreOutputs,
          }),
        };
      });

      if (evaluationVideoMap && isAdmin) {
        const filteredRows = normalizedRows.filter((row) => getEvaluationMatch(row, evaluationVideoMap));
        return res.json(await Promise.all(filteredRows.map((row) => attachVideoUrl(row))));
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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

      const metricsData = await storage.getMetrics(req.params.id);
      const insights = await storage.getCoachingInsights(req.params.id);

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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(req.params.id);
      if (!metricsData) {
        return res.status(404).json({ error: "Metrics not found for analysis" });
      }

      return res.json({
        analysisId: req.params.id,
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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

      const metricsData = await storage.getMetrics(req.params.id);

      const baseMetricValues = (metricsData?.metricValues || {}) as Record<string, unknown>;
      const inputMetrics = {
        ...baseMetricValues,
      };

      const report = buildImprovedTennisReportFromMetrics(
        analysis.detectedMovement,
        inputMetrics,
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const whereClause = isAdmin
        ? eq(analysisShotAnnotations.analysisId, req.params.id)
        : and(
            eq(analysisShotAnnotations.analysisId, req.params.id),
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

      const evaluationVideoMap = getEvaluationDatasetVideoMap(readModelRegistryConfig());
      const useForModelTraining = Boolean(getEvaluationMatch(analysis, evaluationVideoMap));

      res.json({
        ...annotation,
        useForModelTraining,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/shot-annotation", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
      const notes = req.body?.notes ? String(req.body.notes) : null;
      const useForModelTraining = isAdmin && Boolean(req.body?.useForModelTraining);

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
            eq(analysisShotAnnotations.analysisId, req.params.id),
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
            notes,
            ...buildUpdateAuditFields(userId),
          })
          .where(eq(analysisShotAnnotations.id, existing.id));
      } else {
        await db.insert(analysisShotAnnotations).values({
          analysisId: req.params.id,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes,
          ...buildInsertAuditFields(userId),
        });
      }

      const [saved] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, req.params.id),
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

      if (isAdmin) {
        const movementForManifest = String(
          analysis.detectedMovement || movementName || "unknown",
        )
          .trim()
          .toLowerCase();

        try {
          const syncResult = useForModelTraining
            ? await withLocalMediaFile(
                analysis.videoPath,
                analysis.videoFilename,
                async (localPath) =>
                  syncVideoForModelTuning({
                    sourceVideoPath: localPath,
                    sourceVideoFilename: analysis.videoFilename,
                    movementType: movementForManifest,
                    enabled: useForModelTraining,
                    videoId: analysis.evaluationVideoId || undefined,
                  }),
              )
            : syncVideoForModelTuning({
                sourceVideoPath: analysis.videoPath,
                sourceVideoFilename: analysis.videoFilename,
                movementType: movementForManifest,
                enabled: useForModelTraining,
                videoId: analysis.evaluationVideoId || undefined,
              });

          if (useForModelTraining && syncResult.videoId !== analysis.evaluationVideoId) {
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
              "Failed to sync evaluation dataset manifest for model tuning",
          });
        }
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
            target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId],
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
          notes,
        }),
        useForModelTraining,
        discrepancySnapshotUpdated,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/shot-report", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
            eq(analysisShotAnnotations.analysisId, req.params.id),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      res.json({
        analysisId: req.params.id,
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
        ? await db.select().from(analysisShotDiscrepancies)
        : await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(eq(analysisShotDiscrepancies.userId, userId));

      const snapshotByAnalysisId = new Map(
        existingSnapshots.map((item) => [`${item.analysisId}:${item.userId}`, item]),
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
        const snapshotKey = `${analysis.id}:${annotationOwnerId}`;
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
              target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId],
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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

      await db
        .update(metrics)
        .set({ aiDiagnostics: diagnostics })
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

      res.json(diagnostics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/skeleton/shot/:shotId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(req.params.id);

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
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(req.params.id);
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
        eq(analyses.userId, analysis.userId),
        eq(analyses.status, "completed"),
        eq(metrics.configKey, metricsData.configKey),
        sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) <= ${baseDate}`,
      ];

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

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);
      const rawAnalyses = isAdmin
        ? await storage.getAllAnalyses(null)
        : await storage.getAllAnalyses(userId);
      const storageMode = await getVideoStorageMode();
      const evaluationModeEnabled = await getModelEvaluationMode(userId);
      const videoMap = evaluationModeEnabled
        && isAdmin
        ? getEvaluationDatasetVideoMap(readModelRegistryConfig())
        : null;
      const userAnalyses = videoMap
        ? rawAnalyses.filter((analysis) => getEvaluationMatch(analysis, videoMap))
        : rawAnalyses;

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
          .map((analysis) => path.resolve(analysis.videoPath)),
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
          await db
            .update(analyses)
            .set({
              videoFilename: exactNameCandidate.filename,
              videoPath: exactNameCandidate.fullPath,
              updatedAt: new Date(),
            })
            .where(eq(analyses.id, analysis.id));

          runnableAnalyses.push({
            ...analysis,
            videoFilename: exactNameCandidate.filename,
            videoPath: exactNameCandidate.fullPath,
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

        await db
          .update(analyses)
          .set({
            videoFilename: bestCandidate.filename,
            videoPath: bestCandidate.fullPath,
            updatedAt: new Date(),
          })
          .where(eq(analyses.id, analysis.id));

        unassignedUploadFiles.delete(path.resolve(bestCandidate.fullPath));
        runnableAnalyses.push({
          ...analysis,
          videoFilename: bestCandidate.filename,
          videoPath: bestCandidate.fullPath,
        });
        autoRelinkedAnalyses += 1;
      }

      const ids = runnableAnalyses.map((analysis) => analysis.id);
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

      void (async () => {
        for (const id of ids) {
          try {
            await processAnalysis(id);
            const snapshotResult = await refreshDiscrepancySnapshotsForAnalysis(id);
            if (snapshotResult.refreshed > 0 || snapshotResult.skipped > 0) {
              console.log(
                `Discrepancy refresh for ${id}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}`,
              );
            }
          } catch (err) {
            console.error(`Recalculate failed for ${id}:`, err);
          }
        }
      })();

      res.json({
        message: "Recalculation started",
        scope: isAdmin ? "all" : "user",
        totalAnalyses: userAnalyses.length,
        queuedAnalyses: ids.length,
        autoRelinkedAnalyses,
        skippedAnalyses: userAnalyses.length - ids.length,
        skippedDetails,
        willRefreshDiscrepancies: true,
        queuedDiscrepancySnapshots: annotationRows.length,
        analysesWithAnnotationsQueued,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/relink-and-recalculate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const analysisId = req.params.id;
      const filename = (req.body?.filename || "").toString().trim();
      const storageMode = await getVideoStorageMode();

      if (storageMode === "r2") {
        return res.status(400).json({ error: "Relink is only available when VIDEO_STORAGE_MODE is filesystem" });
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
      const evaluationModeEnabled = await getModelEvaluationMode(userId);
      if (evaluationModeEnabled && isAdmin) {
        const videoMap = getEvaluationDatasetVideoMap(readModelRegistryConfig());
        if (!getEvaluationMatch(analysis, videoMap)) {
          return res.status(400).json({
            error: "Model Evaluation Mode is ON. Only evaluation dataset videos can be recalculated.",
          });
        }
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only relink your own analyses" });
      }

      const safeFilename = path.basename(filename);
      const relinkedPath = path.join(uploadDir, safeFilename);

      if (!fs.existsSync(relinkedPath)) {
        return res.status(404).json({ error: "File not found in uploads folder" });
      }

      await db
        .update(analyses)
        .set({
          videoFilename: safeFilename,
          videoPath: relinkedPath,
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
          await processAnalysis(analysisId);
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

  app.get("/api/analyses/:id/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const [feedback] = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, req.params.id),
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
      const { rating, comment } = req.body;
      if (!rating || !["up", "down"].includes(rating)) {
        return res.status(400).json({ error: "Rating must be 'up' or 'down'" });
      }

      const existing = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, req.params.id),
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
          analysisId: req.params.id,
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
            eq(analysisFeedback.analysisId, req.params.id),
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
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (analysis.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only delete your own analyses" });
      }

      await deleteStoredMedia(analysis.videoPath);

      await storage.deleteAnalysis(req.params.id);
      res.json({ message: "Analysis deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/analyses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Only admins can clear history" });
      }

      const allAnalyses = await storage.getAllAnalyses(null);

      for (const analysis of allAnalyses) {
        await deleteStoredMedia(analysis.videoPath);
      }

      await db.transaction(async (tx) => {
        await tx.delete(coachingInsights);
        await tx.delete(analysisFeedback);
        await tx.delete(analysisShotAnnotations);
        await tx.delete(metrics);
        await tx.delete(analyses);
        await tx.execute(sql`delete from "session"`);
      });

      res.json({ message: "History cleared", deletedCount: allAnalyses.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
