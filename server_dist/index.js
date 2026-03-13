var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { execFile as execFile2 } from "child_process";
import { randomUUID as randomUUID2 } from "crypto";
import multer2 from "multer";
import path5 from "path";
import fs5 from "fs";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  analyses: () => analyses,
  analysisFeedback: () => analysisFeedback,
  analysisShotAnnotations: () => analysisShotAnnotations,
  analysisShotDiscrepancies: () => analysisShotDiscrepancies,
  appSettings: () => appSettings,
  coachingInsights: () => coachingInsights,
  insertAnalysisSchema: () => insertAnalysisSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  metrics: () => metrics,
  registerSchema: () => registerSchema,
  scoringModelRegistryDatasetMetrics: () => scoringModelRegistryDatasetMetrics,
  scoringModelRegistryEntries: () => scoringModelRegistryEntries,
  sportCategoryMetricRanges: () => sportCategoryMetricRanges,
  sportMovements: () => sportMovements,
  sports: () => sports,
  users: () => users
});
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  real,
  timestamp,
  boolean,
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  address: text("address"),
  country: text("country"),
  dominantProfile: text("dominant_profile"),
  selectedScoreSections: jsonb("selected_score_sections").$type().default(sql`'[]'::jsonb`),
  selectedMetricKeys: jsonb("selected_metric_keys").$type().default(sql`'[]'::jsonb`),
  selectedScoreSectionsBySport: jsonb("selected_score_sections_by_sport").$type().default(sql`'{}'::jsonb`),
  selectedMetricKeysBySport: jsonb("selected_metric_keys_by_sport").$type().default(sql`'{}'::jsonb`),
  sportsInterests: text("sports_interests"),
  bio: text("bio"),
  role: text("role").default("player").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var sports = pgTable("sports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: real("sort_order").default(0).notNull()
});
var sportMovements = pgTable("sport_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sportId: varchar("sport_id").notNull().references(() => sports.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  sortOrder: real("sort_order").default(0).notNull()
});
var analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sportId: varchar("sport_id").references(() => sports.id),
  movementId: varchar("movement_id").references(() => sportMovements.id),
  videoFilename: text("video_filename").notNull(),
  sourceFilename: text("source_filename"),
  evaluationVideoId: text("evaluation_video_id"),
  videoPath: text("video_path").notNull(),
  videoContentHash: text("video_content_hash"),
  status: text("status").notNull().default("pending"),
  detectedMovement: text("detected_movement"),
  rejectionReason: text("rejection_reason"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  sourceApp: text("source_app"),
  videoDurationSec: real("video_duration_sec"),
  videoFps: real("video_fps"),
  videoWidth: real("video_width"),
  videoHeight: real("video_height"),
  videoRotation: real("video_rotation"),
  videoCodec: text("video_codec"),
  videoBitrateKbps: real("video_bitrate_kbps"),
  fileSizeBytes: real("file_size_bytes"),
  containerFormat: text("container_format"),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  gpsAltM: real("gps_alt_m"),
  gpsSpeedMps: real("gps_speed_mps"),
  gpsHeadingDeg: real("gps_heading_deg"),
  gpsAccuracyM: real("gps_accuracy_m"),
  gpsTimestamp: timestamp("gps_timestamp", { withTimezone: true }),
  gpsSource: text("gps_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  configKey: varchar("config_key").notNull().default("tennis-forehand"),
  modelVersion: varchar("model_version").notNull().default("0.1"),
  overallScore: real("overall_score"),
  metricValues: jsonb("metric_values").$type(),
  scoreInputs: jsonb("score_inputs").$type(),
  scoreOutputs: jsonb("score_outputs").$type(),
  aiDiagnostics: jsonb("ai_diagnostics").$type(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var coachingInsights = pgTable("coaching_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  keyStrength: text("key_strength").notNull(),
  improvementArea: text("improvement_area").notNull(),
  trainingSuggestion: text("training_suggestion").notNull(),
  simpleExplanation: text("simple_explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var analysisFeedback = pgTable("analysis_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: text("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var analysisShotAnnotations = pgTable("analysis_shot_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalShots: real("total_shots").notNull(),
  orderedShotLabels: jsonb("ordered_shot_labels").$type().notNull(),
  usedForScoringShotIndexes: jsonb("used_for_scoring_shot_indexes").$type().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var analysisShotDiscrepancies = pgTable("analysis_shot_discrepancies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  videoName: text("video_name").notNull(),
  sportName: text("sport_name").notNull(),
  movementName: text("movement_name").notNull(),
  modelVersion: varchar("model_version").notNull().default("0.1"),
  autoShots: real("auto_shots").notNull(),
  manualShots: real("manual_shots").notNull(),
  mismatches: real("mismatches").notNull(),
  mismatchRatePct: real("mismatch_rate_pct").notNull(),
  labelMismatches: real("label_mismatches").notNull(),
  countMismatch: real("count_mismatch").notNull(),
  confusionPairs: jsonb("confusion_pairs").$type().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var scoringModelRegistryEntries = pgTable("scoring_model_registry_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelVersion: varchar("model_version").notNull(),
  modelVersionDescription: text("model_version_description").notNull(),
  movementType: text("movement_type").notNull(),
  movementDetectionAccuracyPct: real("movement_detection_accuracy_pct").notNull(),
  scoringAccuracyPct: real("scoring_accuracy_pct").notNull(),
  datasetsUsed: jsonb("datasets_used").$type().notNull(),
  manifestModelVersion: varchar("manifest_model_version").notNull().default("0.1"),
  manifestDatasets: jsonb("manifest_datasets").$type().notNull().default(sql`'[]'::jsonb`),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var scoringModelRegistryDatasetMetrics = pgTable("scoring_model_registry_dataset_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registryEntryId: varchar("registry_entry_id").notNull().references(() => scoringModelRegistryEntries.id),
  datasetName: text("dataset_name").notNull(),
  movementType: text("movement_type").notNull(),
  movementDetectionAccuracyPct: real("movement_detection_accuracy_pct").notNull(),
  scoringAccuracyPct: real("scoring_accuracy_pct").notNull()
});
var sportCategoryMetricRanges = pgTable("sport_category_metric_ranges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sportName: text("sport_name").notNull(),
  movementName: text("movement_name").notNull(),
  configKey: varchar("config_key").notNull(),
  metricKey: text("metric_key").notNull(),
  metricLabel: text("metric_label").notNull(),
  unit: text("unit").notNull(),
  optimalMin: real("optimal_min").notNull(),
  optimalMax: real("optimal_max").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  source: text("source").notNull().default("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  passwordHash: true
});
var insertAnalysisSchema = createInsertSchema(analyses).pick({
  videoFilename: true,
  videoPath: true,
  status: true,
  userId: true,
  sportId: true,
  movementId: true
});
var registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
var loginSchema = z.object({
  identifier: z.string().min(1, "User ID or email is required"),
  password: z.string().min(1, "Password is required")
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}
var TIMESTAMP_WITHOUT_TIMEZONE_OID = 1114;
pg.types.setTypeParser(
  TIMESTAMP_WITHOUT_TIMEZONE_OID,
  (value) => /* @__PURE__ */ new Date(`${value.replace(" ", "T")}Z`)
);
var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'UTC'").catch(() => {
  });
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, sql as sql2 } from "drizzle-orm";

// server/score-scale.ts
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function round2(value) {
  return Number(value.toFixed(2));
}
function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
function normalizeRuntimeScoreToHundred(value) {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  if (numeric <= 10) return clamp(numeric * 10, 0, 100);
  return clamp(numeric, 0, 100);
}
function toPersistedScoreTen(value) {
  const normalizedHundred = normalizeRuntimeScoreToHundred(value);
  if (normalizedHundred === null) return null;
  return round2(clamp(normalizedHundred / 10, 0, 10));
}
function persistedScoreToApiHundred(value) {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  if (numeric <= 10) return round2(clamp(numeric * 10, 0, 100));
  return round2(clamp(numeric, 0, 100));
}

// server/tactical-scores.ts
var STANDARD_KEYS = ["power", "control", "timing", "technique"];
function canonicalKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function toNumberOrNull2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function valueToTenScale(value) {
  const n = toNumberOrNull2(value);
  if (n == null) return null;
  if (n <= 10) return Number(Math.max(0, Math.min(10, n)).toFixed(2));
  return Number(Math.max(0, Math.min(10, n / 10)).toFixed(2));
}
function tenToApi100(value) {
  const ten = valueToTenScale(value);
  if (ten == null) return null;
  return Number((ten * 10).toFixed(2));
}
function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}
function readScoreOutputSection(node) {
  const section = asRecord(node);
  const components = asRecord(section.components);
  return Object.keys(components).length ? components : section;
}
function extractFromScoreOutputs(scoreOutputs) {
  const outputs = asRecord(scoreOutputs);
  const tacticalSection = readScoreOutputSection(outputs.tactical);
  const tacticalComponents = tacticalSection;
  const out = {
    power: null,
    control: null,
    timing: null,
    technique: null
  };
  for (const key of STANDARD_KEYS) {
    const value = valueToTenScale(tacticalComponents[key]);
    out[key] = value;
  }
  return out;
}
function extractStandardizedTacticalScores10(values) {
  const byCanonical = /* @__PURE__ */ new Map();
  for (const [k, v] of Object.entries(values || {})) {
    const n = toNumberOrNull2(v);
    if (n == null) continue;
    byCanonical.set(canonicalKey(k), n);
  }
  const out = {
    power: null,
    control: null,
    timing: null,
    technique: null
  };
  for (const key of STANDARD_KEYS) {
    const hit = byCanonical.get(canonicalKey(key));
    if (hit == null) continue;
    out[key] = valueToTenScale(hit);
  }
  return out;
}
function normalizeTacticalScoresToApi100(values) {
  const source = extractFromScoreOutputs(values);
  const out = {
    power: null,
    control: null,
    timing: null,
    technique: null
  };
  for (const key of STANDARD_KEYS) {
    const value = tenToApi100(source[key]);
    out[key] = value;
  }
  return out;
}
function readTacticalScoreValue(values, key) {
  const source = extractFromScoreOutputs(values);
  const target = canonicalKey(key);
  for (const [k, v] of Object.entries(source || {})) {
    if (canonicalKey(k) !== target) continue;
    return toNumberOrNull2(Number(v) * 10);
  }
  return null;
}

// server/storage.ts
var DatabaseStorage = class {
  async createAnalysis(videoFilename, videoPath, userId, sportId, movementId, metadata, sourceFilename, evaluationVideoId) {
    const [analysis] = await db.insert(analyses).values({
      videoFilename,
      sourceFilename: sourceFilename || null,
      evaluationVideoId: evaluationVideoId || null,
      videoPath,
      status: "pending",
      userId: userId || null,
      sportId: sportId || null,
      movementId: movementId || null,
      capturedAt: metadata?.capturedAt ?? null,
      sourceApp: metadata?.sourceApp ?? null,
      videoDurationSec: metadata?.videoDurationSec ?? null,
      videoFps: metadata?.videoFps ?? null,
      videoWidth: metadata?.videoWidth ?? null,
      videoHeight: metadata?.videoHeight ?? null,
      videoRotation: metadata?.videoRotation ?? null,
      videoCodec: metadata?.videoCodec ?? null,
      videoBitrateKbps: metadata?.videoBitrateKbps ?? null,
      fileSizeBytes: metadata?.fileSizeBytes ?? null,
      containerFormat: metadata?.containerFormat ?? null,
      gpsLat: metadata?.gpsLat ?? null,
      gpsLng: metadata?.gpsLng ?? null,
      gpsAltM: metadata?.gpsAltM ?? null,
      gpsSpeedMps: metadata?.gpsSpeedMps ?? null,
      gpsHeadingDeg: metadata?.gpsHeadingDeg ?? null,
      gpsAccuracyM: metadata?.gpsAccuracyM ?? null,
      gpsTimestamp: metadata?.gpsTimestamp ?? null,
      gpsSource: metadata?.gpsSource ?? null
    }).returning();
    return analysis;
  }
  async getAnalysis(id) {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
    return analysis;
  }
  async getAllAnalyses(userId, sportId) {
    const conditions = [];
    if (userId) {
      conditions.push(eq(analyses.userId, userId));
    }
    if (sportId) {
      conditions.push(eq(analyses.sportId, sportId));
    }
    const rows = await db.select({
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
      gpsLat: analyses.gpsLat,
      gpsLng: analyses.gpsLng,
      createdAt: analyses.createdAt,
      updatedAt: analyses.updatedAt,
      userName: users.name
    }).from(analyses).leftJoin(users, eq(analyses.userId, users.id)).where(conditions.length > 0 ? and(...conditions) : void 0).orderBy(sql2`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);
    return rows;
  }
  async getMetrics(analysisId) {
    const [metric] = await db.select().from(metrics).where(eq(metrics.analysisId, analysisId));
    if (!metric) return void 0;
    return {
      ...metric,
      overallScore: persistedScoreToApiHundred(metric.overallScore),
      subScores: normalizeTacticalScoresToApi100(metric.scoreOutputs)
    };
  }
  async getCoachingInsights(analysisId) {
    const [insight] = await db.select().from(coachingInsights).where(eq(coachingInsights.analysisId, analysisId));
    return insight;
  }
  async getHistoricalMetricAverages(userId, beforeDate, periodDays, sportId, configKey) {
    const conditions = [
      sql2`a.user_id = ${userId}`,
      sql2`a.status = 'completed'`,
      sql2`coalesce(a.captured_at, a.created_at) < ${beforeDate}`
    ];
    if (periodDays !== null) {
      const startDate = new Date(beforeDate.getTime() - periodDays * 24 * 60 * 60 * 1e3);
      conditions.push(sql2`coalesce(a.captured_at, a.created_at) >= ${startDate}`);
    }
    if (sportId) {
      conditions.push(sql2`a.sport_id = ${sportId}`);
    }
    if (configKey) {
      conditions.push(sql2`m.config_key = ${configKey}`);
    }
    const whereClause = sql2.join(conditions, sql2` AND `);
    const countResult = await db.execute(
      sql2`SELECT COUNT(DISTINCT a.id) as cnt
          FROM analyses a
          JOIN metrics m ON m.analysis_id = a.id
          WHERE ${whereClause}`
    );
    const countRow = countResult.rows?.[0] || countResult[0];
    const count = Number(countRow?.cnt || 0);
    if (count === 0) {
      return { averages: null, count: 0 };
    }
    const metricAvgResult = await db.execute(
      sql2`SELECT kv.key, AVG(kv.value::numeric) as avg_val
          FROM analyses a
          JOIN metrics m ON m.analysis_id = a.id,
          LATERAL jsonb_each_text(m.metric_values) AS kv(key, value)
          WHERE ${whereClause}
          GROUP BY kv.key`
    );
    const subScoreAvgResult = await db.execute(
      sql2`SELECT kv.key,
                 AVG(
                   CASE
                     WHEN kv.value::numeric <= 10 THEN kv.value::numeric * 10
                     ELSE kv.value::numeric
                   END
                 ) as avg_val
          FROM analyses a
          JOIN metrics m ON m.analysis_id = a.id,
          LATERAL jsonb_each_text(COALESCE(m.score_outputs -> 'tactical' -> 'components', m.score_outputs -> 'tacticalComponents', '{}'::jsonb)) AS kv(key, value)
          WHERE ${whereClause}
          GROUP BY kv.key`
    );
    const metricAvgs = {};
    const subScoreAvgs = {};
    const metricRows = metricAvgResult.rows || metricAvgResult;
    if (Array.isArray(metricRows)) {
      for (const row of metricRows) {
        if (row.key && row.avg_val != null) {
          metricAvgs[row.key] = parseFloat(Number(row.avg_val).toFixed(2));
        }
      }
    }
    const subScoreRows = subScoreAvgResult.rows || subScoreAvgResult;
    if (Array.isArray(subScoreRows)) {
      for (const row of subScoreRows) {
        if (row.key && row.avg_val != null) {
          subScoreAvgs[row.key] = parseFloat(Number(row.avg_val).toFixed(2));
        }
      }
    }
    return {
      averages: { metricValues: metricAvgs, subScores: subScoreAvgs },
      count
    };
  }
  async deleteAnalysis(id) {
    await db.delete(coachingInsights).where(eq(coachingInsights.analysisId, id));
    await db.delete(analysisShotAnnotations).where(eq(analysisShotAnnotations.analysisId, id));
    await db.delete(metrics).where(eq(metrics.analysisId, id));
    await db.delete(analyses).where(eq(analyses.id, id));
  }
};
var storage = new DatabaseStorage();

// server/analysis-engine.ts
import { and as and2, desc as desc2, eq as eq2, isNotNull, ne, or } from "drizzle-orm";
import { execFile } from "child_process";
import { createHash as createHash2 } from "crypto";

// shared/sport-configs/tennis-forehand.ts
var tennisForehandConfig = {
  sportName: "Tennis",
  movementName: "Forehand",
  configKey: "tennis-forehand",
  overallScoreLabel: "Forehand Score",
  scores: [
    { key: "power", label: "Power", weight: 0.25 },
    { key: "control", label: "Control", weight: 0.2 },
    { key: "timing", label: "Timing", weight: 0.25 },
    { key: "technique", label: "Technique", weight: 0.15 },
    { key: "consistency", label: "Consistency", weight: 0.15 }
  ],
  metrics: [
    {
      key: "wristSpeed",
      label: "Wrist Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Peak wrist velocity during the swing, measuring racket head acceleration",
      optimalRange: [25, 40]
    },
    {
      key: "elbowAngle",
      label: "Elbow Angle",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Average elbow joint angle during the stroke, indicating arm extension",
      optimalRange: [120, 160]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Angular velocity of torso rotation, measuring trunk rotation power",
      optimalRange: [500, 900]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip-to-ankle alignment stability throughout the stroke",
      optimalRange: [70, 98]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball speed after contact based on trajectory analysis",
      optimalRange: [55, 100]
    },
    {
      key: "trajectoryArc",
      label: "Trajectory Arc",
      unit: "deg",
      icon: "trending-up",
      category: "ball",
      color: "#6C5CE7",
      description: "Curvature of the ball's flight path indicating topspin/flat shot",
      optimalRange: [8, 25]
    },
    {
      key: "spinRate",
      label: "Spin Rate",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball spin based on trajectory deviations",
      optimalRange: [800, 2800]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Variance in elbow angles and wrist speeds across the video",
      optimalRange: [70, 98]
    },
    {
      key: "backswingDuration",
      label: "Backswing",
      unit: "s",
      icon: "arrow-back-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Time spent in the preparation phase before the forward swing",
      optimalRange: [0.3, 0.7]
    },
    {
      key: "contactTiming",
      label: "Contact Timing",
      unit: "s",
      icon: "locate",
      category: "timing",
      color: "#6C5CE7",
      description: "Duration of the contact window, shorter = cleaner strike",
      optimalRange: [0.02, 0.08]
    },
    {
      key: "followThroughDuration",
      label: "Follow-through",
      unit: "s",
      icon: "arrow-forward-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Time spent in the follow-through phase after contact",
      optimalRange: [0.4, 1]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness of the speed profile throughout the swing",
      optimalRange: [65, 95]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of contact point relative to ground",
      optimalRange: [0.85, 1.1]
    }
  ]
};

// shared/sport-configs/tennis-backhand.ts
var tennisBackhandConfig = {
  sportName: "Tennis",
  movementName: "Backhand",
  configKey: "tennis-backhand",
  overallScoreLabel: "Backhand Score",
  scores: [
    { key: "power", label: "Power", weight: 0.2 },
    { key: "control", label: "Control", weight: 0.25 },
    { key: "timing", label: "Timing", weight: 0.25 },
    { key: "technique", label: "Technique", weight: 0.15 },
    { key: "consistency", label: "Consistency", weight: 0.15 }
  ],
  metrics: [
    {
      key: "wristSpeed",
      label: "Wrist Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Peak wrist velocity during the backhand swing",
      optimalRange: [20, 35]
    },
    {
      key: "elbowAngle",
      label: "Elbow Angle",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Average elbow angle \u2014 tighter for one-handed, wider for two-handed",
      optimalRange: [110, 155]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Trunk rotation velocity on the backhand side",
      optimalRange: [400, 800]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight transfer stability during the backhand stroke",
      optimalRange: [70, 98]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball speed off the backhand",
      optimalRange: [45, 90]
    },
    {
      key: "trajectoryArc",
      label: "Trajectory Arc",
      unit: "deg",
      icon: "trending-up",
      category: "ball",
      color: "#6C5CE7",
      description: "Ball flight arc angle",
      optimalRange: [8, 22]
    },
    {
      key: "spinRate",
      label: "Spin Rate",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Estimated spin RPM on the backhand",
      optimalRange: [700, 2500]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Stroke repeatability across frames",
      optimalRange: [70, 98]
    },
    {
      key: "backswingDuration",
      label: "Backswing",
      unit: "s",
      icon: "arrow-back-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Preparation phase duration",
      optimalRange: [0.3, 0.8]
    },
    {
      key: "contactTiming",
      label: "Contact Timing",
      unit: "s",
      icon: "locate",
      category: "timing",
      color: "#6C5CE7",
      description: "Contact window duration",
      optimalRange: [0.02, 0.08]
    },
    {
      key: "followThroughDuration",
      label: "Follow-through",
      unit: "s",
      icon: "arrow-forward-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Follow-through phase after ball contact",
      optimalRange: [0.4, 1]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Swing rhythm smoothness",
      optimalRange: [65, 95]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of contact point above ground",
      optimalRange: [0.8, 1.05]
    }
  ]
};

// shared/sport-configs/tennis-serve.ts
var tennisServeConfig = {
  sportName: "Tennis",
  movementName: "Serve",
  configKey: "tennis-serve",
  overallScoreLabel: "Serve Score",
  scores: [
    { key: "power", label: "Power", weight: 0.3 },
    { key: "control", label: "Control", weight: 0.25 },
    { key: "timing", label: "Timing", weight: 0.2 },
    { key: "technique", label: "Technique", weight: 0.15 },
    { key: "consistency", label: "Consistency", weight: 0.1 }
  ],
  metrics: [
    {
      key: "wristSpeed",
      label: "Wrist Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Peak wrist snap velocity at ball contact",
      optimalRange: [30, 50]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Trunk rotation velocity during the service motion",
      optimalRange: [600, 1100]
    },
    {
      key: "tossHeight",
      label: "Toss Height",
      unit: "m",
      icon: "arrow-up-circle",
      category: "technique",
      color: "#FBBF24",
      description: "Ball toss height relative to contact point",
      optimalRange: [0.3, 0.8]
    },
    {
      key: "trophyAngle",
      label: "Trophy Position",
      unit: "deg",
      icon: "body",
      category: "technique",
      color: "#FBBF24",
      description: "Elbow angle at the trophy (loaded) position",
      optimalRange: [80, 110]
    },
    {
      key: "pronation",
      label: "Pronation",
      unit: "deg/s",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "Forearm pronation speed at contact",
      optimalRange: [400, 900]
    },
    {
      key: "ballSpeed",
      label: "Serve Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Ball speed after the serve",
      optimalRange: [70, 130]
    },
    {
      key: "trajectoryArc",
      label: "Trajectory Arc",
      unit: "deg",
      icon: "trending-up",
      category: "ball",
      color: "#6C5CE7",
      description: "Ball trajectory angle over the net",
      optimalRange: [3, 15]
    },
    {
      key: "spinRate",
      label: "Spin Rate",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Spin applied to the serve",
      optimalRange: [1e3, 3500]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body balance throughout the service motion",
      optimalRange: [65, 95]
    },
    {
      key: "backswingDuration",
      label: "Wind-up",
      unit: "s",
      icon: "arrow-back-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Duration of the wind-up and loading phase",
      optimalRange: [0.8, 1.5]
    },
    {
      key: "contactTiming",
      label: "Contact Timing",
      unit: "s",
      icon: "locate",
      category: "timing",
      color: "#6C5CE7",
      description: "Timing precision at the contact point",
      optimalRange: [0.02, 0.06]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of ball at contact, higher = better angle",
      optimalRange: [2.2, 2.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and consistency of the service motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/tennis-volley.ts
var tennisVolleyConfig = {
  sportName: "Tennis",
  movementName: "Volley",
  configKey: "tennis-volley",
  overallScoreLabel: "Volley Score",
  scores: [
    { key: "power", label: "Power", weight: 0.1 },
    { key: "control", label: "Control", weight: 0.61 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.15 },
    { key: "consistency", label: "Consistency", weight: 0.06 }
  ],
  metrics: [
    {
      key: "reactionSpeed",
      label: "Reaction Speed",
      unit: "ms",
      icon: "flash",
      category: "timing",
      color: "#6C5CE7",
      description: "Time from ball approach to racket movement initiation",
      optimalRange: [150, 350]
    },
    {
      key: "racketPrep",
      label: "Racket Prep",
      unit: "/100",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "How early and compact the racket preparation is",
      optimalRange: [70, 98]
    },
    {
      key: "wristFirmness",
      label: "Wrist Firmness",
      unit: "/100",
      icon: "lock-closed",
      category: "technique",
      color: "#FBBF24",
      description: "Wrist stability at contact \u2014 firm wrist is key for volleys",
      optimalRange: [75, 98]
    },
    {
      key: "splitStepTiming",
      label: "Split Step",
      unit: "s",
      icon: "footsteps",
      category: "timing",
      color: "#60A5FA",
      description: "Timing of the split step relative to opponent's contact",
      optimalRange: [0.1, 0.4]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the volley",
      optimalRange: [70, 98]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of racket at ball contact",
      optimalRange: [0.8, 1.5]
    },
    {
      key: "stepForward",
      label: "Step Forward",
      unit: "/100",
      icon: "walk",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Quality of forward step into the volley",
      optimalRange: [60, 95]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "speedometer",
      category: "ball",
      color: "#34D399",
      description: "Ball speed after the volley",
      optimalRange: [30, 70]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of volley technique",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and rhythm of the volley motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/tennis-game.ts
var tennisGameConfig = {
  sportName: "Tennis",
  movementName: "Game",
  configKey: "tennis-game",
  overallScoreLabel: "Game Score",
  scores: [
    { key: "power", label: "Power", weight: 0.21 },
    { key: "control", label: "Control", weight: 0.42 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.08 },
    { key: "consistency", label: "Consistency", weight: 0.21 }
  ],
  metrics: [
    {
      key: "courtCoverage",
      label: "Court Coverage",
      unit: "/100",
      icon: "move",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Percentage of court area covered during rallies",
      optimalRange: [60, 95]
    },
    {
      key: "recoverySpeed",
      label: "Recovery Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Speed of recovery to ready position after each shot",
      optimalRange: [2, 5]
    },
    {
      key: "avgBallSpeed",
      label: "Avg Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Average ball speed across all shots",
      optimalRange: [50, 90]
    },
    {
      key: "shotVariety",
      label: "Shot Variety",
      unit: "/100",
      icon: "options",
      category: "technique",
      color: "#FBBF24",
      description: "Diversity of shots used during play",
      optimalRange: [50, 90]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Overall body balance during match play",
      optimalRange: [65, 95]
    },
    {
      key: "rallyLength",
      label: "Rally Length",
      unit: "shots",
      icon: "repeat",
      category: "consistency",
      color: "#6C5CE7",
      description: "Average number of shots per rally",
      optimalRange: [4, 12]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Overall consistency of shot technique",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Movement rhythm and pacing between shots",
      optimalRange: [60, 90]
    }
  ]
};

// shared/sport-configs/golf-drive.ts
var golfDriveConfig = {
  sportName: "Golf",
  movementName: "Drive",
  configKey: "golf-drive",
  overallScoreLabel: "Drive Score",
  scores: [
    { key: "power", label: "Power", weight: 0.3 },
    { key: "control", label: "Control", weight: 0.1 },
    { key: "timing", label: "Timing", weight: 0.15 },
    { key: "technique", label: "Technique", weight: 0.25 },
    { key: "consistency", label: "Consistency", weight: 0.2 }
  ],
  metrics: [
    {
      key: "clubHeadSpeed",
      label: "Club Head Speed",
      unit: "mph",
      icon: "speedometer",
      category: "power",
      color: "#6C5CE7",
      description: "Estimated speed of the club head at impact",
      optimalRange: [85, 115]
    },
    {
      key: "hipRotation",
      label: "Hip Rotation",
      unit: "deg",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip rotation angle from address to impact",
      optimalRange: [35, 55]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Turn",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Torso rotation angle at top of backswing",
      optimalRange: [75, 100]
    },
    {
      key: "xFactor",
      label: "X-Factor",
      unit: "deg",
      icon: "analytics",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Difference between shoulder and hip rotation at top of backswing",
      optimalRange: [30, 50]
    },
    {
      key: "spineAngle",
      label: "Spine Angle",
      unit: "deg",
      icon: "trending-down",
      category: "technique",
      color: "#FBBF24",
      description: "Forward tilt angle of the spine at address and impact",
      optimalRange: [25, 40]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight distribution and stability throughout the swing",
      optimalRange: [70, 98]
    },
    {
      key: "tempoRatio",
      label: "Tempo Ratio",
      unit: ":1",
      icon: "timer",
      category: "timing",
      color: "#6C5CE7",
      description: "Backswing-to-downswing time ratio (ideal ~3:1)",
      optimalRange: [2.5, 3.5]
    },
    {
      key: "backswingDuration",
      label: "Backswing",
      unit: "s",
      icon: "arrow-back-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Duration of the backswing phase",
      optimalRange: [0.7, 1.2]
    },
    {
      key: "downswingDuration",
      label: "Downswing",
      unit: "s",
      icon: "arrow-forward-circle",
      category: "timing",
      color: "#6C5CE7",
      description: "Duration of the downswing to impact",
      optimalRange: [0.2, 0.4]
    },
    {
      key: "followThroughDuration",
      label: "Follow-through",
      unit: "s",
      icon: "arrow-up-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Duration of post-impact follow-through",
      optimalRange: [0.5, 1]
    },
    {
      key: "headStability",
      label: "Head Stability",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Head position steadiness throughout the swing",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Overall smoothness and flow of the swing",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/golf-iron.ts
var golfIronConfig = {
  sportName: "Golf",
  movementName: "Iron Shot",
  configKey: "golf-iron",
  overallScoreLabel: "Iron Shot Score",
  scores: [
    { key: "power", label: "Power", weight: 0.14 },
    { key: "control", label: "Control", weight: 0.32 },
    { key: "timing", label: "Timing", weight: 0.09 },
    { key: "technique", label: "Technique", weight: 0.27 },
    { key: "consistency", label: "Consistency", weight: 0.18 }
  ],
  metrics: [
    {
      key: "clubHeadSpeed",
      label: "Club Head Speed",
      unit: "mph",
      icon: "speedometer",
      category: "power",
      color: "#6C5CE7",
      description: "Club head speed at impact \u2014 varies by iron",
      optimalRange: [70, 95]
    },
    {
      key: "hipRotation",
      label: "Hip Rotation",
      unit: "deg",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip rotation for controlled iron strikes",
      optimalRange: [30, 50]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Turn",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Torso rotation at top of backswing",
      optimalRange: [70, 95]
    },
    {
      key: "spineAngle",
      label: "Spine Angle",
      unit: "deg",
      icon: "trending-down",
      category: "technique",
      color: "#FBBF24",
      description: "Spine tilt consistency through the swing",
      optimalRange: [28, 42]
    },
    {
      key: "divotAngle",
      label: "Divot Angle",
      unit: "deg",
      icon: "push",
      category: "technique",
      color: "#FBBF24",
      description: "Angle of attack \u2014 descending blow for irons",
      optimalRange: [-5, -1]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight transfer and stability",
      optimalRange: [70, 98]
    },
    {
      key: "tempoRatio",
      label: "Tempo Ratio",
      unit: ":1",
      icon: "timer",
      category: "timing",
      color: "#6C5CE7",
      description: "Backswing-to-downswing time ratio",
      optimalRange: [2.5, 3.5]
    },
    {
      key: "backswingDuration",
      label: "Backswing",
      unit: "s",
      icon: "arrow-back-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Backswing duration",
      optimalRange: [0.6, 1.1]
    },
    {
      key: "headStability",
      label: "Head Stability",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Head steadiness during the iron swing",
      optimalRange: [75, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Swing rhythm consistency",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/golf-chip.ts
var golfChipConfig = {
  sportName: "Golf",
  movementName: "Chip",
  configKey: "golf-chip",
  overallScoreLabel: "Chip Score",
  scores: [
    { key: "power", label: "Power", weight: 0.1 },
    { key: "control", label: "Control", weight: 0.33 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.29 },
    { key: "consistency", label: "Consistency", weight: 0.2 }
  ],
  metrics: [
    {
      key: "wristHinge",
      label: "Wrist Hinge",
      unit: "deg",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "Amount of wrist hinge \u2014 minimal for chip shots",
      optimalRange: [5, 20]
    },
    {
      key: "armPendulum",
      label: "Arm Pendulum",
      unit: "/100",
      icon: "swap-vertical",
      category: "technique",
      color: "#FBBF24",
      description: "Arms and club moving as one unit, pendulum-like",
      optimalRange: [75, 98]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight distribution \u2014 should favor front foot",
      optimalRange: [70, 98]
    },
    {
      key: "headStability",
      label: "Head Stability",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Head must stay very still during chip shots",
      optimalRange: [80, 98]
    },
    {
      key: "strokeLength",
      label: "Stroke Length",
      unit: "/100",
      icon: "resize",
      category: "technique",
      color: "#6C5CE7",
      description: "Appropriate stroke length for distance control",
      optimalRange: [60, 90]
    },
    {
      key: "contactQuality",
      label: "Contact Quality",
      unit: "/100",
      icon: "radio-button-on",
      category: "technique",
      color: "#6C5CE7",
      description: "Clean ball-first contact quality",
      optimalRange: [70, 98]
    },
    {
      key: "followThroughRatio",
      label: "Follow-through",
      unit: "/100",
      icon: "arrow-forward-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Follow-through length relative to backswing",
      optimalRange: [70, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Smoothness of the chipping motion",
      optimalRange: [70, 95]
    }
  ]
};

// shared/sport-configs/golf-putt.ts
var golfPuttConfig = {
  sportName: "Golf",
  movementName: "Putt",
  configKey: "golf-putt",
  overallScoreLabel: "Putting Score",
  scores: [
    { key: "power", label: "Power", weight: 0.1 },
    { key: "control", label: "Control", weight: 0.33 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.25 },
    { key: "consistency", label: "Consistency", weight: 0.24 }
  ],
  metrics: [
    {
      key: "pendulumScore",
      label: "Pendulum",
      unit: "/100",
      icon: "swap-vertical",
      category: "technique",
      color: "#FBBF24",
      description: "Shoulder-driven pendulum motion quality",
      optimalRange: [75, 98]
    },
    {
      key: "headStability",
      label: "Head Stability",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Head must remain perfectly still during putting",
      optimalRange: [85, 98]
    },
    {
      key: "eyeLine",
      label: "Eye Line",
      unit: "/100",
      icon: "eye",
      category: "technique",
      color: "#6C5CE7",
      description: "Eyes positioned directly over the ball",
      optimalRange: [75, 98]
    },
    {
      key: "strokeLength",
      label: "Stroke Length",
      unit: "/100",
      icon: "resize",
      category: "technique",
      color: "#6C5CE7",
      description: "Backswing and follow-through length symmetry",
      optimalRange: [70, 95]
    },
    {
      key: "wristStability",
      label: "Wrist Stability",
      unit: "/100",
      icon: "lock-closed",
      category: "technique",
      color: "#FBBF24",
      description: "Wrist should not break during the putting stroke",
      optimalRange: [80, 98]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability \u2014 no swaying or weight shift",
      optimalRange: [80, 98]
    },
    {
      key: "tempoRatio",
      label: "Tempo",
      unit: ":1",
      icon: "timer",
      category: "timing",
      color: "#6C5CE7",
      description: "Backswing-to-forward ratio (ideal ~1:1 for putting)",
      optimalRange: [0.8, 1.2]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Smoothness and consistency of stroke tempo",
      optimalRange: [75, 98]
    }
  ]
};

// shared/sport-configs/golf-full-swing.ts
var golfFullSwingConfig = {
  sportName: "Golf",
  movementName: "Full Swing",
  configKey: "golf-full-swing",
  overallScoreLabel: "Full Swing Score",
  scores: [
    { key: "power", label: "Power", weight: 0.25 },
    { key: "control", label: "Control", weight: 0.15 },
    { key: "timing", label: "Timing", weight: 0.15 },
    { key: "technique", label: "Technique", weight: 0.25 },
    { key: "consistency", label: "Consistency", weight: 0.2 }
  ],
  metrics: [
    {
      key: "clubHeadSpeed",
      label: "Club Head Speed",
      unit: "mph",
      icon: "speedometer",
      category: "power",
      color: "#6C5CE7",
      description: "Club head speed at impact",
      optimalRange: [80, 110]
    },
    {
      key: "hipRotation",
      label: "Hip Rotation",
      unit: "deg",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip rotation from address through impact",
      optimalRange: [35, 55]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Turn",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Full torso rotation at top of swing",
      optimalRange: [75, 100]
    },
    {
      key: "xFactor",
      label: "X-Factor",
      unit: "deg",
      icon: "analytics",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Shoulder-hip separation at top of backswing",
      optimalRange: [30, 50]
    },
    {
      key: "spineAngle",
      label: "Spine Angle",
      unit: "deg",
      icon: "trending-down",
      category: "technique",
      color: "#FBBF24",
      description: "Spine tilt consistency from address to follow-through",
      optimalRange: [25, 40]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight distribution and stability",
      optimalRange: [70, 98]
    },
    {
      key: "tempoRatio",
      label: "Tempo Ratio",
      unit: ":1",
      icon: "timer",
      category: "timing",
      color: "#6C5CE7",
      description: "Backswing-to-downswing timing ratio",
      optimalRange: [2.5, 3.5]
    },
    {
      key: "backswingDuration",
      label: "Backswing",
      unit: "s",
      icon: "arrow-back-circle",
      category: "timing",
      color: "#60A5FA",
      description: "Backswing phase duration",
      optimalRange: [0.7, 1.2]
    },
    {
      key: "headStability",
      label: "Head Stability",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Head position steadiness",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Overall swing rhythm and flow",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/pickleball-dink.ts
var pickleballDinkConfig = {
  sportName: "Pickleball",
  movementName: "Dink",
  configKey: "pickleball-dink",
  overallScoreLabel: "Dink Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.36 },
    { key: "timing", label: "Timing", weight: 0.09 },
    { key: "technique", label: "Technique", weight: 0.31 },
    { key: "consistency", label: "Consistency", weight: 0.13 }
  ],
  metrics: [
    {
      key: "paddleAngle",
      label: "Paddle Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Paddle face angle at contact \u2014 open face for controlled dinks",
      optimalRange: [25, 50]
    },
    {
      key: "softTouch",
      label: "Soft Touch",
      unit: "/100",
      icon: "hand-right",
      category: "technique",
      color: "#6C5CE7",
      description: "Ability to absorb pace and keep the ball low over the net",
      optimalRange: [70, 98]
    },
    {
      key: "wristStability",
      label: "Wrist Stability",
      unit: "/100",
      icon: "lock-closed",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Wrist firmness during contact for precise placement",
      optimalRange: [75, 98]
    },
    {
      key: "arcHeight",
      label: "Arc Height",
      unit: "m",
      icon: "trending-up",
      category: "ball",
      color: "#34D399",
      description: "Peak height of the ball above the net during the dink",
      optimalRange: [0.05, 0.3]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the dink motion",
      optimalRange: [70, 98]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of dink technique across multiple shots",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the dink motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/pickleball-drive.ts
var pickleballDriveConfig = {
  sportName: "Pickleball",
  movementName: "Drive",
  configKey: "pickleball-drive",
  overallScoreLabel: "Drive Score",
  scores: [
    { key: "power", label: "Power", weight: 0.25 },
    { key: "control", label: "Control", weight: 0.15 },
    { key: "timing", label: "Timing", weight: 0.1 },
    { key: "technique", label: "Technique", weight: 0.35 },
    { key: "consistency", label: "Consistency", weight: 0.15 }
  ],
  metrics: [
    {
      key: "paddleSpeed",
      label: "Paddle Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "power",
      color: "#EF4444",
      description: "Peak paddle velocity during the drive swing",
      optimalRange: [15, 30]
    },
    {
      key: "bodyRotation",
      label: "Body Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Angular velocity of trunk rotation generating drive power",
      optimalRange: [300, 700]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball speed off the paddle face",
      optimalRange: [35, 65]
    },
    {
      key: "trajectoryAngle",
      label: "Trajectory",
      unit: "deg",
      icon: "trending-up",
      category: "ball",
      color: "#34D399",
      description: "Launch angle of the drive \u2014 flat and aggressive is ideal",
      optimalRange: [2, 12]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the aggressive drive motion",
      optimalRange: [65, 95]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of drive technique across multiple shots",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the drive motion",
      optimalRange: [60, 90]
    }
  ]
};

// shared/sport-configs/pickleball-serve.ts
var pickleballServeConfig = {
  sportName: "Pickleball",
  movementName: "Serve",
  configKey: "pickleball-serve",
  overallScoreLabel: "Serve Score",
  scores: [
    { key: "power", label: "Power", weight: 0.15 },
    { key: "control", label: "Control", weight: 0.35 },
    { key: "timing", label: "Timing", weight: 0.1 },
    { key: "technique", label: "Technique", weight: 0.25 },
    { key: "consistency", label: "Consistency", weight: 0.15 }
  ],
  metrics: [
    {
      key: "paddleAngle",
      label: "Paddle Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Paddle face angle during the underhand serve motion",
      optimalRange: [20, 45]
    },
    {
      key: "tossConsistency",
      label: "Toss Consistency",
      unit: "/100",
      icon: "arrow-up-circle",
      category: "technique",
      color: "#FBBF24",
      description: "Consistency of ball toss height and placement",
      optimalRange: [70, 98]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Speed of the serve off the paddle",
      optimalRange: [25, 50]
    },
    {
      key: "placement",
      label: "Placement",
      unit: "/100",
      icon: "locate",
      category: "ball",
      color: "#34D399",
      description: "Accuracy of serve placement in the target zone",
      optimalRange: [65, 95]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability throughout the serve motion",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the serve motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/pickleball-volley.ts
var pickleballVolleyConfig = {
  sportName: "Pickleball",
  movementName: "Volley",
  configKey: "pickleball-volley",
  overallScoreLabel: "Volley Score",
  scores: [
    { key: "power", label: "Power", weight: 0.15 },
    { key: "control", label: "Control", weight: 0.4 },
    { key: "timing", label: "Timing", weight: 0.1 },
    { key: "technique", label: "Technique", weight: 0.2 },
    { key: "consistency", label: "Consistency", weight: 0.15 }
  ],
  metrics: [
    {
      key: "reactionSpeed",
      label: "Reaction Speed",
      unit: "ms",
      icon: "flash",
      category: "timing",
      color: "#6C5CE7",
      description: "Time from opponent's contact to paddle movement initiation",
      optimalRange: [120, 300]
    },
    {
      key: "paddlePrep",
      label: "Paddle Prep",
      unit: "/100",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "Readiness and position of paddle before the volley",
      optimalRange: [70, 98]
    },
    {
      key: "wristFirmness",
      label: "Wrist Firmness",
      unit: "/100",
      icon: "lock-closed",
      category: "technique",
      color: "#FBBF24",
      description: "Wrist stability at contact for controlled volleys",
      optimalRange: [75, 98]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during quick volley exchanges",
      optimalRange: [65, 95]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "speedometer",
      category: "ball",
      color: "#34D399",
      description: "Ball speed after the volley contact",
      optimalRange: [20, 50]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of volley technique across exchanges",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and tempo of volley exchanges",
      optimalRange: [60, 90]
    }
  ]
};

// shared/sport-configs/pickleball-third-shot-drop.ts
var pickleballThirdShotDropConfig = {
  sportName: "Pickleball",
  movementName: "Third Shot Drop",
  configKey: "pickleball-third-shot-drop",
  overallScoreLabel: "Third Shot Drop Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.31 },
    { key: "timing", label: "Timing", weight: 0.09 },
    { key: "technique", label: "Technique", weight: 0.36 },
    { key: "consistency", label: "Consistency", weight: 0.13 }
  ],
  metrics: [
    {
      key: "arcHeight",
      label: "Arc Height",
      unit: "m",
      icon: "trending-up",
      category: "ball",
      color: "#34D399",
      description: "Peak height of the drop shot \u2014 should clear net but land softly",
      optimalRange: [0.1, 0.4]
    },
    {
      key: "softTouch",
      label: "Soft Touch",
      unit: "/100",
      icon: "hand-right",
      category: "technique",
      color: "#6C5CE7",
      description: "Ability to decelerate the paddle for a soft landing",
      optimalRange: [70, 98]
    },
    {
      key: "paddleAngle",
      label: "Paddle Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Paddle face angle for proper drop shot trajectory",
      optimalRange: [30, 55]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of third shot drop execution",
      optimalRange: [65, 95]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the transition drop shot",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the drop shot motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/paddle-forehand.ts
var paddleForehandConfig = {
  sportName: "Paddle",
  movementName: "Forehand",
  configKey: "paddle-forehand",
  overallScoreLabel: "Forehand Score",
  scores: [
    { key: "power", label: "Power", weight: 0.18 },
    { key: "control", label: "Control", weight: 0.09 },
    { key: "timing", label: "Timing", weight: 0.18 },
    { key: "technique", label: "Technique", weight: 0.41 },
    { key: "consistency", label: "Consistency", weight: 0.14 }
  ],
  metrics: [
    {
      key: "wristSpeed",
      label: "Wrist Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Peak wrist velocity during the forehand swing",
      optimalRange: [18, 32]
    },
    {
      key: "elbowAngle",
      label: "Elbow Angle",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Average elbow joint angle during the stroke",
      optimalRange: [110, 150]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Angular velocity of torso rotation during the swing",
      optimalRange: [400, 800]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip-to-ankle alignment stability throughout the stroke",
      optimalRange: [70, 98]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball speed after contact",
      optimalRange: [40, 80]
    },
    {
      key: "wallPlayScore",
      label: "Wall Play",
      unit: "/100",
      icon: "grid",
      category: "technique",
      color: "#FBBF24",
      description: "Quality of wall utilization and rebound anticipation",
      optimalRange: [60, 95]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Variance in technique across repeated strokes",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing flow throughout the swing",
      optimalRange: [65, 95]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of contact point relative to ground",
      optimalRange: [0.7, 1.1]
    }
  ]
};

// shared/sport-configs/paddle-backhand.ts
var paddleBackhandConfig = {
  sportName: "Paddle",
  movementName: "Backhand",
  configKey: "paddle-backhand",
  overallScoreLabel: "Backhand Score",
  scores: [
    { key: "power", label: "Power", weight: 0.2 },
    { key: "control", label: "Control", weight: 0.2 },
    { key: "timing", label: "Timing", weight: 0.2 },
    { key: "technique", label: "Technique", weight: 0.25 },
    { key: "consistency", label: "Consistency", weight: 0.15 }
  ],
  metrics: [
    {
      key: "wristSpeed",
      label: "Wrist Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Peak wrist velocity during the backhand swing",
      optimalRange: [15, 28]
    },
    {
      key: "elbowAngle",
      label: "Elbow Angle",
      unit: "deg",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Average elbow joint angle during the backhand stroke",
      optimalRange: [100, 145]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Angular velocity of torso rotation during the backhand",
      optimalRange: [350, 750]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability throughout the backhand stroke",
      optimalRange: [70, 98]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball speed after backhand contact",
      optimalRange: [35, 70]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of backhand technique across strokes",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing flow of the backhand motion",
      optimalRange: [65, 95]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of paddle at ball contact",
      optimalRange: [0.6, 1.05]
    }
  ]
};

// shared/sport-configs/paddle-serve.ts
var paddleServeConfig = {
  sportName: "Paddle",
  movementName: "Serve",
  configKey: "paddle-serve",
  overallScoreLabel: "Serve Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.22 },
    { key: "timing", label: "Timing", weight: 0.18 },
    { key: "technique", label: "Technique", weight: 0.27 },
    { key: "consistency", label: "Consistency", weight: 0.22 }
  ],
  metrics: [
    {
      key: "paddleAngle",
      label: "Paddle Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Angle of paddle face at contact for slice or flat serve",
      optimalRange: [15, 45]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Ball speed after serve contact",
      optimalRange: [30, 60]
    },
    {
      key: "placementScore",
      label: "Placement",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Accuracy of serve placement in the service box",
      optimalRange: [65, 98]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of serve technique across attempts",
      optimalRange: [70, 98]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the underhand serve motion",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the serve motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/paddle-smash.ts
var paddleSmashConfig = {
  sportName: "Paddle",
  movementName: "Smash",
  configKey: "paddle-smash",
  overallScoreLabel: "Smash Score",
  scores: [
    { key: "power", label: "Power", weight: 0.47 },
    { key: "control", label: "Control", weight: 0.09 },
    { key: "timing", label: "Timing", weight: 0.17 },
    { key: "technique", label: "Technique", weight: 0.21 },
    { key: "consistency", label: "Consistency", weight: 0.06 }
  ],
  metrics: [
    {
      key: "wristSpeed",
      label: "Wrist Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Peak wrist velocity during the overhead smash",
      optimalRange: [22, 38]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Angular velocity of torso rotation during the smash",
      optimalRange: [500, 900]
    },
    {
      key: "jumpHeight",
      label: "Jump Height",
      unit: "m",
      icon: "arrow-up-circle",
      category: "power",
      color: "#EF4444",
      description: "Vertical jump height during the smash",
      optimalRange: [0.1, 0.5]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Ball speed after the overhead smash",
      optimalRange: [50, 90]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of paddle at ball contact during smash",
      optimalRange: [2, 3]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during and after the smash",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the smash motion",
      optimalRange: [60, 92]
    }
  ]
};

// shared/sport-configs/paddle-bandeja.ts
var paddleBandejaConfig = {
  sportName: "Paddle",
  movementName: "Bandeja",
  configKey: "paddle-bandeja",
  overallScoreLabel: "Bandeja Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.27 },
    { key: "timing", label: "Timing", weight: 0.18 },
    { key: "technique", label: "Technique", weight: 0.22 },
    { key: "consistency", label: "Consistency", weight: 0.22 }
  ],
  metrics: [
    {
      key: "paddleAngle",
      label: "Paddle Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Angle of paddle face for the defensive slice",
      optimalRange: [20, 50]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Ball speed after the bandeja contact",
      optimalRange: [25, 55]
    },
    {
      key: "wristControl",
      label: "Wrist Control",
      unit: "/100",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "Wrist stability and control during the slice motion",
      optimalRange: [70, 98]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of paddle at ball contact during bandeja",
      optimalRange: [1.8, 2.8]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the defensive overhead",
      optimalRange: [70, 98]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of bandeja technique",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the bandeja motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/badminton-clear.ts
var badmintonClearConfig = {
  sportName: "Badminton",
  movementName: "Clear",
  configKey: "badminton-clear",
  overallScoreLabel: "Clear Score",
  scores: [
    { key: "power", label: "Power", weight: 0.23 },
    { key: "control", label: "Control", weight: 0.09 },
    { key: "timing", label: "Timing", weight: 0.14 },
    { key: "technique", label: "Technique", weight: 0.41 },
    { key: "consistency", label: "Consistency", weight: 0.13 }
  ],
  metrics: [
    {
      key: "racketSpeed",
      label: "Racket Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "power",
      color: "#E74C3C",
      description: "Peak racket head speed during the clear stroke",
      optimalRange: [25, 45]
    },
    {
      key: "shuttleSpeed",
      label: "Shuttle Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Shuttle speed after the clear",
      optimalRange: [80, 150]
    },
    {
      key: "trajectoryHeight",
      label: "Trajectory Height",
      unit: "m",
      icon: "trending-up",
      category: "ball",
      color: "#6C5CE7",
      description: "Peak height of the shuttle trajectory",
      optimalRange: [5, 10]
    },
    {
      key: "shoulderRotation",
      label: "Shoulder Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Trunk rotation velocity during the clear",
      optimalRange: [500, 900]
    },
    {
      key: "footworkScore",
      label: "Footwork",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Quality of court movement and positioning",
      optimalRange: [65, 95]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability throughout the clear motion",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the clear stroke",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/badminton-smash.ts
var badmintonSmashConfig = {
  sportName: "Badminton",
  movementName: "Smash",
  configKey: "badminton-smash",
  overallScoreLabel: "Smash Score",
  scores: [
    { key: "power", label: "Power", weight: 0.41 },
    { key: "control", label: "Control", weight: 0.09 },
    { key: "timing", label: "Timing", weight: 0.18 },
    { key: "technique", label: "Technique", weight: 0.23 },
    { key: "consistency", label: "Consistency", weight: 0.09 }
  ],
  metrics: [
    {
      key: "racketSpeed",
      label: "Racket Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "power",
      color: "#E74C3C",
      description: "Peak racket head speed during the smash",
      optimalRange: [35, 60]
    },
    {
      key: "shuttleSpeed",
      label: "Shuttle Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Shuttle speed after the smash",
      optimalRange: [150, 300]
    },
    {
      key: "jumpHeight",
      label: "Jump Height",
      unit: "m",
      icon: "arrow-up-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Height gained during the jump smash",
      optimalRange: [0.2, 0.6]
    },
    {
      key: "contactHeight",
      label: "Contact Height",
      unit: "m",
      icon: "resize",
      category: "technique",
      color: "#FBBF24",
      description: "Height of racket at shuttle contact",
      optimalRange: [2.5, 3.2]
    },
    {
      key: "wristSnap",
      label: "Wrist Snap",
      unit: "deg/s",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "Wrist snap speed at contact for maximum power",
      optimalRange: [400, 800]
    },
    {
      key: "bodyRotation",
      label: "Body Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Full body rotation velocity during the smash",
      optimalRange: [500, 1e3]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the smash motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/badminton-drop.ts
var badmintonDropConfig = {
  sportName: "Badminton",
  movementName: "Drop Shot",
  configKey: "badminton-drop",
  overallScoreLabel: "Drop Shot Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.49 },
    { key: "timing", label: "Timing", weight: 0.09 },
    { key: "technique", label: "Technique", weight: 0.18 },
    { key: "consistency", label: "Consistency", weight: 0.13 }
  ],
  metrics: [
    {
      key: "touchScore",
      label: "Touch",
      unit: "/100",
      icon: "finger-print",
      category: "technique",
      color: "#FBBF24",
      description: "Softness and precision of the drop shot",
      optimalRange: [70, 98]
    },
    {
      key: "deceptionScore",
      label: "Deception",
      unit: "/100",
      icon: "eye-off",
      category: "technique",
      color: "#FBBF24",
      description: "How well the shot disguises intent",
      optimalRange: [65, 95]
    },
    {
      key: "netClearance",
      label: "Net Clearance",
      unit: "cm",
      icon: "resize",
      category: "ball",
      color: "#34D399",
      description: "Height above the net the shuttle passes",
      optimalRange: [2, 15]
    },
    {
      key: "racketAngle",
      label: "Racket Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Racket face angle at contact",
      optimalRange: [20, 45]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of drop shot placement",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the drop shot motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/badminton-net-shot.ts
var badmintonNetShotConfig = {
  sportName: "Badminton",
  movementName: "Net Shot",
  configKey: "badminton-net-shot",
  overallScoreLabel: "Net Shot Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.49 },
    { key: "timing", label: "Timing", weight: 0.09 },
    { key: "technique", label: "Technique", weight: 0.18 },
    { key: "consistency", label: "Consistency", weight: 0.13 }
  ],
  metrics: [
    {
      key: "racketControl",
      label: "Racket Control",
      unit: "/100",
      icon: "hand-right",
      category: "technique",
      color: "#FBBF24",
      description: "Precision of racket face control at the net",
      optimalRange: [70, 98]
    },
    {
      key: "wristFinesse",
      label: "Wrist Finesse",
      unit: "/100",
      icon: "finger-print",
      category: "technique",
      color: "#FBBF24",
      description: "Delicacy and precision of wrist movements",
      optimalRange: [70, 98]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the net shot",
      optimalRange: [65, 95]
    },
    {
      key: "footworkScore",
      label: "Footwork",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Quality of movement to the net",
      optimalRange: [65, 95]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of net shot technique",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the net shot motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/badminton-serve.ts
var badmintonServeConfig = {
  sportName: "Badminton",
  movementName: "Serve",
  configKey: "badminton-serve",
  overallScoreLabel: "Serve Score",
  scores: [
    { key: "power", label: "Power", weight: 0.11 },
    { key: "control", label: "Control", weight: 0.27 },
    { key: "timing", label: "Timing", weight: 0.18 },
    { key: "technique", label: "Technique", weight: 0.22 },
    { key: "consistency", label: "Consistency", weight: 0.22 }
  ],
  metrics: [
    {
      key: "racketAngle",
      label: "Racket Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#FBBF24",
      description: "Racket face angle at shuttle contact",
      optimalRange: [15, 40]
    },
    {
      key: "shuttleSpeed",
      label: "Shuttle Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#34D399",
      description: "Shuttle speed after the serve",
      optimalRange: [30, 100]
    },
    {
      key: "placementScore",
      label: "Placement",
      unit: "/100",
      icon: "locate",
      category: "ball",
      color: "#34D399",
      description: "Accuracy of serve placement in the target zone",
      optimalRange: [70, 98]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of serve technique and placement",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the serve motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/tabletennis-forehand.ts
var tabletennisForehandConfig = {
  sportName: "Table Tennis",
  movementName: "Forehand",
  configKey: "tabletennis-forehand",
  overallScoreLabel: "Forehand Score",
  scores: [
    { key: "power", label: "Power", weight: 0.17 },
    { key: "control", label: "Control", weight: 0.08 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.5 },
    { key: "consistency", label: "Consistency", weight: 0.17 }
  ],
  metrics: [
    {
      key: "batSpeed",
      label: "Bat Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "power",
      color: "#EF4444",
      description: "Peak bat head velocity during the forehand drive",
      optimalRange: [8, 18]
    },
    {
      key: "wristAction",
      label: "Wrist Action",
      unit: "deg/s",
      icon: "hand-left",
      category: "technique",
      color: "#6C5CE7",
      description: "Wrist snap angular velocity at contact for topspin generation",
      optimalRange: [300, 700]
    },
    {
      key: "spinRate",
      label: "Spin Rate",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Estimated ball spin based on bat angle and wrist snap",
      optimalRange: [2e3, 5e3]
    },
    {
      key: "footworkScore",
      label: "Footwork",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Foot positioning and weight transfer quality during the stroke",
      optimalRange: [65, 95]
    },
    {
      key: "bodyRotation",
      label: "Body Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Trunk rotation velocity powering the forehand drive",
      optimalRange: [200, 500]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#FBBF24",
      description: "Repeatability of bat speed and stroke mechanics across frames",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Smoothness and tempo consistency of the stroke cycle",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/tabletennis-backhand.ts
var tabletennisBackhandConfig = {
  sportName: "Table Tennis",
  movementName: "Backhand",
  configKey: "tabletennis-backhand",
  overallScoreLabel: "Backhand Score",
  scores: [
    { key: "power", label: "Power", weight: 0.2 },
    { key: "control", label: "Control", weight: 0.15 },
    { key: "timing", label: "Timing", weight: 0.25 },
    { key: "technique", label: "Technique", weight: 0.2 },
    { key: "consistency", label: "Consistency", weight: 0.2 }
  ],
  metrics: [
    {
      key: "batSpeed",
      label: "Bat Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "power",
      color: "#EF4444",
      description: "Peak bat velocity during the backhand stroke",
      optimalRange: [6, 15]
    },
    {
      key: "timingScore",
      label: "Timing",
      unit: "/100",
      icon: "timer",
      category: "timing",
      color: "#A78BFA",
      description: "Precision of contact timing relative to the ball bounce",
      optimalRange: [70, 98]
    },
    {
      key: "batAngle",
      label: "Bat Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#6C5CE7",
      description: "Bat face angle at contact point for optimal trajectory",
      optimalRange: [30, 70]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#FBBF24",
      description: "Stroke repeatability across multiple backhand shots",
      optimalRange: [70, 98]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability and center of gravity control during the stroke",
      optimalRange: [70, 98]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Tempo consistency and fluidity of the backhand motion",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/tabletennis-serve.ts
var tabletennisServeConfig = {
  sportName: "Table Tennis",
  movementName: "Serve",
  configKey: "tabletennis-serve",
  overallScoreLabel: "Serve Score",
  scores: [
    { key: "power", label: "Power", weight: 0.1 },
    { key: "control", label: "Control", weight: 0.29 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.41 },
    { key: "consistency", label: "Consistency", weight: 0.12 }
  ],
  metrics: [
    {
      key: "spinVariation",
      label: "Spin Variation",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Range of spin types and rates applied across serves",
      optimalRange: [1500, 4500]
    },
    {
      key: "batAngle",
      label: "Bat Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#6C5CE7",
      description: "Bat face angle at contact determining spin type and direction",
      optimalRange: [20, 65]
    },
    {
      key: "ballSpeed",
      label: "Ball Speed",
      unit: "mph",
      icon: "flash",
      category: "ball",
      color: "#EF4444",
      description: "Speed of the ball after serve contact",
      optimalRange: [15, 40]
    },
    {
      key: "tossHeight",
      label: "Toss Height",
      unit: "cm",
      icon: "arrow-up",
      category: "technique",
      color: "#60A5FA",
      description: "Height of ball toss above the table surface (must be 16cm+ per rules)",
      optimalRange: [16, 30]
    },
    {
      key: "placementScore",
      label: "Placement",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Accuracy of serve placement targeting specific zones",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Consistency of serve motion tempo and timing",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/tabletennis-loop.ts
var tabletennisLoopConfig = {
  sportName: "Table Tennis",
  movementName: "Loop",
  configKey: "tabletennis-loop",
  overallScoreLabel: "Loop Score",
  scores: [
    { key: "power", label: "Power", weight: 0.18 },
    { key: "control", label: "Control", weight: 0.14 },
    { key: "timing", label: "Timing", weight: 0.09 },
    { key: "technique", label: "Technique", weight: 0.41 },
    { key: "consistency", label: "Consistency", weight: 0.18 }
  ],
  metrics: [
    {
      key: "batSpeed",
      label: "Bat Speed",
      unit: "m/s",
      icon: "speedometer",
      category: "power",
      color: "#EF4444",
      description: "Peak bat velocity during the upward brushing motion",
      optimalRange: [10, 22]
    },
    {
      key: "bodyRotation",
      label: "Body Rotation",
      unit: "deg/s",
      icon: "refresh-circle",
      category: "biomechanics",
      color: "#6C5CE7",
      description: "Trunk rotation speed generating loop power",
      optimalRange: [250, 600]
    },
    {
      key: "spinRate",
      label: "Spin Rate",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Heavy topspin rate produced by the loop stroke",
      optimalRange: [3e3, 6e3]
    },
    {
      key: "contactPoint",
      label: "Contact Point",
      unit: "/100",
      icon: "locate",
      category: "technique",
      color: "#FBBF24",
      description: "Optimal contact point position relative to body and table",
      optimalRange: [65, 95]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability and weight transfer during the explosive loop",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Tempo consistency of the loop stroke cycle",
      optimalRange: [60, 92]
    }
  ]
};

// shared/sport-configs/tabletennis-chop.ts
var tabletennisChopConfig = {
  sportName: "Table Tennis",
  movementName: "Chop",
  configKey: "tabletennis-chop",
  overallScoreLabel: "Chop Score",
  scores: [
    { key: "power", label: "Power", weight: 0.1 },
    { key: "control", label: "Control", weight: 0.12 },
    { key: "timing", label: "Timing", weight: 0.08 },
    { key: "technique", label: "Technique", weight: 0.49 },
    { key: "consistency", label: "Consistency", weight: 0.21 }
  ],
  metrics: [
    {
      key: "batAngle",
      label: "Bat Angle",
      unit: "deg",
      icon: "analytics",
      category: "technique",
      color: "#6C5CE7",
      description: "Bat face angle during the downward chopping motion",
      optimalRange: [40, 75]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/100",
      icon: "ribbon",
      category: "consistency",
      color: "#FBBF24",
      description: "Repeatability of chop depth and backspin across strokes",
      optimalRange: [70, 98]
    },
    {
      key: "spinRate",
      label: "Spin Rate",
      unit: "rpm",
      icon: "sync",
      category: "ball",
      color: "#34D399",
      description: "Backspin rate generated by the chopping action",
      optimalRange: [1500, 4e3]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/100",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Stability during the defensive chopping stance",
      optimalRange: [70, 98]
    },
    {
      key: "footworkScore",
      label: "Footwork",
      unit: "/100",
      icon: "walk",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Foot positioning and movement quality for defensive coverage",
      optimalRange: [65, 95]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/100",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Tempo consistency of the defensive chop cycle",
      optimalRange: [65, 95]
    }
  ]
};

// shared/sport-configs/index.ts
var configRegistry = {
  "tennis-forehand": tennisForehandConfig,
  "tennis-backhand": tennisBackhandConfig,
  "tennis-serve": tennisServeConfig,
  "tennis-volley": tennisVolleyConfig,
  "tennis-game": tennisGameConfig,
  "golf-drive": golfDriveConfig,
  "golf-iron": golfIronConfig,
  "golf-chip": golfChipConfig,
  "golf-putt": golfPuttConfig,
  "golf-full-swing": golfFullSwingConfig,
  "pickleball-dink": pickleballDinkConfig,
  "pickleball-drive": pickleballDriveConfig,
  "pickleball-serve": pickleballServeConfig,
  "pickleball-volley": pickleballVolleyConfig,
  "pickleball-third-shot-drop": pickleballThirdShotDropConfig,
  "paddle-forehand": paddleForehandConfig,
  "paddle-backhand": paddleBackhandConfig,
  "paddle-serve": paddleServeConfig,
  "paddle-smash": paddleSmashConfig,
  "paddle-bandeja": paddleBandejaConfig,
  "badminton-clear": badmintonClearConfig,
  "badminton-smash": badmintonSmashConfig,
  "badminton-drop": badmintonDropConfig,
  "badminton-net-shot": badmintonNetShotConfig,
  "badminton-serve": badmintonServeConfig,
  "tabletennis-forehand": tabletennisForehandConfig,
  "tabletennis-backhand": tabletennisBackhandConfig,
  "tabletennis-serve": tabletennisServeConfig,
  "tabletennis-loop": tabletennisLoopConfig,
  "tabletennis-chop": tabletennisChopConfig
};
function normalizeScoresWithoutConsistency(config) {
  const filteredScores = (config.scores || []).filter(
    (score) => String(score.key || "").toLowerCase() !== "consistency"
  );
  if (!filteredScores.length) {
    return { ...config, scores: [] };
  }
  const totalWeight = filteredScores.reduce((sum, score) => sum + Number(score.weight || 0), 0);
  if (totalWeight <= 0) {
    const equal = Number((1 / filteredScores.length).toFixed(2));
    return {
      ...config,
      scores: filteredScores.map((score, idx) => ({
        ...score,
        weight: idx === filteredScores.length - 1 ? Number((1 - equal * (filteredScores.length - 1)).toFixed(2)) : equal
      }))
    };
  }
  let used = 0;
  const normalized = filteredScores.map((score, idx) => {
    if (idx === filteredScores.length - 1) {
      return {
        ...score,
        weight: Number((1 - used).toFixed(2))
      };
    }
    const weight = Number((Number(score.weight || 0) / totalWeight).toFixed(2));
    used += weight;
    return { ...score, weight };
  });
  return { ...config, scores: normalized };
}
function getSportConfig(configKey) {
  const config = configRegistry[configKey];
  return config ? normalizeScoresWithoutConsistency(config) : void 0;
}
function getAllConfigs() {
  return Object.fromEntries(
    Object.entries(configRegistry).map(([key, config]) => [key, normalizeScoresWithoutConsistency(config)])
  );
}
var movementAliases = {
  "iron-shot": "iron",
  "full-swing": "full-swing",
  "third-shot-drop": "third-shot-drop",
  "net-shot": "net-shot"
};
function getConfigKey(sportName, movementName) {
  const sport = sportName.toLowerCase().replace(/\s+/g, "");
  const movement = movementName.toLowerCase().replace(/\s+/g, "-");
  const resolvedMovement = movementAliases[movement] ?? movement;
  const key = `${sport}-${resolvedMovement}`;
  if (configRegistry[key]) return key;
  const directKey = `${sport}-${movement}`;
  if (configRegistry[directKey]) return directKey;
  return key;
}

// server/model-registry.ts
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
var configPath = path.resolve(process.cwd(), "config", "model-registry.config.json");
var evaluationDatasetFolder = path.resolve(process.cwd(), "model_evaluation_datasets", "dataset");
var evaluationDatasetFolderPrefix = "model_evaluation_datasets/dataset";
var manualTuningDatasetName = "manual-annotations";
var defaultConfig = {
  activeModelVersion: "0.1",
  modelVersionChangeDescription: "Initial baseline scoring model release.",
  evaluationDatasetManifestPath: "model_evaluation_datasets/manifest.json"
};
function getConfigPath() {
  return configPath;
}
function ensureConfigDirExists() {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function toLegacyVideoId(filename) {
  const normalized = String(filename || "").trim().toLowerCase();
  const digest = createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  return `legacy-${digest}`;
}
function resolveVideoId(video) {
  const parsed = String(video?.videoId || "").trim();
  if (parsed) return parsed;
  return toLegacyVideoId(String(video.filename || ""));
}
function readModelRegistryConfig() {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      activeModelVersion: String(parsed.activeModelVersion || defaultConfig.activeModelVersion),
      modelVersionChangeDescription: String(
        parsed.modelVersionChangeDescription || defaultConfig.modelVersionChangeDescription
      ),
      evaluationDatasetManifestPath: String(
        parsed.evaluationDatasetManifestPath || defaultConfig.evaluationDatasetManifestPath
      )
    };
  } catch {
    return defaultConfig;
  }
}
function writeModelRegistryConfig(nextConfig) {
  const sanitized = {
    activeModelVersion: String(nextConfig.activeModelVersion || "").trim() || defaultConfig.activeModelVersion,
    modelVersionChangeDescription: String(nextConfig.modelVersionChangeDescription || "").trim(),
    evaluationDatasetManifestPath: String(nextConfig.evaluationDatasetManifestPath || "").trim() || defaultConfig.evaluationDatasetManifestPath
  };
  ensureConfigDirExists();
  fs.writeFileSync(getConfigPath(), `${JSON.stringify(sanitized, null, 2)}
`, "utf-8");
  return sanitized;
}
function readEvaluationDatasetManifest(config) {
  const cfg = config || readModelRegistryConfig();
  const manifestPath = path.resolve(process.cwd(), cfg.evaluationDatasetManifestPath);
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const datasets = Array.isArray(parsed.datasets) ? parsed.datasets.map((dataset) => ({
      name: String(dataset?.name || "unnamed-dataset"),
      videos: Array.isArray(dataset?.videos) ? dataset.videos.map((video) => ({
        videoId: resolveVideoId(video || {}),
        filename: String(video?.filename || "").trim(),
        movementType: String(video?.movementType || "").trim()
      })).filter((video) => video.filename) : []
    })) : [];
    const versionHistory = Array.isArray(parsed.versionHistory) ? parsed.versionHistory.map((item) => ({
      modelVersion: String(item?.modelVersion || "").trim(),
      savedAt: String(item?.savedAt || "").trim(),
      datasets: Array.isArray(item?.datasets) ? item.datasets.map((dataset) => ({
        name: String(dataset?.name || "unnamed-dataset"),
        videos: Array.isArray(dataset?.videos) ? dataset.videos.map((video) => ({
          videoId: resolveVideoId(video || {}),
          filename: String(video?.filename || "").trim(),
          movementType: String(video?.movementType || "").trim()
        })).filter((video) => video.filename) : []
      })) : []
    })).filter((item) => item.modelVersion) : [];
    return {
      activeModelVersion: String(parsed.activeModelVersion || "").trim() || void 0,
      versionHistory,
      datasets
    };
  } catch {
    return { datasets: [] };
  }
}
function getEvaluationDatasetVideoMap(config) {
  const manifest = readEvaluationDatasetManifest(config);
  const map = /* @__PURE__ */ new Map();
  for (const dataset of manifest.datasets) {
    for (const video of dataset.videos) {
      const entry = {
        videoId: video.videoId,
        datasetName: dataset.name,
        movementType: video.movementType
      };
      if (video.videoId) {
        map.set(video.videoId, entry);
      }
      const fullName = String(video.filename || "").trim();
      if (!fullName) continue;
      map.set(fullName, entry);
      const basename = path.basename(fullName);
      if (basename && basename !== fullName) {
        map.set(basename, entry);
      }
    }
  }
  return map;
}
function ensureEvaluationDatasetDir() {
  if (!fs.existsSync(evaluationDatasetFolder)) {
    fs.mkdirSync(evaluationDatasetFolder, { recursive: true });
  }
}
function getManifestPath(config) {
  return path.resolve(process.cwd(), config.evaluationDatasetManifestPath);
}
function writeEvaluationDatasetManifest(config, manifest) {
  const manifestPath = getManifestPath(config);
  const manifestDir = path.dirname(manifestPath);
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}
`, "utf-8");
}
function buildEvaluationDatasetEntryPath(filename) {
  return `${evaluationDatasetFolderPrefix}/${filename}`;
}
function removeVideoFromAllDatasets(manifest, filename, videoId) {
  const filenameTrimmed = String(filename || "").trim();
  const targetPath = buildEvaluationDatasetEntryPath(filenameTrimmed);
  const legacyVideoId = toLegacyVideoId(targetPath);
  const nextVideoId = String(videoId || "").trim();
  return {
    ...manifest,
    datasets: (manifest.datasets || []).map((dataset) => ({
      ...dataset,
      videos: (dataset.videos || []).filter((video) => {
        const candidate = String(video.filename || "").trim();
        const videoId2 = String(video.videoId || "").trim();
        if (!candidate) return false;
        return candidate !== filenameTrimmed && candidate !== targetPath && path.basename(candidate) !== filenameTrimmed && videoId2 !== legacyVideoId && (!nextVideoId || videoId2 !== nextVideoId);
      })
    }))
  };
}
function incrementModelVersion(currentVersion) {
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
function updateManifestActiveModelVersion(activeModelVersion, config) {
  const cfg = config || readModelRegistryConfig();
  const manifest = readEvaluationDatasetManifest(cfg);
  const nextManifest = {
    ...manifest,
    activeModelVersion: String(activeModelVersion || "").trim() || void 0
  };
  writeEvaluationDatasetManifest(cfg, nextManifest);
  return nextManifest;
}
function syncVideoForModelTuning(params) {
  const config = params.config || readModelRegistryConfig();
  const filename = path.basename(String(params.sourceVideoFilename || "").trim());
  if (!filename) {
    throw new Error("Invalid sourceVideoFilename");
  }
  const nextMovementType = String(params.movementType || "").trim() || "unknown";
  const manifestFilename = buildEvaluationDatasetEntryPath(filename);
  const datasetName = String(params.datasetName || "").trim() || manualTuningDatasetName;
  const nextVideoId = String(params.videoId || "").trim() || randomUUID();
  let manifest = readEvaluationDatasetManifest(config);
  manifest = removeVideoFromAllDatasets(manifest, filename, nextVideoId);
  if (params.enabled) {
    ensureEvaluationDatasetDir();
    const sourcePath = path.resolve(String(params.sourceVideoPath || ""));
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error("Source video not found for model tuning copy");
    }
    const targetPath = path.join(evaluationDatasetFolder, filename);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
    const datasets = [...manifest.datasets || []];
    const datasetIndex = datasets.findIndex((item) => String(item.name || "").trim() === datasetName);
    if (datasetIndex >= 0) {
      datasets[datasetIndex] = {
        ...datasets[datasetIndex],
        videos: [
          ...datasets[datasetIndex].videos || [],
          { videoId: nextVideoId, filename: manifestFilename, movementType: nextMovementType }
        ]
      };
    } else {
      datasets.push({
        name: datasetName,
        videos: [{ videoId: nextVideoId, filename: manifestFilename, movementType: nextMovementType }]
      });
    }
    manifest = { datasets };
  }
  writeEvaluationDatasetManifest(config, manifest);
  return {
    enabled: params.enabled,
    manifestFilename,
    videoId: nextVideoId
  };
}
function isMovementMatch(expectedMovement, detectedMovement) {
  const expected = normalizeToken(expectedMovement);
  const detected = normalizeToken(detectedMovement);
  if (!expected || !detected) return false;
  return expected === detected;
}
function validateEvaluationDatasetManifest(config) {
  const cfg = config || readModelRegistryConfig();
  const manifest = readEvaluationDatasetManifest(cfg);
  const errors = [];
  const warnings = [];
  const filenameCounts = /* @__PURE__ */ new Map();
  const videoIdCounts = /* @__PURE__ */ new Map();
  if (!manifest.datasets.length) {
    warnings.push("No datasets configured in evaluation manifest.");
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
        warnings.push(`Video '${filename}' in dataset '${dataset.name}' is missing videoId; a legacy fallback id will be used.`);
      }
      if (videoId) {
        videoIdCounts.set(videoId, (videoIdCounts.get(videoId) || 0) + 1);
      }
      filenameCounts.set(filename, (filenameCounts.get(filename) || 0) + 1);
      if (!movementType) {
        errors.push(`Video '${filename}' in dataset '${dataset.name}' is missing movementType.`);
      }
    }
  }
  const duplicateFilenames = Array.from(filenameCounts.entries()).filter(([, count]) => count > 1).map(([filename]) => filename).sort();
  const duplicateVideoIds = Array.from(videoIdCounts.entries()).filter(([, count]) => count > 1).map(([videoId]) => videoId).sort();
  if (duplicateFilenames.length > 0) {
    errors.push(`Found duplicate filenames in manifest: ${duplicateFilenames.join(", ")}.`);
  }
  if (duplicateVideoIds.length > 0) {
    errors.push(`Found duplicate videoIds in manifest: ${duplicateVideoIds.join(", ")}.`);
  }
  const totalVideos = Array.from(filenameCounts.values()).reduce((sum, count) => sum + count, 0);
  return {
    valid: errors.length === 0,
    datasetCount: manifest.datasets.length,
    totalVideos,
    duplicateFilenames,
    duplicateVideoIds,
    errors,
    warnings
  };
}

// server/score-input-params.ts
import fs2 from "fs";
import path2 from "path";
var TECHNICAL_DEFS = [
  { name: "Balance", parameters: ["balanceScore", "reactionTime"] },
  { name: "Inertia", parameters: ["stanceAngle", "shoulderRotationSpeed"] },
  { name: "Opposite Force", parameters: ["kneeBendAngle", "balanceScore", "stanceAngle"] },
  { name: "Momentum", parameters: ["hipRotationSpeed", "shoulderRotationSpeed", "ballSpeed"] },
  { name: "Elastic Energy", parameters: ["racketLagAngle", "kneeBendAngle", "swingPathAngle"] },
  { name: "Contact", parameters: ["contactDistance", "contactHeight", "reactionTime"] }
];
var MOVEMENT_DEFS = [
  { name: "Ready", parameters: ["splitStepTime", "balanceScore"] },
  { name: "Read", parameters: ["reactionTime", "splitStepTime"] },
  { name: "React", parameters: ["reactionTime", "balanceScore"] },
  { name: "Respond", parameters: ["ballSpeed", "contactHeight", "swingPathAngle"] },
  { name: "Recover", parameters: ["recoveryTime", "balanceScore"] }
];
var TACTICAL_ALIAS_WEIGHTS = {
  power: {
    power: 1,
    speed: 0.9,
    athleticism: 0.8,
    touch: 0.5
  },
  control: {
    control: 1,
    stability: 0.9,
    placement: 0.8,
    accuracy: 0.8,
    alignment: 0.7,
    finesse: 0.7,
    deception: 0.6,
    reflexes: 0.5,
    balance: 0.7,
    movement: 0.6,
    shotselection: 0.6
  },
  timing: {
    timing: 1,
    rhythm: 0.8,
    reflexes: 0.5
  },
  technique: {
    technique: 1,
    followthrough: 0.8,
    spin: 0.6,
    arc: 0.6,
    footwork: 0.6,
    wallplay: 0.6,
    shotselection: 0.4,
    movement: 0.4,
    placement: 0.4,
    accuracy: 0.4,
    control: 0.5,
    deception: 0.5,
    finesse: 0.5
  }
};
function canonicalKey2(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function metricValueMap(metricValues) {
  const out = /* @__PURE__ */ new Map();
  for (const [k, v] of Object.entries(metricValues || {})) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out.set(canonicalKey2(k), n);
  }
  return out;
}
function pickValues(parameters, metricValues) {
  const canon = metricValueMap(metricValues);
  const values = {};
  for (const key of parameters) {
    const c = canonicalKey2(key);
    values[key] = canon.has(c) ? canon.get(c) : null;
  }
  return values;
}
function extractComputeSubScoresBlock(src) {
  const start = src.indexOf("def _compute_sub_scores");
  if (start === -1) return null;
  const after = src.slice(start);
  const endMatch = after.match(/\n\s*def\s+_compute_overall_score\s*\(/);
  if (!endMatch) return null;
  return after.slice(0, endMatch.index);
}
var analyzerDepsCache = /* @__PURE__ */ new Map();
function parseAnalyzerDependencies(configKey) {
  if (analyzerDepsCache.has(configKey)) return analyzerDepsCache.get(configKey) || null;
  const analyzerPath = path2.resolve(process.cwd(), "python_analysis", "sports", `${configKey.replace(/-/g, "_")}.py`);
  if (!fs2.existsSync(analyzerPath)) {
    analyzerDepsCache.set(configKey, null);
    return null;
  }
  const src = fs2.readFileSync(analyzerPath, "utf8");
  const fnBlock = extractComputeSubScoresBlock(src);
  if (!fnBlock) {
    analyzerDepsCache.set(configKey, null);
    return null;
  }
  const lines = fnBlock.split("\n");
  const helperExpr = /* @__PURE__ */ new Map();
  const varExpr = /* @__PURE__ */ new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const assign = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assign && !line.includes("int(np.clip(round(")) {
      helperExpr.set(assign[1], assign[2].trim().replace(/\s+/g, " "));
    }
    const startMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*int\(np\.clip\(round\(/);
    if (!startMatch) continue;
    const varName = startMatch[1];
    const chunk = [];
    for (let j = i; j < lines.length; j++) {
      chunk.push(lines[j]);
      if (lines[j].includes("), 0, 100))")) {
        i = j;
        break;
      }
    }
    const exprMatch = chunk.join("\n").match(/int\(np\.clip\(round\(([\s\S]*?)\),\s*0,\s*100\)\)/);
    if (exprMatch) {
      varExpr.set(varName, exprMatch[1].trim().replace(/\s+/g, " "));
    }
  }
  const rawKeyExpr = /* @__PURE__ */ new Map();
  const returnMatch = fnBlock.match(/return\s*\{([\s\S]*?)\n\s*\}/);
  if (returnMatch) {
    for (const m of returnMatch[1].matchAll(/"([^"]+)"\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
      const rawKey = m[1];
      const ref = m[2];
      const expr = varExpr.get(ref);
      if (expr) rawKeyExpr.set(rawKey, expr);
    }
  }
  const canonicalRawKeyToName = /* @__PURE__ */ new Map();
  for (const key of rawKeyExpr.keys()) {
    canonicalRawKeyToName.set(canonicalKey2(key), key);
  }
  const result = { rawKeyExpr, helperExpr, canonicalRawKeyToName };
  analyzerDepsCache.set(configKey, result);
  return result;
}
function extractMetricDepsFromExpr(expr, helperExpr, seen = /* @__PURE__ */ new Set()) {
  const deps = /* @__PURE__ */ new Set();
  for (const m of expr.matchAll(/m\["([^"]+)"\]/g)) {
    deps.add(m[1]);
  }
  const tokenRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const ignored = /* @__PURE__ */ new Set(["self", "m", "np", "round", "int", "float", "max", "min", "abs", "clamp"]);
  for (const t of expr.matchAll(tokenRegex)) {
    const token = t[1];
    if (ignored.has(token) || seen.has(token)) continue;
    const nested = helperExpr.get(token);
    if (!nested) continue;
    seen.add(token);
    for (const dep of extractMetricDepsFromExpr(nested, helperExpr, seen)) {
      deps.add(dep);
    }
  }
  return [...deps].sort((a, b) => a.localeCompare(b));
}
function tacticalMetricDependencies(configKey) {
  const parsed = parseAnalyzerDependencies(configKey);
  const out = {
    power: [],
    control: [],
    timing: [],
    technique: []
  };
  if (!parsed) return out;
  for (const tacticalKey of Object.keys(out)) {
    const aliases = TACTICAL_ALIAS_WEIGHTS[tacticalKey] || {};
    const deps = /* @__PURE__ */ new Set();
    for (const alias of Object.keys(aliases)) {
      const rawKeyName = parsed.canonicalRawKeyToName.get(alias);
      if (!rawKeyName) continue;
      const expr = parsed.rawKeyExpr.get(rawKeyName) || "";
      for (const dep of extractMetricDepsFromExpr(expr, parsed.helperExpr, /* @__PURE__ */ new Set())) {
        deps.add(dep);
      }
    }
    out[tacticalKey] = [...deps].sort((a, b) => a.localeCompare(b));
  }
  return out;
}
function toDetail(def, metricValues) {
  return {
    parameters: [...def.parameters],
    values: pickValues(def.parameters, metricValues)
  };
}
function buildScoreInputsPayload(configKey, metricValues) {
  const tacticalDeps = tacticalMetricDependencies(configKey);
  return {
    technical: Object.fromEntries(TECHNICAL_DEFS.map((def) => [def.name, toDetail(def, metricValues)])),
    movement: Object.fromEntries(MOVEMENT_DEFS.map((def) => [def.name, toDetail(def, metricValues)])),
    tactical: {
      power: {
        parameters: tacticalDeps.power,
        values: pickValues(tacticalDeps.power, metricValues)
      },
      control: {
        parameters: tacticalDeps.control,
        values: pickValues(tacticalDeps.control, metricValues)
      },
      timing: {
        parameters: tacticalDeps.timing,
        values: pickValues(tacticalDeps.timing, metricValues)
      },
      technique: {
        parameters: tacticalDeps.technique,
        values: pickValues(tacticalDeps.technique, metricValues)
      }
    },
    metadata: {
      configKey,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
}

// server/score-output-params.ts
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : void 0;
}
function norm(value, min, max) {
  if (value == null || max <= min) return null;
  return clamp2((value - min) / (max - min), 0, 1);
}
function invNorm(value, min, max) {
  const normalized = norm(value, min, max);
  if (normalized == null) return null;
  return 1 - normalized;
}
function score10(raw) {
  return Math.round(clamp2(raw, 1, 10));
}
function scoreFromUnit(unitScore) {
  if (unitScore == null || !Number.isFinite(unitScore)) return null;
  return score10(1 + unitScore * 9);
}
function weightedUnit(entries) {
  const valid = entries.filter(
    (entry) => entry.value != null && Number.isFinite(entry.value)
  );
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return null;
  const weighted = valid.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
  return weighted / totalWeight;
}
function pickMetric(metricValues, keys) {
  for (const key of keys) {
    const value = toNum(metricValues?.[key]);
    if (value != null) return value;
  }
  return void 0;
}
function asStroke(detectedMovement) {
  const detected = String(detectedMovement || "").toLowerCase().trim();
  if (detected === "backhand" || detected === "serve" || detected === "volley") return detected;
  return "forehand";
}
function canonicalKey3(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function readTacticalScore(values, key) {
  const target = canonicalKey3(key);
  for (const [k, v] of Object.entries(values || {})) {
    if (canonicalKey3(k) !== target) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return Number(Math.max(0, Math.min(10, n)).toFixed(2));
  }
  return null;
}
function average(values) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return null;
  return Number((validValues.reduce((sum, value) => sum + value, 0) / validValues.length).toFixed(1));
}
function computeTacticalScore(components) {
  const weightedKeys = [
    { key: "power", weight: 0.3 },
    { key: "control", weight: 0.25 },
    { key: "timing", weight: 0.25 },
    { key: "technique", weight: 0.2 }
  ];
  const contributors = weightedKeys.map((item) => {
    const value = Number(components[item.key]);
    if (!Number.isFinite(value)) return null;
    return { value, weight: item.weight };
  }).filter((item) => item !== null);
  if (!contributors.length) return null;
  const weightedSum = contributors.reduce((sum, item) => sum + item.value * item.weight, 0);
  const totalWeight = contributors.reduce((sum, item) => sum + item.weight, 0);
  return Number((weightedSum / Math.max(totalWeight, 1)).toFixed(1));
}
function computeTennisTechnicalAndMovement(detectedMovement, metricValues) {
  const stroke = asStroke(detectedMovement);
  const stanceAngle = pickMetric(metricValues, ["stanceAngle", "stance_angle"]);
  const hipRotationSpeed = pickMetric(metricValues, ["hipRotationSpeed", "hip_rotation_speed", "hipRotation"]);
  const shoulderRotationSpeed = pickMetric(metricValues, [
    "shoulderRotationSpeed",
    "shoulder_rotation_speed",
    "shoulderRotation"
  ]);
  const kneeBendAngle = pickMetric(metricValues, ["kneeBendAngle", "knee_bend_angle"]);
  const racketLagAngle = pickMetric(metricValues, ["racketLagAngle", "racket_lag_angle"]);
  const contactDistance = pickMetric(metricValues, ["contactDistance", "contact_distance"]);
  const contactHeight = pickMetric(metricValues, ["contactHeight", "contact_height"]);
  const swingPathAngle = pickMetric(metricValues, ["swingPathAngle", "swing_path_angle", "trajectoryArc"]);
  const balanceScore = pickMetric(metricValues, ["balanceScore", "balance_score"]);
  const splitStepTime = pickMetric(metricValues, ["splitStepTime", "splitStepTiming", "split_step_time"]);
  const reactionTime = pickMetric(metricValues, ["reactionTime", "reactionSpeed", "reaction_time"]);
  const recoveryTime = pickMetric(metricValues, ["recoveryTime", "recoverySpeed", "recovery_time"]);
  const ballSpeed = pickMetric(metricValues, ["ballSpeed", "avgBallSpeed", "ball_speed"]);
  const balance = scoreFromUnit(
    weightedUnit([
      { value: norm(balanceScore, 55, 98), weight: 0.8 },
      { value: invNorm(reactionTime, 180, 480), weight: 0.2 }
    ])
  );
  const inertia = scoreFromUnit(
    weightedUnit([
      { value: norm(stanceAngle, 15, 65), weight: 0.6 },
      { value: norm(shoulderRotationSpeed, 300, 1100), weight: 0.4 }
    ])
  );
  const momentum = scoreFromUnit(
    weightedUnit([
      { value: norm(hipRotationSpeed, 250, 1100), weight: 0.45 },
      { value: norm(shoulderRotationSpeed, 300, 1200), weight: 0.35 },
      { value: norm(ballSpeed, 35, 140), weight: 0.2 }
    ])
  );
  const oppositeForce = scoreFromUnit(
    weightedUnit([
      { value: norm(kneeBendAngle, 25, 120), weight: 0.4 },
      { value: norm(balanceScore, 55, 98), weight: 0.35 },
      { value: norm(stanceAngle, 15, 65), weight: 0.25 }
    ])
  );
  const elastic = scoreFromUnit(
    weightedUnit([
      { value: norm(racketLagAngle, 15, 75), weight: 0.7 },
      { value: norm(swingPathAngle, 5, 45), weight: 0.3 }
    ])
  );
  const contact = scoreFromUnit(
    weightedUnit([
      { value: norm(contactDistance, 0.35, 1.15), weight: 0.45 },
      { value: norm(contactHeight, 0.75, 2.9), weight: 0.35 },
      { value: invNorm(reactionTime, 180, 480), weight: 0.2 }
    ])
  );
  const ready = scoreFromUnit(
    weightedUnit([
      { value: invNorm(splitStepTime, 0.12, 0.45), weight: 0.6 },
      { value: norm(balanceScore, 55, 98), weight: 0.4 }
    ])
  );
  const read = scoreFromUnit(
    weightedUnit([
      { value: invNorm(reactionTime, 180, 480), weight: 0.55 },
      { value: invNorm(splitStepTime, 0.12, 0.45), weight: 0.45 }
    ])
  );
  const react = scoreFromUnit(
    weightedUnit([
      { value: invNorm(reactionTime, 170, 500), weight: 0.7 },
      { value: norm(balanceScore, 55, 98), weight: 0.3 }
    ])
  );
  const respondWeights = {
    forehand: [0.45, 0.3, 0.25],
    backhand: [0.45, 0.3, 0.25],
    serve: [0.45, 0.3, 0.25],
    volley: [0.45, 0.3, 0.25]
  };
  const [wBall, wHeight, wPath] = respondWeights[stroke];
  const respond = scoreFromUnit(
    weightedUnit([
      { value: norm(ballSpeed, 35, 140), weight: wBall },
      { value: norm(contactHeight, 0.75, 2.9), weight: wHeight },
      { value: norm(swingPathAngle, 8, 55), weight: wPath }
    ])
  );
  const recover = scoreFromUnit(
    weightedUnit([
      { value: invNorm(recoveryTime, 0.6, 3.2), weight: 0.65 },
      { value: norm(balanceScore, 55, 98), weight: 0.35 }
    ])
  );
  const technical = average([balance, inertia, oppositeForce, momentum, elastic, contact]);
  const movement = average([ready, read, react, respond, recover]);
  return {
    technicalOverall: technical,
    movementOverall: movement,
    technicalComponents: {
      balance,
      inertia,
      oppositeForce,
      momentum,
      elastic,
      contact
    },
    movementComponents: {
      ready,
      read,
      react,
      respond,
      recover
    }
  };
}
function buildScoreOutputsPayload(input) {
  const tacticalComponents = {
    power: readTacticalScore(input.tacticalComponents || {}, "power"),
    control: readTacticalScore(input.tacticalComponents || {}, "control"),
    timing: readTacticalScore(input.tacticalComponents || {}, "timing"),
    technique: readTacticalScore(input.tacticalComponents || {}, "technique")
  };
  const tactical = computeTacticalScore(tacticalComponents);
  let technicalOverall = null;
  let movementOverall = null;
  let technicalComponents = {
    balance: null,
    inertia: null,
    oppositeForce: null,
    momentum: null,
    elastic: null,
    contact: null
  };
  let movementComponents = {
    ready: null,
    read: null,
    react: null,
    respond: null,
    recover: null
  };
  if (String(input.configKey || "").toLowerCase().startsWith("tennis-")) {
    const computed = computeTennisTechnicalAndMovement(input.detectedMovement, input.metricValues || {});
    technicalOverall = computed.technicalOverall;
    movementOverall = computed.movementOverall;
    technicalComponents = computed.technicalComponents;
    movementComponents = computed.movementComponents;
  }
  return {
    technical: {
      overall: technicalOverall,
      components: technicalComponents
    },
    tactical: {
      overall: tactical,
      components: tacticalComponents
    },
    movement: {
      overall: movementOverall,
      components: movementComponents
    },
    overall: input.overallScore,
    metadata: {
      configKey: input.configKey,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      scale: "0-10"
    }
  };
}

// server/analysis-engine.ts
import fs3 from "fs";
import path3 from "path";
async function resolveLockedMovementForRepeatUpload(analysis) {
  if (!analysis.userId || !analysis.sportId) return null;
  const hashValue = String(analysis.videoContentHash || "").trim();
  if (hashValue) {
    const [priorByHash] = await db.select({ detectedMovement: analyses.detectedMovement }).from(analyses).where(
      and2(
        eq2(analyses.userId, analysis.userId),
        eq2(analyses.sportId, analysis.sportId),
        eq2(analyses.status, "completed"),
        ne(analyses.id, analysis.id),
        isNotNull(analyses.detectedMovement),
        eq2(analyses.videoContentHash, hashValue)
      )
    ).orderBy(desc2(analyses.createdAt)).limit(1);
    const movementByHash = String(priorByHash?.detectedMovement || "").trim();
    if (movementByHash.length > 0) {
      return movementByHash;
    }
  }
  const filenameCandidates = [analysis.sourceFilename, analysis.videoFilename].map((value) => String(value || "").trim()).filter((value) => value.length > 0);
  if (!filenameCandidates.length) return null;
  const filenamePredicates = filenameCandidates.map(
    (candidate) => or(eq2(analyses.videoFilename, candidate), eq2(analyses.sourceFilename, candidate))
  );
  const [prior] = await db.select({ detectedMovement: analyses.detectedMovement }).from(analyses).where(
    and2(
      eq2(analyses.userId, analysis.userId),
      eq2(analyses.sportId, analysis.sportId),
      eq2(analyses.status, "completed"),
      ne(analyses.id, analysis.id),
      isNotNull(analyses.detectedMovement),
      filenamePredicates.length === 1 ? filenamePredicates[0] : or(...filenamePredicates)
    )
  ).orderBy(desc2(analyses.createdAt)).limit(1);
  const lockedMovement = String(prior?.detectedMovement || "").trim();
  return lockedMovement.length > 0 ? lockedMovement : null;
}
async function computeVideoContentHash(videoPath) {
  if (!videoPath || !fs3.existsSync(videoPath)) return null;
  const hash = createHash2("sha256");
  return await new Promise((resolve2, reject) => {
    const stream = fs3.createReadStream(videoPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", (error) => reject(error));
    stream.on("end", () => resolve2(hash.digest("hex")));
  });
}
async function findReusableAnalysisPayload(analysis, activeModelVersion) {
  const hashValue = String(analysis.videoContentHash || "").trim();
  if (!analysis.userId || !analysis.sportId) return null;
  const filenameCandidates = [analysis.sourceFilename, analysis.videoFilename].map((value) => String(value || "").trim()).filter((value) => value.length > 0);
  const filenamePredicates = filenameCandidates.map(
    (candidate) => or(eq2(analyses.videoFilename, candidate), eq2(analyses.sourceFilename, candidate))
  );
  const duplicateMatchers = [];
  if (hashValue) {
    duplicateMatchers.push(eq2(analyses.videoContentHash, hashValue));
  }
  if (filenamePredicates.length === 1) {
    duplicateMatchers.push(filenamePredicates[0]);
  } else if (filenamePredicates.length > 1) {
    duplicateMatchers.push(or(...filenamePredicates));
  }
  if (!duplicateMatchers.length) return null;
  const conditions = [
    eq2(analyses.userId, analysis.userId),
    eq2(analyses.sportId, analysis.sportId),
    eq2(analyses.status, "completed"),
    ne(analyses.id, analysis.id),
    duplicateMatchers.length === 1 ? duplicateMatchers[0] : or(...duplicateMatchers)
  ];
  if (analysis.movementId) {
    conditions.push(eq2(analyses.movementId, analysis.movementId));
  }
  const [row] = await db.select({
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
    simpleExplanation: coachingInsights.simpleExplanation
  }).from(analyses).leftJoin(metrics, eq2(metrics.analysisId, analyses.id)).leftJoin(coachingInsights, eq2(coachingInsights.analysisId, analyses.id)).where(and2(...conditions)).orderBy(desc2(analyses.createdAt)).limit(1);
  if (!row) return null;
  if (!row.configKey || !row.modelVersion || row.modelVersion !== activeModelVersion) return null;
  if (row.overallScore == null || !row.metricValues) return null;
  if (!row.keyStrength || !row.improvementArea || !row.trainingSuggestion || !row.simpleExplanation) return null;
  return {
    detectedMovement: row.detectedMovement,
    configKey: row.configKey,
    modelVersion: row.modelVersion,
    overallScore: Number(row.overallScore),
    metricValues: row.metricValues,
    scoreInputs: row.scoreInputs || null,
    scoreOutputs: row.scoreOutputs || null,
    aiDiagnostics: row.aiDiagnostics || null,
    coaching: {
      keyStrength: row.keyStrength,
      improvementArea: row.improvementArea,
      trainingSuggestion: row.trainingSuggestion,
      simpleExplanation: row.simpleExplanation
    }
  };
}
function canonicalKey4(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function shouldDropPersistedMetricKey(key) {
  const c = canonicalKey4(key);
  return c === "follow" || c === "followthrough" || c === "followthroughquality" || c === "followthroughscore" || c === "stability" || c === "stabilityscore";
}
function sanitizePersistedMap(values) {
  const out = {};
  for (const [key, raw] of Object.entries(values || {})) {
    if (shouldDropPersistedMetricKey(key)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out[key] = value;
  }
  return out;
}
var REQUIRED_METRIC_KEYS = [
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
  "wristSpeed"
];
var REQUIRED_UPLOAD_DIAGNOSTIC_METRIC_KEYS = [
  "contactDistance",
  "kneeBendAngle",
  "racketLagAngle",
  "recoveryTime",
  "splitStepTime",
  "stanceAngle"
];
var REQUIRED_METRIC_ALIASES = {
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
  wristSpeed: ["wristSpeed"]
};
function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
var PERCENT_LIKE_METRIC_KEYS = /* @__PURE__ */ new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency"
]);
function round1(value) {
  return Number(value.toFixed(1));
}
function normalizeMetricScaleForPersistence(metricKey, value) {
  if (!Number.isFinite(value)) return value;
  if (!PERCENT_LIKE_METRIC_KEYS.has(metricKey)) return round1(value);
  const scaled = value > 10 ? value / 10 : value;
  return round1(Math.max(0, Math.min(10, scaled)));
}
function readDiagnosticsComputedMetric(diagnostics, metricKey) {
  if (!diagnostics || typeof diagnostics !== "object") return null;
  const computed = diagnostics.computedMetrics;
  if (!computed || typeof computed !== "object") return null;
  const value = computed[metricKey];
  return toFiniteNumber(value);
}
function normalizeMetricValuesForPersistence(rawMetricValues, diagnostics) {
  const out = {};
  for (const [key, raw] of Object.entries(rawMetricValues || {})) {
    const value = toFiniteNumber(raw);
    if (value == null) continue;
    out[key] = value;
  }
  const diagnosticsToCanonical = [
    { diagnosticsKey: "hipRotation", metricKey: "hipRotationSpeed" },
    { diagnosticsKey: "reactionTime", metricKey: "reactionTime" },
    { diagnosticsKey: "contactDistance", metricKey: "contactDistance" },
    { diagnosticsKey: "kneeBendAngle", metricKey: "kneeBendAngle" },
    { diagnosticsKey: "racketLagAngle", metricKey: "racketLagAngle" },
    { diagnosticsKey: "recoveryTime", metricKey: "recoveryTime" },
    { diagnosticsKey: "splitStepTime", metricKey: "splitStepTime" },
    { diagnosticsKey: "stanceAngle", metricKey: "stanceAngle" }
  ];
  for (const { diagnosticsKey, metricKey } of diagnosticsToCanonical) {
    const value = readDiagnosticsComputedMetric(diagnostics, diagnosticsKey);
    if (value != null && !Number.isFinite(Number(out[metricKey]))) {
      out[metricKey] = value;
    }
  }
  const byCanonical = /* @__PURE__ */ new Map();
  for (const [key, value] of Object.entries(out)) {
    byCanonical.set(canonicalKey4(key), value);
  }
  for (const targetKey of REQUIRED_METRIC_KEYS) {
    if (Number.isFinite(Number(out[targetKey]))) continue;
    const aliases = REQUIRED_METRIC_ALIASES[targetKey] || [targetKey];
    for (const alias of aliases) {
      const candidate = byCanonical.get(canonicalKey4(alias));
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
function hasAllRequiredUploadDiagnosticsMetrics(metricValues) {
  for (const key of REQUIRED_UPLOAD_DIAGNOSTIC_METRIC_KEYS) {
    if (!Number.isFinite(Number(metricValues[key]))) {
      return false;
    }
  }
  return true;
}
function resolvePythonExecutable() {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs3.existsSync(envExecutable)) {
    return envExecutable;
  }
  const localCandidates = [
    path3.resolve(process.cwd(), ".venv", "bin", "python3"),
    path3.resolve(process.cwd(), ".venv", "bin", "python")
  ];
  for (const candidate of localCandidates) {
    if (fs3.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python3";
}
function runPythonAnalysis(videoPath, sportName, movementName, dominantProfile) {
  return new Promise((resolve2, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    const args = [
      "-m",
      "python_analysis.run_analysis",
      videoPath,
      "--sport",
      sportName.toLowerCase(),
      "--movement",
      movementName.toLowerCase().replace(/\s+/g, "-")
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
        timeout: 12e4,
        maxBuffer: 10 * 1024 * 1024
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
            resolve2(result);
            return;
          }
          resolve2(result);
        } catch (parseError) {
          console.error("Failed to parse Python output:", stdout);
          if (stderr) console.error("Python stderr:", stderr);
          reject(new Error("Failed to parse analysis results"));
        }
      }
    );
  });
}
function runPythonDiagnostics(videoPath, sportName, movementName, dominantProfile) {
  return new Promise((resolve2, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    const args = [
      "-m",
      "python_analysis.run_diagnostics",
      videoPath,
      "--sport",
      sportName.toLowerCase(),
      "--movement",
      movementName.toLowerCase().replace(/\s+/g, "-")
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
        timeout: 12e4,
        maxBuffer: 10 * 1024 * 1024
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
          resolve2(result);
        } catch {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error("Failed to parse diagnostics results"));
        }
      }
    );
  });
}
async function processAnalysis(analysisId) {
  try {
    await db.update(analyses).set({ status: "processing", rejectionReason: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(analyses.id, analysisId));
    const [analysis] = await db.select().from(analyses).where(eq2(analyses.id, analysisId));
    if (!analysis) {
      throw new Error("Analysis not found");
    }
    let sportName = "tennis";
    let movementName = "auto-detect";
    if (analysis.movementId) {
      const [movement] = await db.select().from(sportMovements).where(eq2(sportMovements.id, analysis.movementId));
      if (movement) {
        movementName = movement.name;
      }
    }
    if (analysis.sportId) {
      const [sport] = await db.select().from(sports).where(eq2(sports.id, analysis.sportId));
      if (sport) {
        sportName = sport.name;
      }
    }
    const videoContentHash = await computeVideoContentHash(analysis.videoPath);
    if (videoContentHash) {
      await db.update(analyses).set({ videoContentHash, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(analyses.id, analysis.id));
      analysis.videoContentHash = videoContentHash;
    }
    let dominantProfile = null;
    if (analysis.userId) {
      const [profile] = await db.select({ dominantProfile: users.dominantProfile }).from(users).where(eq2(users.id, analysis.userId)).limit(1);
      dominantProfile = profile?.dominantProfile ?? null;
    }
    const modelRegistryConfig = readModelRegistryConfig();
    const reusablePayload = await findReusableAnalysisPayload(
      analysis,
      modelRegistryConfig.activeModelVersion
    );
    if (reusablePayload) {
      let normalizedReusableMetrics = normalizeMetricValuesForPersistence(
        reusablePayload.metricValues || {},
        reusablePayload.aiDiagnostics
      );
      let reusableDiagnosticsPayload = reusablePayload.aiDiagnostics;
      if (!hasAllRequiredUploadDiagnosticsMetrics(normalizedReusableMetrics)) {
        try {
          const diagnosticsMovement = reusablePayload.detectedMovement || movementName;
          reusableDiagnosticsPayload = await runPythonDiagnostics(
            analysis.videoPath,
            sportName,
            diagnosticsMovement,
            dominantProfile
          );
          normalizedReusableMetrics = normalizeMetricValuesForPersistence(
            normalizedReusableMetrics,
            reusableDiagnosticsPayload
          );
        } catch (diagnosticsError) {
          console.warn(
            `Diagnostics backfill failed for reused analysis ${analysisId}: ${diagnosticsError?.message || diagnosticsError}`
          );
        }
      }
      const sanitizedMetricValues = sanitizePersistedMap(normalizedReusableMetrics);
      const reusableScoreInputs = buildScoreInputsPayload(
        reusablePayload.configKey,
        sanitizedMetricValues
      );
      const reusableTacticalComponents = extractStandardizedTacticalScores10(
        sanitizePersistedMap(
          reusablePayload.scoreOutputs?.tactical?.components || reusablePayload.scoreOutputs?.tacticalComponents || {}
        )
      );
      const reusableScoreOutputs = buildScoreOutputsPayload({
        configKey: reusablePayload.configKey,
        detectedMovement: reusablePayload.detectedMovement,
        tacticalComponents: reusableTacticalComponents,
        metricValues: sanitizedMetricValues,
        overallScore: reusablePayload.overallScore
      });
      await db.transaction(async (tx) => {
        await tx.delete(coachingInsights).where(eq2(coachingInsights.analysisId, analysisId));
        await tx.delete(metrics).where(eq2(metrics.analysisId, analysisId));
        await tx.insert(metrics).values({
          analysisId,
          configKey: reusablePayload.configKey,
          modelVersion: reusablePayload.modelVersion,
          overallScore: reusablePayload.overallScore,
          metricValues: sanitizedMetricValues,
          scoreInputs: reusableScoreInputs,
          scoreOutputs: reusableScoreOutputs,
          aiDiagnostics: reusableDiagnosticsPayload
        });
        await tx.insert(coachingInsights).values({
          analysisId,
          ...reusablePayload.coaching
        });
      });
      await db.update(analyses).set({
        status: "completed",
        detectedMovement: reusablePayload.detectedMovement || movementName,
        rejectionReason: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(analyses.id, analysisId));
      console.log(`Analysis ${analysisId} reused scores from prior identical video hash`);
      return;
    }
    if (String(movementName || "").toLowerCase() === "auto-detect") {
      const lockedMovement = await resolveLockedMovementForRepeatUpload(analysis);
      if (lockedMovement) {
        console.log(
          `Deterministic movement lock for repeated upload: using prior detected movement "${lockedMovement}" instead of auto-detect`
        );
        movementName = lockedMovement;
      }
    }
    const configKey = getConfigKey(sportName, movementName);
    console.log(
      `Starting Python analysis for: ${analysis.videoPath} (${sportName}/${movementName}, config: ${configKey})`
    );
    const result = await runPythonAnalysis(
      analysis.videoPath,
      sportName,
      movementName,
      dominantProfile
    );
    if (result.rejected) {
      console.log(
        `Analysis ${analysisId} rejected: ${result.rejectionReason}`
      );
      await db.update(analyses).set({
        status: "rejected",
        rejectionReason: result.rejectionReason || "Video content does not match the selected sport.",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(analyses.id, analysisId));
      return;
    }
    const actualMovement = result.detectedMovement || movementName;
    const wasOverridden = result.movementOverridden || false;
    if (wasOverridden) {
      console.log(
        `Movement override: user selected "${movementName}" but detected "${actualMovement}". Score: ${result.overallScore}`
      );
    } else {
      console.log(
        `Python analysis complete. Overall score: ${result.overallScore}`
      );
    }
    const runtimeOverallScore100 = normalizeRuntimeScoreToHundred(result.overallScore);
    if (runtimeOverallScore100 != null && runtimeOverallScore100 < 15) {
      const sportLabel = sportName.charAt(0).toUpperCase() + sportName.slice(1);
      console.log(
        `Analysis ${analysisId} auto-rejected: score ${runtimeOverallScore100} below minimum threshold`
      );
      await db.update(analyses).set({
        status: "rejected",
        rejectionReason: `The video content could not be reliably analyzed as a ${sportLabel} movement. Please upload a clearer video of your ${sportLabel} technique.`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(analyses.id, analysisId));
      return;
    }
    let diagnosticsPayload = null;
    try {
      diagnosticsPayload = await runPythonDiagnostics(
        analysis.videoPath,
        sportName,
        actualMovement,
        dominantProfile
      );
    } catch (diagnosticsError) {
      console.warn(
        `Diagnostics generation failed for analysis ${analysisId}: ${diagnosticsError?.message || diagnosticsError}`
      );
    }
    const metricValuesRaw = { ...result.metricValues };
    if (result.shotCount != null) {
      metricValuesRaw.shotCount = result.shotCount;
    }
    if (result.shotSpeed != null && Number.isFinite(result.shotSpeed)) {
      metricValuesRaw.shotSpeed = result.shotSpeed;
    }
    const normalizedMetricValues = normalizeMetricValuesForPersistence(
      metricValuesRaw,
      diagnosticsPayload
    );
    const resolvedConfigKey = result.configKey || configKey;
    const metricValues = sanitizePersistedMap(normalizedMetricValues);
    const persistedTacticalScores = extractStandardizedTacticalScores10(
      sanitizePersistedMap(result.subScores || {})
    );
    const persistedOverallScore = toPersistedScoreTen(result.overallScore);
    const scoreInputs = buildScoreInputsPayload(resolvedConfigKey, metricValues);
    const scoreOutputs = buildScoreOutputsPayload({
      configKey: resolvedConfigKey,
      detectedMovement: actualMovement,
      tacticalComponents: persistedTacticalScores,
      metricValues,
      overallScore: persistedOverallScore
    });
    await db.transaction(async (tx) => {
      await tx.delete(coachingInsights).where(eq2(coachingInsights.analysisId, analysisId));
      await tx.delete(metrics).where(eq2(metrics.analysisId, analysisId));
      await tx.insert(metrics).values({
        analysisId,
        configKey: resolvedConfigKey,
        modelVersion: modelRegistryConfig.activeModelVersion,
        overallScore: persistedOverallScore,
        metricValues,
        scoreInputs,
        scoreOutputs,
        aiDiagnostics: diagnosticsPayload
      });
      await tx.insert(coachingInsights).values({
        analysisId,
        ...result.coaching
      });
    });
    await db.update(analyses).set({
      status: "completed",
      detectedMovement: actualMovement,
      rejectionReason: null,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(analyses.id, analysisId));
    console.log(`Analysis ${analysisId} completed successfully`);
  } catch (error) {
    console.error("Analysis processing error:", error);
    await db.update(analyses).set({ status: "failed", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(analyses.id, analysisId));
  }
}

// server/auth.ts
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import multer from "multer";
import path4 from "path";
import fs4 from "fs";
import { eq as eq3, or as or2, sql as sql3 } from "drizzle-orm";
function sanitizeUser(user) {
  const selectedScoreSectionsBySport = user.selectedScoreSectionsBySport && typeof user.selectedScoreSectionsBySport === "object" ? user.selectedScoreSectionsBySport : {};
  const selectedMetricKeysBySport = user.selectedMetricKeysBySport && typeof user.selectedMetricKeysBySport === "object" ? user.selectedMetricKeysBySport : {};
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    address: user.address,
    country: user.country,
    dominantProfile: user.dominantProfile,
    selectedScoreSections: Array.isArray(user.selectedScoreSections) ? user.selectedScoreSections : [],
    selectedMetricKeys: Array.isArray(user.selectedMetricKeys) ? user.selectedMetricKeys : [],
    selectedScoreSectionsBySport,
    selectedMetricKeysBySport,
    sportsInterests: user.sportsInterests,
    bio: user.bio,
    role: user.role
  };
}
var avatarDir = path4.resolve(process.cwd(), "uploads", "avatars");
if (!fs4.existsSync(avatarDir)) {
  fs4.mkdirSync(avatarDir, { recursive: true });
}
var avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path4.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, HEIC) are allowed"));
    }
  }
});
var PgSession = connectPgSimple(session);
async function setupAuth(app2) {
  await db.execute(
    sql3`alter table users add column if not exists dominant_profile text`
  );
  await db.execute(
    sql3`alter table users add column if not exists selected_score_sections jsonb default '[]'::jsonb`
  );
  await db.execute(
    sql3`alter table users add column if not exists selected_metric_keys jsonb default '[]'::jsonb`
  );
  await db.execute(
    sql3`alter table users add column if not exists selected_score_sections_by_sport jsonb default '{}'::jsonb`
  );
  await db.execute(
    sql3`alter table users add column if not exists selected_metric_keys_by_sport jsonb default '{}'::jsonb`
  );
  app2.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || "swingai-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1e3,
        httpOnly: true,
        secure: false,
        sameSite: "lax"
      }
    })
  );
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { email, name, password } = parsed.data;
      const [existing] = await db.select().from(users).where(eq3(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const [user] = await db.insert(users).values({
        email: email.toLowerCase(),
        name,
        passwordHash
      }).returning();
      req.session.userId = user.id;
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });
  app2.post("/api/admin/players", requireAuth, async (req, res) => {
    try {
      const [requester] = await db.select().from(users).where(eq3(users.id, req.session.userId));
      if (!requester || requester.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { email, name, password } = parsed.data;
      const [existing] = await db.select().from(users).where(eq3(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const [createdPlayer] = await db.insert(users).values({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: "player",
        country: requester.country || null
      }).returning();
      res.status(201).json(sanitizeUser(createdPlayer));
    } catch (error) {
      console.error("Create player error:", error);
      res.status(500).json({ error: "Failed to create player" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse({
        identifier: req.body?.identifier ?? req.body?.email,
        password: req.body?.password
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { identifier, password } = parsed.data;
      const normalizedIdentifier = String(identifier).trim();
      const normalizedEmail = normalizedIdentifier.toLowerCase();
      const [user] = await db.select().from(users).where(
        or2(
          eq3(users.id, normalizedIdentifier),
          eq3(users.email, normalizedEmail)
        )
      );
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
  app2.get("/api/auth/google/mobile-callback", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signing in...</title>
<style>body{background:#0A0A1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.loader{text-align:center}.spinner{width:40px;height:40px;border:3px solid #333;border-top:3px solid #6C5CE7;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="loader"><div class="spinner"></div><p>Completing sign in...</p></div>
<script>
(function(){
  var h=window.location.hash.substring(1);
  if(!h){document.querySelector('p').textContent='Sign in failed. Please try again.';return;}
  var p=new URLSearchParams(h);
  var t=p.get('access_token');
  if(t){window.location.href='swingai://google-auth?access_token='+encodeURIComponent(t);}
  else{document.querySelector('p').textContent='Sign in failed. No token received.';}
})();
</script></body></html>`);
  });
  app2.post("/api/auth/google", async (req, res) => {
    try {
      const { idToken, accessToken } = req.body;
      if (!idToken && !accessToken) {
        return res.status(400).json({ error: "Google token required" });
      }
      let googleUser = null;
      if (idToken) {
        const verifyRes = await globalThis.fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );
        if (!verifyRes.ok) {
          return res.status(401).json({ error: "Invalid Google token" });
        }
        const payload = await verifyRes.json();
        googleUser = {
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          picture: payload.picture
        };
      } else if (accessToken) {
        const userInfoRes = await globalThis.fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!userInfoRes.ok) {
          return res.status(401).json({ error: "Invalid Google token" });
        }
        const payload = await userInfoRes.json();
        googleUser = {
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          picture: payload.picture
        };
      }
      if (!googleUser || !googleUser.email) {
        return res.status(401).json({ error: "Could not verify Google account" });
      }
      const [existing] = await db.select().from(users).where(eq3(users.email, googleUser.email.toLowerCase()));
      if (existing) {
        req.session.userId = existing.id;
        const updates = {};
        if (googleUser.picture && !existing.avatarUrl) {
          updates.avatarUrl = googleUser.picture;
        }
        if (Object.keys(updates).length > 0) {
          const [updated] = await db.update(users).set(updates).where(eq3(users.id, existing.id)).returning();
          return res.json(sanitizeUser(updated));
        }
        return res.json(sanitizeUser(existing));
      }
      const randomPassword = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      const [newUser] = await db.insert(users).values({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        passwordHash,
        avatarUrl: googleUser.picture || null,
        country: "Singapore"
      }).returning();
      req.session.userId = newUser.id;
      res.json(sanitizeUser(newUser));
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ error: "Google authentication failed" });
    }
  });
  app2.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const [user] = await db.select().from(users).where(eq3(users.id, req.session.userId));
      if (!user) {
        req.session.destroy(() => {
        });
        return res.status(401).json({ error: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  app2.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq3(users.id, req.session.userId));
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });
  app2.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const {
        name,
        phone,
        address,
        country,
        dominantProfile,
        selectedScoreSections,
        selectedMetricKeys,
        selectedSportKey,
        sportsInterests,
        bio,
        role
      } = req.body;
      const requesterId = req.session.userId;
      const [requester] = await db.select().from(users).where(eq3(users.id, requesterId));
      if (!requester) {
        return res.status(401).json({ error: "User not found" });
      }
      if (name !== void 0 && (!name || typeof name !== "string" || !name.trim())) {
        return res.status(400).json({ error: "Name is required" });
      }
      const updates = {};
      if (name !== void 0) updates.name = name.trim();
      if (phone !== void 0) updates.phone = phone?.trim() || null;
      if (address !== void 0) updates.address = address?.trim() || null;
      if (country !== void 0) updates.country = country?.trim() || null;
      if (dominantProfile !== void 0) {
        const value = String(dominantProfile || "").trim().toLowerCase();
        if (!value) {
          updates.dominantProfile = null;
        } else if (value === "right" || value === "left") {
          updates.dominantProfile = value;
        } else {
          return res.status(400).json({ error: "dominantProfile must be Right or Left" });
        }
      }
      if (sportsInterests !== void 0) updates.sportsInterests = sportsInterests?.trim() || null;
      if (bio !== void 0) updates.bio = bio?.trim() || null;
      if (selectedScoreSections !== void 0) {
        if (!Array.isArray(selectedScoreSections) || !selectedScoreSections.every((v) => typeof v === "string")) {
          return res.status(400).json({ error: "selectedScoreSections must be an array of strings" });
        }
      }
      if (selectedMetricKeys !== void 0) {
        if (!Array.isArray(selectedMetricKeys) || !selectedMetricKeys.every((v) => typeof v === "string")) {
          return res.status(400).json({ error: "selectedMetricKeys must be an array of strings" });
        }
      }
      const normalizedSportKey = String(selectedSportKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (selectedScoreSections !== void 0 || selectedMetricKeys !== void 0) {
        if (normalizedSportKey) {
          const existingScoreBySport = requester.selectedScoreSectionsBySport && typeof requester.selectedScoreSectionsBySport === "object" ? { ...requester.selectedScoreSectionsBySport } : {};
          const existingMetricBySport = requester.selectedMetricKeysBySport && typeof requester.selectedMetricKeysBySport === "object" ? { ...requester.selectedMetricKeysBySport } : {};
          if (selectedScoreSections !== void 0) {
            existingScoreBySport[normalizedSportKey] = selectedScoreSections;
          }
          if (selectedMetricKeys !== void 0) {
            existingMetricBySport[normalizedSportKey] = selectedMetricKeys;
          }
          updates.selectedScoreSectionsBySport = existingScoreBySport;
          updates.selectedMetricKeysBySport = existingMetricBySport;
        } else {
          if (selectedScoreSections !== void 0) {
            updates.selectedScoreSections = selectedScoreSections;
          }
          if (selectedMetricKeys !== void 0) {
            updates.selectedMetricKeys = selectedMetricKeys;
          }
        }
      }
      if (role !== void 0) {
        if (!(role === "player" || role === "admin")) {
          return res.status(400).json({ error: "role must be player or admin" });
        }
        updates.role = role;
      }
      const [updated] = await db.update(users).set(updates).where(eq3(users.id, requesterId)).returning();
      res.json(sanitizeUser(updated));
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  app2.post(
    "/api/profile/avatar",
    requireAuth,
    (req, res, next) => {
      avatarUpload.single("avatar")(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File too large. Maximum 5MB." });
          }
          return res.status(400).json({ error: err.message || "Invalid file upload" });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image provided" });
        }
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const [updated] = await db.update(users).set({ avatarUrl }).where(eq3(users.id, req.session.userId)).returning();
        res.json(sanitizeUser(updated));
      } catch (error) {
        res.status(500).json({ error: "Failed to upload avatar" });
      }
    }
  );
}
function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

// server/routes.ts
import { eq as eq4, asc, and as and3, desc as desc3, inArray, sql as sql4 } from "drizzle-orm";
var uploadDir = path5.resolve(process.cwd(), "uploads");
if (!fs5.existsSync(uploadDir)) {
  fs5.mkdirSync(uploadDir, { recursive: true });
}
var upload = multer2({
  storage: multer2.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path5.extname(file.originalname) || ".mp4";
      cb(null, `${randomUUID2().toUpperCase()}${ext}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  }
});
function resolvePythonExecutable2() {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs5.existsSync(envExecutable)) {
    return envExecutable;
  }
  const localCandidates = [
    path5.resolve(process.cwd(), ".venv", "bin", "python3"),
    path5.resolve(process.cwd(), ".venv", "bin", "python")
  ];
  for (const candidate of localCandidates) {
    if (fs5.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python3";
}
function runPythonDiagnostics2(videoPath, sportName, movementName, dominantProfile) {
  return new Promise((resolve2, reject) => {
    const pythonExecutable = resolvePythonExecutable2();
    const args = [
      "-m",
      "python_analysis.run_diagnostics",
      videoPath,
      "--sport",
      sportName.toLowerCase(),
      "--movement",
      movementName.toLowerCase().replace(/\s+/g, "-")
    ];
    const dominant = String(dominantProfile || "").trim().toLowerCase();
    if (dominant === "right" || dominant === "left") {
      args.push("--dominant-profile", dominant);
    }
    execFile2(
      pythonExecutable,
      args,
      {
        cwd: process.cwd(),
        timeout: 12e4,
        maxBuffer: 10 * 1024 * 1024
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
          resolve2(result);
        } catch {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error("Failed to parse diagnostics results"));
        }
      }
    );
  });
}
async function resolveUserDominantProfile(userId) {
  if (!userId) return null;
  const [profile] = await db.select({ dominantProfile: users.dominantProfile }).from(users).where(eq4(users.id, userId)).limit(1);
  return profile?.dominantProfile ?? null;
}
function parseNumberValue(value) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
function parseFpsValue(value) {
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
function getTagValue(tags, keys) {
  const lowered = /* @__PURE__ */ new Map();
  for (const [k, v] of Object.entries(tags || {})) {
    lowered.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    const hit = lowered.get(key.toLowerCase());
    if (hit != null && String(hit).trim() !== "") return hit;
  }
  return null;
}
function parseSignedCoordinate(value, positiveSuffix, negativeSuffix) {
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
function parseIso6709Location(value) {
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
    alt: alt != null && Number.isFinite(alt) ? alt : null
  };
}
async function extractVideoMetadata(videoPath) {
  return new Promise((resolve2) => {
    execFile2(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        videoPath
      ],
      {
        timeout: 2e4,
        maxBuffer: 5 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) {
          resolve2({});
          return;
        }
        try {
          const parsed = JSON.parse(stdout || "{}");
          const format = parsed?.format || {};
          const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
          const videoStream = streams.find((stream) => stream?.codec_type === "video") || streams[0] || {};
          const formatTags = format?.tags || {};
          const streamTags = videoStream?.tags || {};
          const mergedTags = {
            ...formatTags,
            ...streamTags
          };
          const capturedAt = parseDateValue(
            getTagValue(mergedTags, ["creation_time", "com.apple.quicktime.creationdate"])
          );
          const sourceAppRaw = getTagValue(mergedTags, [
            "com.apple.quicktime.software",
            "software",
            "encoder"
          ]);
          const durationSec = parseNumberValue(format?.duration ?? videoStream?.duration);
          const fps = parseFpsValue(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate);
          const width = parseNumberValue(videoStream?.width);
          const height = parseNumberValue(videoStream?.height);
          const rotationFromTag = parseNumberValue(getTagValue(streamTags, ["rotate"]));
          const rotationFromSideData = parseNumberValue(
            Array.isArray(videoStream?.side_data_list) ? videoStream.side_data_list.find((entry) => entry?.rotation != null)?.rotation : null
          );
          const rotation = rotationFromTag ?? rotationFromSideData;
          const bitrateKbpsRaw = parseNumberValue(format?.bit_rate ?? videoStream?.bit_rate);
          const bitrateKbps = bitrateKbpsRaw != null ? Number((bitrateKbpsRaw / 1e3).toFixed(2)) : null;
          const fileSizeBytes = parseNumberValue(format?.size);
          const containerFormat = format?.format_name ? String(format.format_name) : null;
          const videoCodec = videoStream?.codec_name ? String(videoStream.codec_name) : null;
          let gpsLat = null;
          let gpsLng = null;
          let gpsAltM = null;
          let gpsSource = null;
          const isoLocation = getTagValue(mergedTags, [
            "com.apple.quicktime.location.ISO6709",
            "location"
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
              "S"
            );
            const lng = parseSignedCoordinate(
              getTagValue(mergedTags, ["GPSLongitude", "longitude"]),
              "E",
              "W"
            );
            if (lat != null && lng != null) {
              gpsLat = lat;
              gpsLng = lng;
              gpsAltM = parseNumberValue(getTagValue(mergedTags, ["GPSAltitude", "altitude"]));
              gpsSource = "exif";
            }
          }
          const gpsSpeedMps = parseNumberValue(
            getTagValue(mergedTags, ["GPSSpeed", "com.apple.quicktime.location.speed"])
          );
          const gpsHeadingDeg = parseNumberValue(
            getTagValue(mergedTags, ["GPSImgDirection", "com.apple.quicktime.location.course"])
          );
          const gpsAccuracyM = parseNumberValue(
            getTagValue(mergedTags, ["GPSHPositioningError", "com.apple.quicktime.location.accuracy.horizontal"])
          );
          const gpsTimestamp = parseDateValue(
            getTagValue(mergedTags, ["GPSDateTime", "gps_datetime"])
          );
          resolve2({
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
            gpsSource
          });
        } catch {
          resolve2({});
        }
      }
    );
  });
}
function normalizeShotLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-").replace(/-+/g, "-");
}
function normalizeMovementToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function normalizeFilterToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-").replace(/-+/g, "-");
}
function readSubScoreValue(scoreOutputs, key) {
  if (!scoreOutputs || typeof scoreOutputs !== "object") return null;
  return readTacticalScoreValue(scoreOutputs, key);
}
function normalizeScoreRow(row) {
  const source = row.scoreOutputs && typeof row.scoreOutputs === "object" ? row.scoreOutputs : null;
  return {
    ...row,
    overallScore: persistedScoreToApiHundred(row.overallScore),
    subScores: normalizeTacticalScoresToApi100(
      source
    )
  };
}
function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function round12(value) {
  return Number(value.toFixed(1));
}
var SCALE10_METRIC_KEYS = /* @__PURE__ */ new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency"
]);
function normalizeMetricValuesForApi(metricValuesRaw) {
  const source = metricValuesRaw && typeof metricValuesRaw === "object" ? metricValuesRaw : {};
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const normalized = SCALE10_METRIC_KEYS.has(key) && value > 10 ? value / 10 : value;
    out[key] = round12(normalized);
  }
  return out;
}
function formatMetricName(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
function getMovementLabel(row) {
  if (row.detectedMovement) return String(row.detectedMovement);
  const configKey = String(row.configKey || "").trim();
  if (!configKey) return "general";
  const parts = configKey.split("-").filter(Boolean);
  if (parts.length <= 1) return "general";
  return parts.slice(1).join("-");
}
function getDrillForMetric(metric) {
  if (metric === "timing") return "3 x 15 contact-point timing reps";
  if (metric === "control") return "4 x 30s split-step + recovery";
  if (metric === "technique") return "3 x 12 movement-shape checkpoints";
  return "3 x 12 explosive shadow swings";
}
function improvedClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function improvedNorm(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || max <= min) return 0.55;
  return improvedClamp((n - min) / (max - min), 0, 1);
}
function improvedInvNorm(value, min, max) {
  return 1 - improvedNorm(value, min, max);
}
function improvedScore10(raw) {
  return Math.round(improvedClamp(raw, 1, 10));
}
function improvedScoreFromUnit(unitScore) {
  return improvedScore10(1 + unitScore * 9);
}
function improvedPickMetric(metricValues, keys) {
  for (const key of keys) {
    const value = Number(metricValues?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}
function normalizeBalanceScoreForImprovedModel(value) {
  if (!Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return n <= 10 ? n * 10 : n;
}
function buildImprovedTennisReportFromMetrics(detectedMovement, metricValuesRaw) {
  const metricValues = metricValuesRaw && typeof metricValuesRaw === "object" ? metricValuesRaw : {};
  const detected = String(detectedMovement || "").toLowerCase().trim();
  const stroke = detected === "backhand" || detected === "serve" || detected === "volley" ? detected : "forehand";
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
    0.8 * improvedNorm(balanceScoreForModel, 55, 98) + 0.2 * improvedInvNorm(reactionTime, 180, 480)
  );
  const inertia = improvedScoreFromUnit(
    0.6 * improvedNorm(stanceAngle, 15, 65) + 0.4 * improvedNorm(shoulderRotationSpeed, 300, 1100)
  );
  const momentum = improvedScoreFromUnit(
    0.45 * improvedNorm(hipRotationSpeed, 250, 1100) + 0.35 * improvedNorm(shoulderRotationSpeed, 300, 1200) + 0.2 * improvedNorm(ballSpeed, 35, 140)
  );
  const oppositeForce = improvedScoreFromUnit(
    0.4 * improvedNorm(kneeBendAngle, 25, 120) + 0.35 * improvedNorm(balanceScoreForModel, 55, 98) + 0.25 * improvedNorm(stanceAngle, 15, 65)
  );
  const elastic = improvedScoreFromUnit(
    0.6 * improvedNorm(racketLagAngle, 15, 75) + 0.2 * improvedNorm(kneeBendAngle, 25, 120) + 0.2 * improvedNorm(swingPathAngle, 5, 45)
  );
  const contact = improvedScoreFromUnit(
    0.45 * improvedNorm(contactDistance, 0.35, 1.15) + 0.35 * improvedNorm(contactHeight, 0.75, 2.9) + 0.2 * improvedInvNorm(reactionTime, 180, 480)
  );
  const follow = improvedScoreFromUnit(
    0.6 * improvedNorm(swingPathAngle, 8, 55) + 0.4 * improvedNorm(shoulderRotationSpeed, 300, 1200)
  );
  const ready = improvedScoreFromUnit(
    0.6 * improvedInvNorm(splitStepTime, 0.12, 0.45) + 0.4 * improvedNorm(balanceScoreForModel, 55, 98)
  );
  const read = improvedScoreFromUnit(
    0.55 * improvedInvNorm(reactionTime, 180, 480) + 0.45 * improvedInvNorm(splitStepTime, 0.12, 0.45)
  );
  const react = improvedScoreFromUnit(
    0.7 * improvedInvNorm(reactionTime, 170, 500) + 0.3 * improvedNorm(balanceScoreForModel, 55, 98)
  );
  const respond = improvedScoreFromUnit(
    0.45 * improvedNorm(ballSpeed, 35, 140) + 0.3 * improvedNorm(contactHeight, 0.75, 2.9) + 0.25 * improvedNorm(swingPathAngle, 8, 55)
  );
  const recover = improvedScoreFromUnit(
    0.65 * improvedInvNorm(recoveryTime, 0.6, 3.2) + 0.35 * improvedNorm(balanceScore, 55, 98)
  );
  const biomechanics = [
    {
      key: "balance",
      label: "Balance",
      score: balance,
      explanation: balance >= 8 ? "Stable base before, through, and after contact with minimal sway." : balance >= 6 ? "Base is mostly stable; occasional drift appears under speed." : "Base stability drops through contact; posture control should improve."
    },
    {
      key: "inertia",
      label: "Inertia / Stance Alignment",
      score: inertia,
      explanation: inertia >= 8 ? "Stance and trunk alignment match shot direction well." : inertia >= 6 ? "Stance shape is usable but alignment timing is occasionally late." : "Stance alignment is inconsistent and limits clean energy direction."
    },
    {
      key: "oppositeForce",
      label: "Opposite Force",
      score: oppositeForce,
      explanation: oppositeForce >= 8 ? "Bracing and ground-force transfer are strong, supporting stable acceleration." : oppositeForce >= 6 ? "Force transfer is usable but can improve with stronger bracing and leg drive." : "Insufficient bracing and push-off reduce stable power transfer."
    },
    {
      key: "momentum",
      label: "Momentum (Kinetic Chain)",
      score: momentum,
      explanation: momentum >= 8 ? "Good legs-to-racket sequencing transfers energy efficiently." : momentum >= 6 ? "Partial kinetic chain use; more lower-body drive would help." : "Energy transfer is arm-dominant and misses lower-body contribution."
    },
    {
      key: "elastic",
      label: "Elastic Energy",
      score: elastic,
      explanation: elastic >= 8 ? "Racket lag and stretch-shortening are creating strong acceleration." : elastic >= 6 ? "Elastic load is present but could be timed and released better." : "Limited lag/load reduces free racket-head speed."
    },
    {
      key: "contact",
      label: "Contact",
      score: contact,
      explanation: stroke === "serve" ? "Contact height supports serve geometry; timing consistency remains critical." : stroke === "volley" ? "Contact in front supports compact volley control." : "Contact distance from the body supports cleaner strike mechanics."
    },
    {
      key: "follow",
      label: "Follow Through",
      score: follow,
      explanation: follow >= 8 ? "Finish path is complete and supports control plus spin/drive intent." : follow >= 6 ? "Follow-through is mostly complete with minor deceleration." : "Finish path cuts off early and limits control/consistency."
    }
  ];
  const movement = [
    {
      key: "ready",
      label: "Ready",
      score: ready,
      explanation: ready >= 8 ? "Split-step timing, knee flex, and base setup prepare efficient lower-body movement." : ready >= 6 ? "Lower-body prep is usable, but earlier split-step and stronger base loading are needed." : "Late split-step and shallow leg load reduce first-move quickness."
    },
    {
      key: "read",
      label: "Read",
      score: read,
      explanation: read >= 8 ? "Early read supports efficient footwork choices and balanced body positioning." : read >= 6 ? "Read timing is acceptable, but feet can organize earlier into a stronger base." : "Late read forces rushed footwork and unstable lower-body positioning."
    },
    {
      key: "react",
      label: "React",
      score: react,
      explanation: react >= 8 ? "First step is explosive with clean lower-body direction control." : react >= 6 ? "Initial push-off is functional but needs sharper leg drive under pressure." : "Slow or misdirected first step limits movement efficiency."
    },
    {
      key: "respond",
      label: "Respond",
      score: respond,
      explanation: stroke === "serve" ? "Serve response reflects knee-drive timing, vertical push, and stable landing footwork." : stroke === "backhand" ? "Backhand response depends on base width, outside-leg drive, and balanced transfer through contact." : stroke === "volley" ? "Volley response relies on quick split-step, short adjustment steps, and body control through contact." : "Forehand response is driven by leg load, push-off timing, and clean foot positioning."
    },
    {
      key: "recover",
      label: "Recover",
      score: recover,
      explanation: recover >= 8 ? "Recovery steps are quick and balanced, restoring a strong lower-body base." : recover >= 6 ? "Recovery is serviceable but needs faster feet to re-center and reload." : "Slow recovery footwork delays re-centering and next-shot readiness."
    }
  ];
  const bioAvg = biomechanics.reduce((sum, item) => sum + item.score, 0) / Math.max(biomechanics.length, 1);
  const movAvg = movement.reduce((sum, item) => sum + item.score, 0) / Math.max(movement.length, 1);
  const overallScore = Math.round(improvedClamp((bioAvg * 0.6 + movAvg * 0.4) * 10, 0, 100));
  const strongest = [...biomechanics, ...movement].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakest = [...biomechanics, ...movement].sort((a, b) => a.score - b.score).slice(0, 3);
  const coachingTips = [
    `${weakest[0]?.label || "Ready"}: prioritize this phase with focused, short-interval drills.`,
    `${weakest[1]?.label || "Contact"}: reinforce this mechanic in slow-to-fast progression reps.`,
    stroke === "forehand" ? "Load on the outside leg earlier, then rotate hips before arm acceleration." : stroke === "backhand" ? "Initiate with shoulder turn and stabilize contact height through spacing." : stroke === "serve" ? "Increase knee load depth, then push up before full shoulder acceleration." : "Shorten backswing and keep contact in front for controlled volleys."
  ];
  return {
    stroke,
    biomechanics,
    movement,
    strengths: strongest.map((item) => `${item.label} is a strength (${item.score}/10).`),
    improvementAreas: weakest.map((item) => `${item.label} needs improvement (${item.score}/10).`),
    coachingTips,
    overallScore
  };
}
function computeSummarySectionScores(row) {
  const storedScoreOutputs = row.scoreOutputs && typeof row.scoreOutputs === "object" ? row.scoreOutputs : null;
  const parseStored = (key) => {
    const section = storedScoreOutputs?.[key];
    const value = Number(
      section && typeof section === "object" ? section.overall : section
    );
    return Number.isFinite(value) ? value : null;
  };
  return {
    technical: parseStored("technical"),
    tactical: parseStored("tactical"),
    movement: parseStored("movement")
  };
}
var MODEL_EVALUATION_MODE_KEY = "modelEvaluationMode";
function getModelEvaluationModeKey(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return MODEL_EVALUATION_MODE_KEY;
  return `${MODEL_EVALUATION_MODE_KEY}:${uid}`;
}
function applyDbRangesToConfig(config, rows) {
  const byMetricKey = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byMetricKey.set(String(row.metricKey || ""), row);
  }
  const metricsByKey = /* @__PURE__ */ new Map();
  for (const metric of config.metrics || []) {
    const withoutRange = {
      ...metric,
      optimalRange: void 0
    };
    metricsByKey.set(metric.key, withoutRange);
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
        optimalRange: [Number(row.optimalMin), Number(row.optimalMax)]
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
      optimalRange: [Number(row.optimalMin), Number(row.optimalMax)]
    });
  }
  const metrics2 = Array.from(metricsByKey.values()).map((metric) => {
    const row = byMetricKey.get(metric.key);
    if (!row) return metric;
    return {
      ...metric,
      label: row.metricLabel || metric.label,
      unit: row.unit || metric.unit,
      optimalRange: [Number(row.optimalMin), Number(row.optimalMax)]
    };
  });
  return {
    ...config,
    metrics: metrics2
  };
}
async function fetchMetricRangeRows(filters = {}) {
  const conditions = [];
  if (filters.configKey) {
    conditions.push(eq4(sportCategoryMetricRanges.configKey, String(filters.configKey).trim()));
  }
  if (filters.metricKey) {
    conditions.push(eq4(sportCategoryMetricRanges.metricKey, String(filters.metricKey).trim()));
  }
  if (filters.sportName) {
    conditions.push(
      sql4`lower(${sportCategoryMetricRanges.sportName}) = ${String(filters.sportName).trim().toLowerCase()}`
    );
  }
  if (filters.movementName) {
    conditions.push(
      sql4`lower(${sportCategoryMetricRanges.movementName}) = ${String(filters.movementName).trim().toLowerCase()}`
    );
  }
  if (!filters.includeInactive) {
    conditions.push(eq4(sportCategoryMetricRanges.isActive, true));
  }
  const rows = await db.select().from(sportCategoryMetricRanges).where(conditions.length ? and3(...conditions) : void 0).orderBy(
    asc(sportCategoryMetricRanges.configKey),
    asc(sportCategoryMetricRanges.metricKey)
  );
  return rows;
}
async function getModelEvaluationMode(userId) {
  const scopedKey = getModelEvaluationModeKey(userId);
  const [scopedSetting] = await db.select().from(appSettings).where(eq4(appSettings.key, scopedKey)).limit(1);
  if (scopedSetting?.value && typeof scopedSetting.value === "object") {
    return Boolean(scopedSetting.value.enabled);
  }
  const [legacySetting] = await db.select().from(appSettings).where(eq4(appSettings.key, MODEL_EVALUATION_MODE_KEY)).limit(1);
  if (!legacySetting?.value || typeof legacySetting.value !== "object") return false;
  return Boolean(legacySetting.value.enabled);
}
async function setModelEvaluationMode(enabled, userId) {
  await db.insert(appSettings).values({
    key: getModelEvaluationModeKey(userId),
    value: { enabled }
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: { enabled },
      updatedAt: /* @__PURE__ */ new Date()
    }
  });
}
function getEvaluationMatch(analysis, map) {
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
    videoFilename ? `model_evaluation_datasets/dataset/${videoFilename}` : ""
  ].filter(Boolean);
  for (const key of keys) {
    const match = map.get(key);
    if (match) return match;
  }
  return void 0;
}
async function buildScoringModelDashboard(userId, isAdmin, movementFilterRaw, playerFilterRaw) {
  const modelConfig = readModelRegistryConfig();
  const movementFilter = normalizeMovementToken(movementFilterRaw || "");
  const playerFilter = String(playerFilterRaw || "").trim();
  const applyPlayerFilter = isAdmin && playerFilter && playerFilter.toLowerCase() !== "all";
  const datasetVideoMap = getEvaluationDatasetVideoMap(modelConfig);
  const allDatasets = readEvaluationDatasetManifest(modelConfig).datasets.map((dataset) => dataset.name);
  const discrepancyRows = isAdmin ? await db.select({
    discrepancy: analysisShotDiscrepancies,
    analysis: analyses
  }).from(analysisShotDiscrepancies).innerJoin(analyses, eq4(analysisShotDiscrepancies.analysisId, analyses.id)).where(eq4(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion)) : await db.select({
    discrepancy: analysisShotDiscrepancies,
    analysis: analyses
  }).from(analysisShotDiscrepancies).innerJoin(analyses, eq4(analysisShotDiscrepancies.analysisId, analyses.id)).where(
    and3(
      eq4(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion),
      eq4(analysisShotDiscrepancies.userId, userId)
    )
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
  const datasetAccumulator = /* @__PURE__ */ new Map();
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
        movementMatches: 0
      });
    }
    const acc = datasetAccumulator.get(datasetName);
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
  const scoringAccuracyPct = totalManualShots ? Number((100 - totalMismatches / Math.max(totalManualShots, 1) * 100).toFixed(1)) : 0;
  const movementDetectionAccuracyPct = movementTotal ? Number((movementMatches / movementTotal * 100).toFixed(1)) : 0;
  const datasetMetrics = Array.from(datasetAccumulator.entries()).map(
    ([datasetName, acc]) => ({
      datasetName,
      movementType: acc.movementType,
      movementDetectionAccuracyPct: acc.movementTotal ? Number((acc.movementMatches / acc.movementTotal * 100).toFixed(1)) : 0,
      scoringAccuracyPct: acc.scoringManualShots ? Number((100 - acc.scoringMismatches / Math.max(acc.scoringManualShots, 1) * 100).toFixed(1)) : 0
    })
  );
  return {
    modelVersion: modelConfig.activeModelVersion,
    modelVersionDescription: modelConfig.modelVersionChangeDescription,
    movementType: movementFilterRaw || "all",
    movementDetectionAccuracyPct,
    scoringAccuracyPct,
    totalVideosConsidered: movementTotal,
    datasetsUsed: datasetMetrics.length > 0 ? datasetMetrics.map((item) => item.datasetName) : allDatasets,
    datasetMetrics
  };
}
function readShotCountFromMetricValues(metricValues) {
  if (!metricValues || typeof metricValues !== "object") return 0;
  const raw = metricValues.shotCount;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}
function computeDiscrepancySnapshot(autoLabels, manualLabels) {
  const alignedCount = Math.min(autoLabels.length, manualLabels.length);
  let labelMismatches = 0;
  const confusionMap = /* @__PURE__ */ new Map();
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
  const mismatchRatePct = Number((mismatches / denominator * 100).toFixed(1));
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
    confusionPairs
  };
}
async function resolveAutoLabelsForAnalysis(analysis, sportName, movementName, manualLabels, dominantProfile) {
  let autoLabels = [];
  if (analysis.videoPath && fs5.existsSync(analysis.videoPath)) {
    try {
      const diagnostics = await runPythonDiagnostics2(
        analysis.videoPath,
        sportName,
        movementName,
        dominantProfile
      );
      autoLabels = (diagnostics?.shotSegments || []).map(
        (segment) => normalizeShotLabel(segment?.label)
      );
    } catch {
      autoLabels = [];
    }
  }
  if (autoLabels.length === 0 && manualLabels.length > 0) {
    const fallbackLabel = normalizeShotLabel(
      analysis.detectedMovement || movementName || "unknown"
    );
    autoLabels = Array.from({ length: manualLabels.length }, () => fallbackLabel);
  }
  return autoLabels;
}
async function resolveSportAndMovementNames(analysis) {
  let sportName = "Tennis";
  let movementName = "auto-detect";
  if (analysis.sportId) {
    const [sport] = await db.select().from(sports).where(eq4(sports.id, analysis.sportId));
    if (sport?.name) {
      sportName = sport.name;
    }
  }
  if (analysis.movementId) {
    const [movement] = await db.select().from(sportMovements).where(eq4(sportMovements.id, analysis.movementId));
    if (movement?.name) {
      movementName = movement.name;
    }
  }
  return { sportName, movementName };
}
async function refreshDiscrepancySnapshotsForAnalysis(analysisId) {
  const modelConfig = readModelRegistryConfig();
  const [analysis] = await db.select().from(analyses).where(eq4(analyses.id, analysisId)).limit(1);
  if (!analysis) {
    return { refreshed: 0, skipped: 1 };
  }
  const annotations = await db.select().from(analysisShotAnnotations).where(eq4(analysisShotAnnotations.analysisId, analysisId));
  if (annotations.length === 0) {
    return { refreshed: 0, skipped: 0 };
  }
  const { sportName, movementName } = await resolveSportAndMovementNames(analysis);
  const dominantProfile = await resolveUserDominantProfile(analysis.userId);
  let refreshed = 0;
  let skipped = 0;
  for (const annotation of annotations) {
    const manualLabels = (annotation.orderedShotLabels || []).map(
      (label) => normalizeShotLabel(label)
    );
    try {
      const autoLabels = await resolveAutoLabelsForAnalysis(
        analysis,
        sportName,
        movementName,
        manualLabels,
        dominantProfile
      );
      const snapshot = computeDiscrepancySnapshot(autoLabels, manualLabels);
      await db.insert(analysisShotDiscrepancies).values({
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
        confusionPairs: snapshot.confusionPairs
      }).onConflictDoUpdate({
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
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
      refreshed += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`Discrepancy refresh failed for analysis ${analysisId}, user ${annotation.userId}:`, error);
    }
  }
  return { refreshed, skipped };
}
async function registerRoutes(app2) {
  await db.execute(sql4`alter table users add column if not exists dominant_profile text`);
  await db.execute(sql4`alter table metrics add column if not exists score_inputs jsonb`);
  await db.execute(sql4`alter table metrics add column if not exists score_outputs jsonb`);
  await db.execute(sql4`alter table metrics add column if not exists ai_diagnostics jsonb`);
  await db.execute(sql4`alter table metrics drop column if exists tactical_scores`);
  await db.execute(sql4`alter table metrics drop column if exists sub_scores`);
  await db.execute(sql4`
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
    )
  `);
  await db.execute(sql4`
    create unique index if not exists analysis_shot_annotations_analysis_user_uq
    on analysis_shot_annotations (analysis_id, user_id)
  `);
  await db.execute(sql4`
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
      updated_at timestamp not null default now()
    )
  `);
  await db.execute(sql4`
    create unique index if not exists analysis_shot_discrepancies_analysis_user_uq
    on analysis_shot_discrepancies (analysis_id, user_id)
  `);
  await db.execute(sql4`
    create table if not exists app_settings (
      key varchar primary key,
      value jsonb not null,
      updated_at timestamp not null default now()
    )
  `);
  await db.execute(sql4`
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
      created_at timestamp not null default now()
    )
  `);
  await db.execute(sql4`
    create table if not exists scoring_model_registry_dataset_metrics (
      id varchar primary key default gen_random_uuid(),
      registry_entry_id varchar not null references scoring_model_registry_entries(id),
      dataset_name text not null,
      movement_type text not null,
      movement_detection_accuracy_pct real not null,
      scoring_accuracy_pct real not null
    )
  `);
  await db.execute(sql4`
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
      updated_at timestamp not null default now()
    )
  `);
  await db.execute(sql4`
    create unique index if not exists sport_category_metric_ranges_config_metric_uq
    on sport_category_metric_ranges (config_key, metric_key)
  `);
  await db.execute(sql4`
    create index if not exists sport_category_metric_ranges_sport_movement_idx
    on sport_category_metric_ranges (sport_name, movement_name, is_active)
  `);
  await db.execute(sql4`alter table metrics add column if not exists model_version varchar not null default '0.1'`);
  await db.execute(sql4`alter table analysis_shot_discrepancies add column if not exists model_version varchar not null default '0.1'`);
  await db.execute(sql4`alter table scoring_model_registry_entries add column if not exists manifest_model_version varchar not null default '0.1'`);
  await db.execute(sql4`alter table scoring_model_registry_entries add column if not exists manifest_datasets jsonb not null default '[]'::jsonb`);
  await db.execute(sql4`alter table analyses add column if not exists captured_at timestamp`);
  await db.execute(sql4`alter table analyses add column if not exists source_filename text`);
  await db.execute(sql4`alter table analyses add column if not exists evaluation_video_id text`);
  await db.execute(sql4`alter table analyses add column if not exists source_app text`);
  await db.execute(sql4`alter table analyses add column if not exists video_duration_sec real`);
  await db.execute(sql4`alter table analyses add column if not exists video_fps real`);
  await db.execute(sql4`alter table analyses add column if not exists video_width real`);
  await db.execute(sql4`alter table analyses add column if not exists video_height real`);
  await db.execute(sql4`alter table analyses add column if not exists video_rotation real`);
  await db.execute(sql4`alter table analyses add column if not exists video_codec text`);
  await db.execute(sql4`alter table analyses add column if not exists video_content_hash text`);
  await db.execute(sql4`alter table analyses add column if not exists video_bitrate_kbps real`);
  await db.execute(sql4`alter table analyses add column if not exists file_size_bytes real`);
  await db.execute(sql4`alter table analyses add column if not exists container_format text`);
  await db.execute(sql4`alter table analyses add column if not exists gps_lat real`);
  await db.execute(sql4`alter table analyses add column if not exists gps_lng real`);
  await db.execute(sql4`alter table analyses add column if not exists gps_alt_m real`);
  await db.execute(sql4`alter table analyses add column if not exists gps_speed_mps real`);
  await db.execute(sql4`alter table analyses add column if not exists gps_heading_deg real`);
  await db.execute(sql4`alter table analyses add column if not exists gps_accuracy_m real`);
  await db.execute(sql4`alter table analyses add column if not exists gps_timestamp timestamp`);
  await db.execute(sql4`alter table analyses add column if not exists gps_source text`);
  const parseIntegerList = (value) => {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const item of value) {
      const n = Number(item);
      if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
        result.push(n);
      }
    }
    return result;
  };
  const markStaleProcessingAsFailed = async (userId) => {
    if (userId) {
      await db.execute(sql4`
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
    await db.execute(sql4`
      update analyses
      set status = 'failed',
          rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
          updated_at = now()
      where status = 'processing'
        and updated_at < now() - interval '10 minutes'
    `);
  };
  app2.get("/api/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/model-evaluation/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
        totalVideos
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/model-registry/config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const config = readModelRegistryConfig();
      const manifestValidation = validateEvaluationDatasetManifest(config);
      res.json({ ...config, manifestValidation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/model-registry/config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
        evaluationDatasetManifestPath
      });
      const manifestValidation = validateEvaluationDatasetManifest(next);
      res.json({ ...next, manifestValidation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/model-registry/validate-manifest", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const config = readModelRegistryConfig();
      const validation = validateEvaluationDatasetManifest(config);
      res.json({
        config,
        validation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/model-evaluation/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const enabled = Boolean(req.body?.enabled);
      await setModelEvaluationMode(enabled, userId);
      res.json({ enabled });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/scoring-model/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const dashboard = await buildScoringModelDashboard(
        userId,
        isAdmin,
        String(req.query.movementName || ""),
        String(req.query.playerId || "")
      );
      res.json({
        ...dashboard,
        modelEvaluationMode: await getModelEvaluationMode(userId)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/scoring-model/registry/save", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
        String(req.body?.playerId || req.query.playerId || "")
      );
      const configBeforeSave = readModelRegistryConfig();
      const manifestBeforeSave = readEvaluationDatasetManifest(configBeforeSave);
      const manifestModelVersion = String(
        manifestBeforeSave.activeModelVersion || configBeforeSave.activeModelVersion || dashboard.modelVersion
      ).trim();
      const [entry] = await db.insert(scoringModelRegistryEntries).values({
        modelVersion: dashboard.modelVersion,
        modelVersionDescription: dashboard.modelVersionDescription,
        movementType: dashboard.movementType,
        movementDetectionAccuracyPct: dashboard.movementDetectionAccuracyPct,
        scoringAccuracyPct: dashboard.scoringAccuracyPct,
        datasetsUsed: dashboard.datasetsUsed,
        manifestModelVersion,
        manifestDatasets: manifestBeforeSave.datasets,
        createdByUserId: userId
      }).returning();
      if (dashboard.datasetMetrics.length > 0) {
        await db.insert(scoringModelRegistryDatasetMetrics).values(
          dashboard.datasetMetrics.map((metric) => ({
            registryEntryId: entry.id,
            datasetName: metric.datasetName,
            movementType: metric.movementType,
            movementDetectionAccuracyPct: metric.movementDetectionAccuracyPct,
            scoringAccuracyPct: metric.scoringAccuracyPct
          }))
        );
      }
      const nextModelVersion = incrementModelVersion(dashboard.modelVersion);
      const nextConfig = writeModelRegistryConfig({
        ...configBeforeSave,
        activeModelVersion: nextModelVersion
      });
      updateManifestActiveModelVersion(nextModelVersion, nextConfig);
      res.json({ id: entry.id, saved: true, nextModelVersion });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/scoring-model/registry", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const entries = await db.select().from(scoringModelRegistryEntries).orderBy(desc3(scoringModelRegistryEntries.createdAt)).limit(100);
      const entryIds = entries.map((entry) => entry.id);
      const datasetMetrics = entryIds.length ? await db.select().from(scoringModelRegistryDatasetMetrics).where(inArray(scoringModelRegistryDatasetMetrics.registryEntryId, entryIds)) : [];
      const metricsByEntry = /* @__PURE__ */ new Map();
      for (const metric of datasetMetrics) {
        const current = metricsByEntry.get(metric.registryEntryId) || [];
        current.push(metric);
        metricsByEntry.set(metric.registryEntryId, current);
      }
      const analysisRows = await db.select({
        analysis: analyses
      }).from(analyses).orderBy(desc3(analyses.createdAt));
      const normalizeFilenameToken = (value) => {
        return path5.basename(String(value || "").trim()).toLowerCase();
      };
      const selectedAnalysisIdsByEntry = /* @__PURE__ */ new Map();
      const allSelectedAnalysisIds = /* @__PURE__ */ new Set();
      for (const entry of entries) {
        const manifestDatasets = Array.isArray(entry.manifestDatasets) ? entry.manifestDatasets : [];
        const manifestVideos = manifestDatasets.flatMap((dataset) => {
          const videos = Array.isArray(dataset?.videos) ? dataset.videos : [];
          return videos.map((video) => ({
            videoId: String(video?.videoId || "").trim(),
            filename: String(video?.filename || "").trim()
          }));
        });
        const selectedIds = /* @__PURE__ */ new Set();
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
            return !!manifestFilenameBase && (sourceFilenameBase === manifestFilenameBase || videoFilenameBase === manifestFilenameBase);
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
      const selectedDiscrepancySnapshots = allSelectedAnalysisIds.size ? await db.select().from(analysisShotDiscrepancies).where(inArray(analysisShotDiscrepancies.analysisId, Array.from(allSelectedAnalysisIds))) : [];
      const historyByAnalysisId = /* @__PURE__ */ new Map();
      for (const snapshot of selectedDiscrepancySnapshots) {
        const list = historyByAnalysisId.get(snapshot.analysisId) || [];
        list.push(snapshot);
        historyByAnalysisId.set(snapshot.analysisId, list);
      }
      for (const [analysisId, list] of historyByAnalysisId.entries()) {
        historyByAnalysisId.set(
          analysisId,
          [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
      }
      const modelVersions = Array.from(
        new Set(entries.map((entry) => String(entry.modelVersion || "").trim()).filter(Boolean))
      );
      const versionDiscrepancySnapshots = modelVersions.length ? await db.select().from(analysisShotDiscrepancies).where(inArray(analysisShotDiscrepancies.modelVersion, modelVersions)) : [];
      const mismatchByVersion = /* @__PURE__ */ new Map();
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
              (snapshot2) => String(snapshot2.modelVersion || "").trim() === targetVersion
            );
            const snapshot = targetSnapshot || history[0];
            manifestManualShots += Number(snapshot.manualShots || 0);
            manifestMismatches += Number(snapshot.mismatches || 0);
          }
          const manifestMismatchRatePct = manifestManualShots > 0 ? Number((manifestMismatches / manifestManualShots * 100).toFixed(1)) : null;
          const versionWide = mismatchByVersion.get(targetVersion);
          const versionMismatchRatePct = versionWide && versionWide.manualShots > 0 ? Number((versionWide.mismatches / versionWide.manualShots * 100).toFixed(1)) : null;
          const fallbackMismatchRatePct = Number(
            (100 - Number(entry.scoringAccuracyPct || 0)).toFixed(1)
          );
          const mismatchRatePct = manifestMismatchRatePct ?? versionMismatchRatePct ?? fallbackMismatchRatePct;
          return {
            ...entry,
            mismatchRatePct: Math.max(0, Math.min(100, mismatchRatePct)),
            datasetMetrics: metricsByEntry.get(entry.id) || []
          };
        })
      );
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/scoring-model/registry/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const [entry] = await db.select().from(scoringModelRegistryEntries).where(eq4(scoringModelRegistryEntries.id, req.params.id)).limit(1);
      if (!entry) {
        return res.status(404).json({ error: "Registry entry not found" });
      }
      const datasetMetrics = await db.select().from(scoringModelRegistryDatasetMetrics).where(eq4(scoringModelRegistryDatasetMetrics.registryEntryId, entry.id));
      const manifestDatasets = Array.isArray(entry.manifestDatasets) ? entry.manifestDatasets : [];
      const manifestVideos = manifestDatasets.flatMap((dataset) => {
        const datasetName = String(dataset?.name || "").trim();
        const videos = Array.isArray(dataset?.videos) ? dataset.videos : [];
        return videos.map((video) => ({
          datasetName,
          videoId: String(video?.videoId || "").trim(),
          filename: String(video?.filename || "").trim(),
          movementType: String(video?.movementType || "").trim()
        }));
      });
      const analysisRows = await db.select({
        analysis: analyses,
        userName: users.name
      }).from(analyses).leftJoin(users, eq4(analyses.userId, users.id)).orderBy(desc3(analyses.createdAt));
      const normalizeFilenameToken = (value) => {
        return path5.basename(String(value || "").trim()).toLowerCase();
      };
      const selectedByAnalysisId = /* @__PURE__ */ new Map();
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
          return !!manifestFilenameBase && (sourceFilenameBase === manifestFilenameBase || videoFilenameBase === manifestFilenameBase);
        });
        if (!match) continue;
        if (!selectedByAnalysisId.has(match.analysis.id)) {
          selectedByAnalysisId.set(match.analysis.id, {
            analysis: match.analysis,
            userName: match.userName || null,
            movementType: manifestVideo.movementType
          });
        }
      }
      const selectedRows = [...selectedByAnalysisId.values()];
      const selectedAnalysisIds = selectedRows.map((row) => row.analysis.id);
      const discrepancyRows = selectedAnalysisIds.length ? await db.select().from(analysisShotDiscrepancies).where(inArray(analysisShotDiscrepancies.analysisId, selectedAnalysisIds)) : [];
      const discrepancyHistoryByAnalysisId = /* @__PURE__ */ new Map();
      for (const snapshot of discrepancyRows) {
        const list = discrepancyHistoryByAnalysisId.get(snapshot.analysisId) || [];
        list.push(snapshot);
        discrepancyHistoryByAnalysisId.set(snapshot.analysisId, list);
      }
      for (const [analysisId, list] of discrepancyHistoryByAnalysisId.entries()) {
        discrepancyHistoryByAnalysisId.set(
          analysisId,
          [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
      }
      const snapshotsByAnalysisId = /* @__PURE__ */ new Map();
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
          discrepancy: snapshotsByAnalysisId.get(row.analysis.id) || null
        };
      });
      if (filteredRows.length === 0) {
        const fallbackRows = await db.select({
          discrepancy: analysisShotDiscrepancies,
          analysis: analyses,
          userName: users.name
        }).from(analysisShotDiscrepancies).innerJoin(analyses, eq4(analysisShotDiscrepancies.analysisId, analyses.id)).leftJoin(users, eq4(analyses.userId, users.id)).where(eq4(analysisShotDiscrepancies.modelVersion, entry.modelVersion)).orderBy(
          desc3(analysisShotDiscrepancies.mismatchRatePct),
          desc3(analysisShotDiscrepancies.mismatches),
          desc3(analysisShotDiscrepancies.updatedAt)
        );
        filteredRows = fallbackRows.map((row) => ({
          analysis: row.analysis,
          userName: row.userName || null,
          movementType: row.discrepancy.movementName,
          discrepancy: row.discrepancy
        }));
      }
      const confusionMap = /* @__PURE__ */ new Map();
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
        const confusionPairs = Array.isArray(row.discrepancy?.confusionPairs) ? row.discrepancy?.confusionPairs : [];
        for (const pair of confusionPairs) {
          const from = normalizeShotLabel(pair.from || "unknown");
          const to = normalizeShotLabel(pair.to || "unknown");
          const key = `${from}=>${to}`;
          confusionMap.set(key, (confusionMap.get(key) || 0) + Number(pair.count || 0));
        }
        const createdAt = row.analysis.capturedAt || row.analysis.createdAt;
        const snapshotHistory = discrepancyHistoryByAnalysisId.get(row.analysis.id) || [];
        const currentModelVersion = String(row.discrepancy?.modelVersion || "").trim();
        const previousSnapshot = snapshotHistory.find(
          (snapshot) => String(snapshot.modelVersion || "").trim() !== currentModelVersion
        );
        const currentMismatchRatePct = Number(row.discrepancy?.mismatchRatePct || 0);
        const previousMismatchRatePct = Number(previousSnapshot?.mismatchRatePct || 0);
        const mismatchDeltaPct = previousSnapshot ? Number((currentMismatchRatePct - previousMismatchRatePct).toFixed(1)) : 0;
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
          isNewVideo
        };
      });
      const labelConfusions = Array.from(confusionMap.entries()).map(([pair, count]) => {
        const [from, to] = pair.split("=>");
        return { from, to, count };
      }).sort((a, b) => b.count - a.count).slice(0, 8);
      const mismatchRatePct = Number(
        (totalMismatches / Math.max(totalManualShots, 1) * 100).toFixed(1)
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
          mismatchRatePct
        },
        topVideos,
        labelConfusions
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sports", async (_req, res) => {
    try {
      const allSports = await db.select().from(sports).orderBy(asc(sports.sortOrder));
      res.json(allSports);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sports/:sportId/movements", async (req, res) => {
    try {
      const movements = await db.select().from(sportMovements).where(eq4(sportMovements.sportId, req.params.sportId)).orderBy(asc(sportMovements.sortOrder));
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sport-configs", async (_req, res) => {
    try {
      const allConfigs = getAllConfigs();
      const rangeRows = await fetchMetricRangeRows();
      const rangeRowsByConfig = /* @__PURE__ */ new Map();
      for (const row of rangeRows) {
        const list = rangeRowsByConfig.get(row.configKey) || [];
        list.push(row);
        rangeRowsByConfig.set(row.configKey, list);
      }
      const resolvedConfigs = Object.fromEntries(
        Object.entries(allConfigs).map(([key, config]) => {
          const rows = rangeRowsByConfig.get(key) || [];
          return [key, applyDbRangesToConfig(config, rows)];
        })
      );
      res.json(resolvedConfigs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sport-configs/:configKey", async (req, res) => {
    try {
      const config = getSportConfig(req.params.configKey);
      if (!config) {
        return res.status(404).json({ error: "Sport config not found" });
      }
      const rangeRows = await fetchMetricRangeRows({
        configKey: req.params.configKey
      });
      res.json(applyDbRangesToConfig(config, rangeRows));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/metric-optimal-ranges", async (req, res) => {
    try {
      const configKey = String(req.query.configKey || "").trim();
      const sportName = String(req.query.sportName || "").trim();
      const movementName = String(req.query.movementName || "").trim();
      const metricKey = String(req.query.metricKey || "").trim();
      const rows = await fetchMetricRangeRows({
        configKey: configKey || void 0,
        sportName: sportName || void 0,
        movementName: movementName || void 0,
        metricKey: metricKey || void 0
      });
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/metric-optimal-ranges", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
          error: "configKey, metricKey, sportName, movementName, and unit are required"
        });
      }
      if (!Number.isFinite(optimalMin) || !Number.isFinite(optimalMax)) {
        return res.status(400).json({ error: "optimalMin and optimalMax must be numbers" });
      }
      if (optimalMin > optimalMax) {
        return res.status(400).json({ error: "optimalMin cannot be greater than optimalMax" });
      }
      await db.insert(sportCategoryMetricRanges).values({
        configKey,
        metricKey,
        sportName,
        movementName,
        metricLabel,
        unit,
        optimalMin,
        optimalMax,
        isActive,
        source: "admin"
      }).onConflictDoUpdate({
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
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
      const rows = await fetchMetricRangeRows({ configKey, metricKey, includeInactive: true });
      res.json(rows[0] || null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/metric-optimal-ranges/bulk", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!itemsRaw || itemsRaw.length === 0) {
        return res.status(400).json({ error: "items array is required" });
      }
      const items = [];
      for (let idx = 0; idx < itemsRaw.length; idx += 1) {
        const raw = itemsRaw[idx] || {};
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
            error: `Invalid item at index ${idx}: configKey, metricKey, sportName, movementName, and unit are required`
          });
        }
        if (!Number.isFinite(optimalMin) || !Number.isFinite(optimalMax)) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: optimalMin and optimalMax must be numbers`
          });
        }
        if (optimalMin > optimalMax) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: optimalMin cannot be greater than optimalMax`
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
          isActive
        });
      }
      for (const item of items) {
        await db.insert(sportCategoryMetricRanges).values({
          configKey: item.configKey,
          metricKey: item.metricKey,
          sportName: item.sportName,
          movementName: item.movementName,
          metricLabel: item.metricLabel,
          unit: item.unit,
          optimalMin: item.optimalMin,
          optimalMax: item.optimalMax,
          isActive: item.isActive,
          source: "admin"
        }).onConflictDoUpdate({
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
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      const uniqueConfigKeys = Array.from(new Set(items.map((item) => item.configKey)));
      const rows = await db.select().from(sportCategoryMetricRanges).where(
        and3(
          inArray(sportCategoryMetricRanges.configKey, uniqueConfigKeys),
          eq4(sportCategoryMetricRanges.isActive, true)
        )
      ).orderBy(
        asc(sportCategoryMetricRanges.configKey),
        asc(sportCategoryMetricRanges.metricKey)
      );
      res.json({
        updated: items.length,
        configKeys: uniqueConfigKeys,
        rows
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post(
    "/api/upload",
    requireAuth,
    upload.single("video"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }
        const requesterUserId = req.session.userId;
        const evaluationModeEnabled = await getModelEvaluationMode(requesterUserId);
        const originalFilename = path5.basename(String(req.file.originalname || "")).trim();
        const targetUserIdRaw = String(req.body?.targetUserId || "").trim();
        let userId = requesterUserId;
        if (targetUserIdRaw) {
          const [targetUser] = await db.select({ id: users.id }).from(users).where(eq4(users.id, targetUserIdRaw));
          if (!targetUser) {
            return res.status(400).json({ error: "Selected player not found" });
          }
          userId = targetUser.id;
        }
        const sportId = req.body?.sportId || null;
        const movementId = req.body?.movementId || null;
        let resolvedSportId = null;
        let resolvedMovementId = null;
        let resolvedSportName = "";
        let resolvedMovementName = "";
        if (sportId) {
          const [sport] = await db.select().from(sports).where(eq4(sports.id, sportId));
          if (sport) {
            resolvedSportId = sport.id;
            resolvedSportName = sport.name;
          }
        }
        if (movementId) {
          const [movement] = await db.select().from(sportMovements).where(eq4(sportMovements.id, movementId));
          if (movement && (!resolvedSportId || movement.sportId === resolvedSportId)) {
            resolvedMovementId = movement.id;
            resolvedMovementName = movement.name;
            if (!resolvedSportId) {
              resolvedSportId = movement.sportId;
              const [movementSport] = await db.select().from(sports).where(eq4(sports.id, movement.sportId));
              if (movementSport) {
                resolvedSportName = movementSport.name;
              }
            }
          }
        }
        const finalFilename = req.file.filename;
        const finalPath = req.file.path;
        const sourceFilename = evaluationModeEnabled && originalFilename ? originalFilename : null;
        const evaluationVideoId = null;
        const extractedMetadata = await extractVideoMetadata(finalPath);
        const analysis = await storage.createAnalysis(
          finalFilename,
          finalPath,
          userId,
          resolvedSportId,
          resolvedMovementId,
          extractedMetadata,
          sourceFilename,
          evaluationVideoId
        );
        processAnalysis(analysis.id).catch(console.error);
        res.json({
          id: analysis.id,
          status: analysis.status,
          message: "Video uploaded successfully. Processing started."
        });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message || "Upload failed" });
      }
    }
  );
  app2.get("/api/analyses", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const sportId = req.query.sportId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      await markStaleProcessingAsFailed(isAdmin ? void 0 : userId);
      const allAnalyses = isAdmin ? await storage.getAllAnalyses(null, sportId) : await storage.getAllAnalyses(userId, sportId);
      res.json(allAnalyses);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/summary", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const evaluationModeEnabled = isAdmin ? await getModelEvaluationMode(userId) : false;
      const evaluationVideoMap = evaluationModeEnabled ? getEvaluationDatasetVideoMap(readModelRegistryConfig()) : null;
      await markStaleProcessingAsFailed(isAdmin ? void 0 : userId);
      const query = db.select({
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
        modelVersion: metrics.modelVersion
      }).from(analyses).leftJoin(users, eq4(analyses.userId, users.id)).leftJoin(metrics, eq4(analyses.id, metrics.analysisId));
      const rows = isAdmin ? await query.orderBy(sql4`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`) : await query.where(eq4(analyses.userId, userId)).orderBy(sql4`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);
      const normalizedRows = rows.map((row) => {
        const normalized = normalizeScoreRow(row);
        return {
          ...normalized,
          sectionScores: computeSummarySectionScores({
            scoreOutputs: row.scoreOutputs
          })
        };
      });
      if (evaluationVideoMap && isAdmin) {
        const filteredRows = normalizedRows.filter((row) => getEvaluationMatch(row, evaluationVideoMap));
        return res.json(filteredRows);
      }
      res.json(normalizedRows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/coach/ask", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const question = String(req.body?.question || "").trim();
      const sportName = String(req.body?.sportName || "").trim();
      const movementName = String(req.body?.movementName || "").trim();
      const requestedPlayerId = String(req.body?.playerId || "").trim();
      if (!question) {
        return res.status(400).json({ error: "question is required" });
      }
      const targetPlayerId = isAdmin && requestedPlayerId && requestedPlayerId.toLowerCase() !== "all" ? requestedPlayerId : userId;
      const rows = await db.select({
        id: analyses.id,
        userId: analyses.userId,
        status: analyses.status,
        videoFilename: analyses.videoFilename,
        detectedMovement: analyses.detectedMovement,
        capturedAt: analyses.capturedAt,
        createdAt: analyses.createdAt,
        overallScore: metrics.overallScore,
        scoreOutputs: metrics.scoreOutputs,
        configKey: metrics.configKey
      }).from(analyses).leftJoin(metrics, eq4(analyses.id, metrics.analysisId)).where(eq4(analyses.userId, targetPlayerId)).orderBy(sql4`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);
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
      const scored = filtered.map((row) => normalizeScoreRow(row)).filter((row) => row.status === "completed" && typeof row.overallScore === "number").map((row) => ({ ...row, overallScore: Number(row.overallScore) }));
      if (!scored.length) {
        return res.json({
          answer: "I do not have completed scored sessions for this filter yet. Upload and complete at least one analysis, then ask again for trend and drill guidance.",
          confidence: "low",
          dataWindowSessions: 0,
          citations: {
            totalSessions: 0
          }
        });
      }
      const recent = scored.slice(0, 7);
      const recentThree = scored.slice(0, 3).map((r) => r.overallScore);
      const previousThree = scored.slice(3, 6).map((r) => r.overallScore);
      const recentAvg = mean(recentThree);
      const previousAvg = mean(previousThree);
      const overallDelta = recentAvg !== null && previousAvg !== null ? round12(recentAvg - previousAvg) : null;
      const metricKeys = ["power", "control", "timing", "technique"];
      const metricSummary = metricKeys.map((key) => {
        const latest = readSubScoreValue(scored[0]?.scoreOutputs, key);
        const recentMetric = scored.slice(0, 3).map((r) => readSubScoreValue(r.scoreOutputs, key)).filter((v) => v !== null);
        const prevMetric = scored.slice(3, 6).map((r) => readSubScoreValue(r.scoreOutputs, key)).filter((v) => v !== null);
        const delta = recentMetric.length && prevMetric.length ? round12((mean(recentMetric) || 0) - (mean(prevMetric) || 0)) : null;
        return { key, latest, delta };
      });
      const weakest = [...metricSummary].filter((m) => m.latest !== null).sort((a, b) => Number(a.latest) - Number(b.latest)).slice(0, 2);
      const movementBucket = /* @__PURE__ */ new Map();
      for (const row of scored.slice(0, 15)) {
        const label = getMovementLabel(row);
        const list = movementBucket.get(label) || [];
        list.push(Number(row.overallScore));
        movementBucket.set(label, list);
      }
      const topMovements = Array.from(movementBucket.entries()).map(([movement, values]) => ({ movement, avg: round12(mean(values) || 0), sessions: values.length })).sort((a, b) => b.avg - a.avg).slice(0, 2);
      const q = question.toLowerCase();
      const asksWhy = /why|drop|decline|down|worse/.test(q);
      const asksPlan = /plan|today|train|improve|drill|practice/.test(q);
      const asksCompare = /compare|versus|vs|forehand|backhand|serve/.test(q);
      const parts = [];
      parts.push(
        `Based on your last ${recent.length} scored sessions, your latest overall score is ${Math.round(
          scored[0].overallScore
        )}${overallDelta === null ? "" : ` and your short-term trend is ${overallDelta >= 0 ? "+" : ""}${overallDelta}.`}`
      );
      if (asksWhy) {
        const downMetrics = metricSummary.filter((m) => m.delta !== null && m.delta < 0).sort((a, b) => Number(a.delta) - Number(b.delta)).slice(0, 2);
        if (downMetrics.length) {
          parts.push(
            `The likely drivers are ${downMetrics.map((m) => `${formatMetricName(m.key)} (${m.delta})`).join(" and ")}.`
          );
        } else {
          parts.push("No major metric decline is visible in the recent window.");
        }
      }
      if (asksCompare && topMovements.length >= 2) {
        parts.push(
          `Movement comparison: ${topMovements[0].movement} averages ${topMovements[0].avg} over ${topMovements[0].sessions} sessions, while ${topMovements[1].movement} averages ${topMovements[1].avg} over ${topMovements[1].sessions} sessions.`
        );
      }
      if (asksPlan || !asksWhy) {
        if (weakest.length) {
          const drillLines = weakest.map((metric) => `${formatMetricName(metric.key)}: ${getDrillForMetric(metric.key)}`).join(" ");
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
          weakestMetrics: weakest.map((m) => m.key)
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to answer question" });
    }
  });
  app2.get("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      const [analysisUser] = analysis.userId ? await db.select({ name: users.name }).from(users).where(eq4(users.id, analysis.userId)).limit(1) : [null];
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const metricsData = await storage.getMetrics(req.params.id);
      const insights = await storage.getCoachingInsights(req.params.id);
      let selectedMovementName = null;
      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq4(sportMovements.id, analysis.movementId));
        if (movement) {
          selectedMovementName = movement.name;
        }
      }
      const normalizedMetricsData = metricsData ? {
        ...metricsData,
        metricValues: normalizeMetricValuesForApi(metricsData.metricValues)
      } : null;
      res.json({
        analysis: {
          ...analysis,
          userName: analysisUser?.name || null
        },
        metrics: normalizedMetricsData,
        coaching: insights || null,
        selectedMovementName
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/score-inputs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
        scoreInputs: metricsData.scoreInputs || null
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch score inputs" });
    }
  });
  app2.get("/api/analyses/:id/improved-tennis", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
        const [sport] = await db.select().from(sports).where(eq4(sports.id, analysis.sportId));
        if (sport?.name) sportName = String(sport.name).toLowerCase();
      }
      if (sportName !== "tennis") {
        return res.status(400).json({ error: "Improved analysis is available for Tennis only" });
      }
      const metricsData = await storage.getMetrics(req.params.id);
      const baseMetricValues = metricsData?.metricValues || {};
      const inputMetrics = {
        ...baseMetricValues
      };
      const report = buildImprovedTennisReportFromMetrics(
        analysis.detectedMovement,
        inputMetrics
      );
      return res.json({
        analysisId: analysis.id,
        sport: "tennis",
        report,
        inputMetrics,
        diagnosticsAvailable: false
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to build improved tennis analysis" });
    }
  });
  app2.get("/api/shot-annotations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const rows = isAdmin ? await db.select().from(analysisShotAnnotations).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(1e3) : await db.select().from(analysisShotAnnotations).where(eq4(analysisShotAnnotations.userId, userId)).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(300);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/shot-annotation", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const whereClause = isAdmin ? eq4(analysisShotAnnotations.analysisId, req.params.id) : and3(
        eq4(analysisShotAnnotations.analysisId, req.params.id),
        eq4(analysisShotAnnotations.userId, userId)
      );
      const [annotation] = await db.select().from(analysisShotAnnotations).where(whereClause).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(1);
      if (!annotation) {
        return res.json(null);
      }
      const evaluationVideoMap = getEvaluationDatasetVideoMap(readModelRegistryConfig());
      const useForModelTraining = Boolean(getEvaluationMatch(analysis, evaluationVideoMap));
      res.json({
        ...annotation,
        useForModelTraining
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/analyses/:id/shot-annotation", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only annotate your own analyses" });
      }
      const totalShotsNum = Number(req.body?.totalShots);
      const orderedShotLabels = Array.isArray(req.body?.orderedShotLabels) ? req.body.orderedShotLabels.map((value) => String(value || "").trim()).filter(Boolean) : [];
      const usedForScoringShotIndexes = parseIntegerList(req.body?.usedForScoringShotIndexes);
      const notes = req.body?.notes ? String(req.body.notes) : null;
      const useForModelTraining = isAdmin && Boolean(req.body?.useForModelTraining);
      if (!Number.isFinite(totalShotsNum) || totalShotsNum < 0) {
        return res.status(400).json({ error: "totalShots must be a non-negative number" });
      }
      if (orderedShotLabels.length !== Math.trunc(totalShotsNum)) {
        return res.status(400).json({
          error: "orderedShotLabels length must match totalShots"
        });
      }
      const [existing] = await db.select().from(analysisShotAnnotations).where(
        and3(
          eq4(analysisShotAnnotations.analysisId, req.params.id),
          eq4(analysisShotAnnotations.userId, userId)
        )
      ).limit(1);
      if (existing) {
        await db.update(analysisShotAnnotations).set({
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq4(analysisShotAnnotations.id, existing.id));
      } else {
        await db.insert(analysisShotAnnotations).values({
          analysisId: req.params.id,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes
        });
      }
      const [saved] = await db.select().from(analysisShotAnnotations).where(
        and3(
          eq4(analysisShotAnnotations.analysisId, req.params.id),
          eq4(analysisShotAnnotations.userId, userId)
        )
      ).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(1);
      const { sportName, movementName } = await resolveSportAndMovementNames(analysis);
      const dominantProfile = await resolveUserDominantProfile(analysis.userId);
      const manualLabels = (saved?.orderedShotLabels || orderedShotLabels).map(
        (label) => normalizeShotLabel(label)
      );
      if (isAdmin) {
        const movementForManifest = String(
          analysis.detectedMovement || movementName || "unknown"
        ).trim().toLowerCase();
        try {
          const syncResult = syncVideoForModelTuning({
            sourceVideoPath: analysis.videoPath,
            sourceVideoFilename: analysis.videoFilename,
            movementType: movementForManifest,
            enabled: useForModelTraining,
            videoId: analysis.evaluationVideoId || void 0
          });
          if (useForModelTraining && syncResult.videoId !== analysis.evaluationVideoId) {
            await db.update(analyses).set({
              evaluationVideoId: syncResult.videoId,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq4(analyses.id, analysis.id));
          }
        } catch (manifestError) {
          return res.status(500).json({
            error: manifestError?.message || "Failed to sync evaluation dataset manifest for model tuning"
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
          dominantProfile
        );
        const snapshot = computeDiscrepancySnapshot(autoLabels, manualLabels);
        await db.insert(analysisShotDiscrepancies).values({
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
          confusionPairs: snapshot.confusionPairs
        }).onConflictDoUpdate({
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
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
        discrepancySnapshotUpdated = true;
      } catch (snapshotError) {
        console.warn("Discrepancy snapshot update failed:", snapshotError);
      }
      res.json({
        ...saved || {
          analysisId: analysis.id,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes
        },
        useForModelTraining,
        discrepancySnapshotUpdated
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/shot-report", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      if (!analysis.videoPath || !fs5.existsSync(analysis.videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }
      let sportName = "tennis";
      let movementName = "auto-detect";
      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq4(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }
      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq4(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }
      const diagnostics = await runPythonDiagnostics2(
        analysis.videoPath,
        sportName,
        movementName,
        await resolveUserDominantProfile(analysis.userId)
      );
      const diagnosticsDetected = String(diagnostics?.detectedMovement || "").trim();
      if (diagnosticsDetected && normalizeMovementToken(diagnosticsDetected) !== normalizeMovementToken(analysis.detectedMovement)) {
        await db.update(analyses).set({ detectedMovement: diagnosticsDetected, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(analyses.id, analysis.id));
      }
      const [manualAnnotation] = await db.select().from(analysisShotAnnotations).where(
        and3(
          eq4(analysisShotAnnotations.analysisId, req.params.id),
          eq4(analysisShotAnnotations.userId, userId)
        )
      ).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(1);
      res.json({
        analysisId: req.params.id,
        totalShots: diagnostics?.shotsDetected ?? 0,
        shots: diagnostics?.shotSegments ?? [],
        shotsUsedForScoring: diagnostics?.shotSegments?.filter((s) => s.includedForScoring) ?? [],
        manualAnnotation: manualAnnotation || null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/discrepancy-summary", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const sportFilter = String(req.query.sportName || "").trim().toLowerCase();
      const movementFilter = normalizeMovementToken(req.query.movementName || "");
      const playerFilter = String(req.query.playerId || "").trim();
      const normalizedPlayerFilter = playerFilter.toLowerCase();
      const applyPlayerFilter = isAdmin && !!playerFilter && normalizedPlayerFilter !== "all";
      const analysisRows = isAdmin ? await db.select({
        analysis: analyses,
        sportName: sports.name,
        movementName: sportMovements.name,
        metricValues: metrics.metricValues
      }).from(analyses).leftJoin(sports, eq4(analyses.sportId, sports.id)).leftJoin(sportMovements, eq4(analyses.movementId, sportMovements.id)).leftJoin(metrics, eq4(metrics.analysisId, analyses.id)) : await db.select({
        analysis: analyses,
        sportName: sports.name,
        movementName: sportMovements.name,
        metricValues: metrics.metricValues
      }).from(analyses).leftJoin(sports, eq4(analyses.sportId, sports.id)).leftJoin(sportMovements, eq4(analyses.movementId, sportMovements.id)).leftJoin(metrics, eq4(metrics.analysisId, analyses.id)).where(eq4(analyses.userId, userId));
      const filteredAnalysesForRate = analysisRows.filter((row) => {
        if (row.analysis.status !== "completed") return false;
        if (applyPlayerFilter && row.analysis.userId !== playerFilter) return false;
        if (sportFilter) {
          const rowSport = String(row.sportName || "").trim().toLowerCase();
          if (rowSport && rowSport !== sportFilter) return false;
        }
        if (movementFilter) {
          const rowMovement = normalizeMovementToken(
            row.movementName || row.analysis.detectedMovement || ""
          );
          if (rowMovement !== movementFilter) return false;
        }
        return true;
      });
      const analysisDateById = new Map(
        filteredAnalysesForRate.map((row) => {
          const videoDate = row.analysis.capturedAt || row.analysis.createdAt;
          return [row.analysis.id, videoDate];
        })
      );
      const analysisShotCountById = new Map(
        filteredAnalysesForRate.map((row) => [
          row.analysis.id,
          readShotCountFromMetricValues(row.metricValues)
        ])
      );
      const dayTotalShots = /* @__PURE__ */ new Map();
      for (const row of filteredAnalysesForRate) {
        const videoDate = row.analysis.capturedAt || row.analysis.createdAt;
        const dayKey = videoDate.toISOString().slice(0, 10);
        const shotCount = analysisShotCountById.get(row.analysis.id) || 0;
        dayTotalShots.set(dayKey, (dayTotalShots.get(dayKey) || 0) + shotCount);
      }
      const rows = isAdmin ? await db.select({
        annotation: analysisShotAnnotations,
        analysis: analyses,
        userName: sql4`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
        sportName: sports.name,
        movementName: sportMovements.name
      }).from(analysisShotAnnotations).innerJoin(analyses, eq4(analysisShotAnnotations.analysisId, analyses.id)).leftJoin(sports, eq4(analyses.sportId, sports.id)).leftJoin(sportMovements, eq4(analyses.movementId, sportMovements.id)).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(200) : await db.select({
        annotation: analysisShotAnnotations,
        analysis: analyses,
        userName: sql4`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
        sportName: sports.name,
        movementName: sportMovements.name
      }).from(analysisShotAnnotations).innerJoin(analyses, eq4(analysisShotAnnotations.analysisId, analyses.id)).leftJoin(sports, eq4(analyses.sportId, sports.id)).leftJoin(sportMovements, eq4(analyses.movementId, sportMovements.id)).where(eq4(analysisShotAnnotations.userId, userId)).orderBy(desc3(analysisShotAnnotations.updatedAt)).limit(30);
      const filteredRows = rows.filter((row) => {
        if (applyPlayerFilter && row.analysis.userId !== playerFilter) return false;
        if (!sportFilter) return true;
        const rowSport = String(row.sportName || "").trim().toLowerCase();
        if (!rowSport) return true;
        return rowSport === sportFilter;
      }).filter((row) => {
        if (!movementFilter) return true;
        const rowMovement = normalizeMovementToken(
          row.movementName || row.analysis.detectedMovement || ""
        );
        return rowMovement === movementFilter;
      });
      const existingSnapshots = isAdmin ? await db.select().from(analysisShotDiscrepancies) : await db.select().from(analysisShotDiscrepancies).where(eq4(analysisShotDiscrepancies.userId, userId));
      const snapshotByAnalysisId = new Map(
        existingSnapshots.map((item) => [`${item.analysisId}:${item.userId}`, item])
      );
      const topVideos = [];
      const confusionMap = /* @__PURE__ */ new Map();
      const dayTotalMismatches = /* @__PURE__ */ new Map();
      const analysisHasMismatch = /* @__PURE__ */ new Map();
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
          const manualLabels = (annotation.orderedShotLabels || []).map(
            (label) => normalizeShotLabel(label)
          );
          const autoLabels = await resolveAutoLabelsForAnalysis(
            analysis,
            sportName,
            movementName,
            manualLabels,
            await resolveUserDominantProfile(analysis.userId)
          );
          const computed = computeDiscrepancySnapshot(autoLabels, manualLabels);
          await db.insert(analysisShotDiscrepancies).values({
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
            confusionPairs: computed.confusionPairs
          }).onConflictDoUpdate({
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
              updatedAt: /* @__PURE__ */ new Date()
            }
          });
          const [fresh] = await db.select().from(analysisShotDiscrepancies).where(
            and3(
              eq4(analysisShotDiscrepancies.analysisId, analysis.id),
              eq4(analysisShotDiscrepancies.userId, annotationOwnerId)
            )
          ).limit(1);
          snapshot = fresh;
          if (snapshot) {
            snapshotByAnalysisId.set(snapshotKey, snapshot);
          }
        }
        if (!snapshot) continue;
        videosAnnotated += 1;
        totalManualShots += Number(snapshot.manualShots || 0);
        totalMismatches += Number(snapshot.mismatches || 0);
        const confusionPairs = Array.isArray(snapshot.confusionPairs) ? snapshot.confusionPairs : [];
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
          (dayTotalMismatches.get(dayKey) || 0) + mismatches
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
          mismatchRatePct: Number(snapshot.mismatchRatePct || 0)
        });
      }
      const rankedVideos = [...topVideos].sort((a, b) => {
        if (b.mismatchRatePct !== a.mismatchRatePct) {
          return b.mismatchRatePct - a.mismatchRatePct;
        }
        return b.mismatches - a.mismatches;
      });
      const labelConfusions = Array.from(confusionMap.entries()).map(([pair, count]) => {
        const [from, to] = pair.split("=>");
        return { from, to, count };
      }).filter((item) => {
        if (!movementFilter) return true;
        return normalizeMovementToken(item.from) === movementFilter || normalizeMovementToken(item.to) === movementFilter;
      }).sort((a, b) => b.count - a.count).slice(0, 8);
      const totalVideosConsidered = filteredAnalysesForRate.length;
      const videosWithDiscrepancy = Array.from(analysisHasMismatch.values()).filter(Boolean).length;
      const totalShots = Array.from(analysisShotCountById.values()).reduce(
        (sum, shotCount) => sum + shotCount,
        0
      );
      const mismatchRatePct = Number(
        (totalMismatches / Math.max(totalShots, 1) * 100).toFixed(1)
      );
      const trend7d = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = /* @__PURE__ */ new Date();
        date.setUTCDate(date.getUTCDate() - offset);
        const dayKey = date.toISOString().slice(0, 10);
        const totalShotsForDay = dayTotalShots.get(dayKey) || 0;
        const mismatchesForDay = dayTotalMismatches.get(dayKey) || 0;
        const dayRate = totalShotsForDay ? Number((mismatchesForDay / Math.max(totalShotsForDay, 1) * 100).toFixed(1)) : 0;
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
          mismatchRatePct
        },
        trend7d,
        topVideos: rankedVideos,
        labelConfusions
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/diagnostics", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const forceRefresh = String(req.query.refresh || "") === "1";
      const [metricRow] = await db.select({ aiDiagnostics: metrics.aiDiagnostics }).from(metrics).where(eq4(metrics.analysisId, analysis.id)).limit(1);
      const persistedDiagnostics = metricRow?.aiDiagnostics && typeof metricRow.aiDiagnostics === "object" ? metricRow.aiDiagnostics : null;
      if (persistedDiagnostics && !forceRefresh) {
        return res.json(persistedDiagnostics);
      }
      if (!analysis.videoPath || !fs5.existsSync(analysis.videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }
      let sportName = "tennis";
      let movementName = "auto-detect";
      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq4(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }
      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq4(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }
      const diagnostics = await runPythonDiagnostics2(
        analysis.videoPath,
        sportName,
        movementName,
        await resolveUserDominantProfile(analysis.userId)
      );
      await db.update(metrics).set({ aiDiagnostics: diagnostics }).where(eq4(metrics.analysisId, analysis.id));
      const diagnosticsDetected = String(diagnostics?.detectedMovement || "").trim();
      if (diagnosticsDetected && normalizeMovementToken(diagnosticsDetected) !== normalizeMovementToken(analysis.detectedMovement)) {
        await db.update(analyses).set({ detectedMovement: diagnosticsDetected, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(analyses.id, analysis.id));
      }
      res.json(diagnostics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/video-metadata", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      if (!analysis.videoPath || !fs5.existsSync(analysis.videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }
      const extractedMetadata = await extractVideoMetadata(analysis.videoPath);
      return res.json(extractedMetadata || {});
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to extract video metadata" });
    }
  });
  app2.get("/api/analyses/:id/comparison", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const metricsData = await storage.getMetrics(req.params.id);
      const periodMap = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "all": null
      };
      const period = req.query.period || "30d";
      if (!(period in periodMap)) {
        return res.status(400).json({ error: "Invalid period. Use 7d, 30d, 90d, or all." });
      }
      const periodDays = periodMap[period];
      const result = await storage.getHistoricalMetricAverages(
        analysis.userId,
        new Date(analysis.capturedAt || analysis.createdAt),
        periodDays,
        analysis.sportId,
        metricsData?.configKey || null
      );
      res.json(result);
    } catch (error) {
      console.error("Comparison error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/metric-trends", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
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
      const periodMap = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "all": null
      };
      const period = req.query.period || "30d";
      if (!(period in periodMap)) {
        return res.status(400).json({ error: "Invalid period. Use 7d, 30d, 90d, or all." });
      }
      const periodDays = periodMap[period];
      const baseDate = new Date(analysis.capturedAt || analysis.createdAt);
      const conditions = [
        eq4(analyses.userId, analysis.userId),
        eq4(analyses.status, "completed"),
        eq4(metrics.configKey, metricsData.configKey),
        sql4`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) <= ${baseDate}`
      ];
      if (analysis.sportId) {
        conditions.push(eq4(analyses.sportId, analysis.sportId));
      }
      if (periodDays !== null) {
        const startDate = new Date(baseDate.getTime() - periodDays * 24 * 60 * 60 * 1e3);
        conditions.push(sql4`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) >= ${startDate}`);
      }
      const rows = await db.select({
        analysisId: analyses.id,
        videoFilename: analyses.videoFilename,
        sourceFilename: analyses.sourceFilename,
        videoContentHash: analyses.videoContentHash,
        capturedAt: analyses.capturedAt,
        createdAt: analyses.createdAt,
        overallScore: metrics.overallScore,
        scoreOutputs: metrics.scoreOutputs,
        metricValues: metrics.metricValues
      }).from(analyses).innerJoin(metrics, eq4(analyses.id, metrics.analysisId)).where(and3(...conditions)).orderBy(sql4`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) asc`);
      const points = rows.map((row) => {
        const normalized = normalizeScoreRow(row);
        const sectionScores = computeSummarySectionScores({
          scoreOutputs: row.scoreOutputs
        });
        return {
          analysisId: row.analysisId,
          videoFilename: row.videoFilename,
          sourceFilename: row.sourceFilename,
          videoContentHash: row.videoContentHash,
          capturedAt: (row.capturedAt || row.createdAt).toISOString(),
          overallScore: typeof normalized.overallScore === "number" && Number.isFinite(normalized.overallScore) ? Number(normalized.overallScore) : null,
          subScores: normalizeTacticalScoresToApi100(
            row.scoreOutputs || null
          ),
          sectionScores,
          scoreOutputs: row.scoreOutputs && typeof row.scoreOutputs === "object" ? row.scoreOutputs : null,
          metricValues: row.metricValues && typeof row.metricValues === "object" ? normalizeMetricValuesForApi(row.metricValues) : {}
        };
      });
      res.json({
        period,
        points
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/analyses/recalculate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      await markStaleProcessingAsFailed(isAdmin ? void 0 : userId);
      const rawAnalyses = isAdmin ? await storage.getAllAnalyses(null) : await storage.getAllAnalyses(userId);
      const evaluationModeEnabled = await getModelEvaluationMode(userId);
      const videoMap = evaluationModeEnabled && isAdmin ? getEvaluationDatasetVideoMap(readModelRegistryConfig()) : null;
      const userAnalyses = videoMap ? rawAnalyses.filter((analysis) => getEvaluationMatch(analysis, videoMap)) : rawAnalyses;
      const videoExts = /* @__PURE__ */ new Set([".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"]);
      const collectUploadVideoFiles = (root) => {
        const collected = [];
        const walk = (dir) => {
          let entries = [];
          try {
            entries = fs5.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            const fullPath = path5.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
              continue;
            }
            if (!entry.isFile()) {
              continue;
            }
            const ext = path5.extname(entry.name).toLowerCase();
            if (!videoExts.has(ext)) {
              continue;
            }
            try {
              const stats = fs5.statSync(fullPath);
              collected.push({
                filename: entry.name,
                fullPath,
                ext,
                mtimeMs: stats.mtimeMs
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
        userAnalyses.filter((analysis) => analysis.videoPath && fs5.existsSync(analysis.videoPath)).map((analysis) => path5.resolve(analysis.videoPath))
      );
      const unassignedUploadFiles = new Map(
        uploadFiles.filter((file) => !existingPaths.has(path5.resolve(file.fullPath))).map((file) => [path5.resolve(file.fullPath), file])
      );
      const runnableAnalyses = [];
      let autoRelinkedAnalyses = 0;
      const skippedDetails = [];
      for (const analysis of userAnalyses) {
        if (analysis.videoPath && fs5.existsSync(analysis.videoPath)) {
          runnableAnalyses.push(analysis);
          continue;
        }
        const currentFilename = path5.basename(analysis.videoFilename || "");
        const exactNameCandidate = currentFilename ? [...unassignedUploadFiles.values()].find((f) => f.filename === currentFilename) : void 0;
        if (exactNameCandidate && fs5.existsSync(exactNameCandidate.fullPath)) {
          await db.update(analyses).set({
            videoFilename: exactNameCandidate.filename,
            videoPath: exactNameCandidate.fullPath,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq4(analyses.id, analysis.id));
          runnableAnalyses.push({
            ...analysis,
            videoFilename: exactNameCandidate.filename,
            videoPath: exactNameCandidate.fullPath
          });
          unassignedUploadFiles.delete(path5.resolve(exactNameCandidate.fullPath));
          autoRelinkedAnalyses += 1;
          continue;
        }
        const originalExt = path5.extname(currentFilename).toLowerCase();
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
            filename: currentFilename
          });
          continue;
        }
        const analysisCreatedAt = new Date(analysis.createdAt).getTime();
        const bestCandidate = candidates.map((file) => ({
          file,
          delta: Math.abs(file.mtimeMs - analysisCreatedAt)
        })).sort((a, b) => a.delta - b.delta)[0]?.file;
        if (!bestCandidate) {
          skippedDetails.push({
            id: analysis.id,
            reason: "Could not find a relink candidate",
            filename: currentFilename
          });
          continue;
        }
        await db.update(analyses).set({
          videoFilename: bestCandidate.filename,
          videoPath: bestCandidate.fullPath,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq4(analyses.id, analysis.id));
        unassignedUploadFiles.delete(path5.resolve(bestCandidate.fullPath));
        runnableAnalyses.push({
          ...analysis,
          videoFilename: bestCandidate.filename,
          videoPath: bestCandidate.fullPath
        });
        autoRelinkedAnalyses += 1;
      }
      const ids = runnableAnalyses.map((analysis) => analysis.id);
      const annotationRows = ids.length ? await db.select({
        analysisId: analysisShotAnnotations.analysisId,
        userId: analysisShotAnnotations.userId
      }).from(analysisShotAnnotations).where(inArray(analysisShotAnnotations.analysisId, ids)) : [];
      const analysesWithAnnotationsQueued = new Set(
        annotationRows.map((row) => row.analysisId)
      ).size;
      void (async () => {
        for (const id of ids) {
          try {
            await processAnalysis(id);
            const snapshotResult = await refreshDiscrepancySnapshotsForAnalysis(id);
            if (snapshotResult.refreshed > 0 || snapshotResult.skipped > 0) {
              console.log(
                `Discrepancy refresh for ${id}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}`
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
        analysesWithAnnotationsQueued
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/analyses/:id/relink-and-recalculate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const analysisId = req.params.id;
      const filename = (req.body?.filename || "").toString().trim();
      if (!filename) {
        return res.status(400).json({ error: "filename is required" });
      }
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      const evaluationModeEnabled = await getModelEvaluationMode(userId);
      if (evaluationModeEnabled && isAdmin) {
        const videoMap = getEvaluationDatasetVideoMap(readModelRegistryConfig());
        if (!getEvaluationMatch(analysis, videoMap)) {
          return res.status(400).json({
            error: "Model Evaluation Mode is ON. Only evaluation dataset videos can be recalculated."
          });
        }
      }
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only relink your own analyses" });
      }
      const safeFilename = path5.basename(filename);
      const relinkedPath = path5.join(uploadDir, safeFilename);
      if (!fs5.existsSync(relinkedPath)) {
        return res.status(404).json({ error: "File not found in uploads folder" });
      }
      await db.update(analyses).set({
        videoFilename: safeFilename,
        videoPath: relinkedPath,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(analyses.id, analysisId));
      const relinkAnnotationRows = await db.select({
        analysisId: analysisShotAnnotations.analysisId,
        userId: analysisShotAnnotations.userId
      }).from(analysisShotAnnotations).where(eq4(analysisShotAnnotations.analysisId, analysisId));
      void (async () => {
        try {
          await processAnalysis(analysisId);
          const snapshotResult = await refreshDiscrepancySnapshotsForAnalysis(analysisId);
          if (snapshotResult.refreshed > 0 || snapshotResult.skipped > 0) {
            console.log(
              `Discrepancy refresh for ${analysisId}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}`
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
        queuedDiscrepancySnapshots: relinkAnnotationRows.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/feedback", requireAuth, async (req, res) => {
    try {
      const [feedback] = await db.select().from(analysisFeedback).where(
        and3(
          eq4(analysisFeedback.analysisId, req.params.id),
          eq4(analysisFeedback.userId, req.session.userId)
        )
      ).limit(1);
      res.json(feedback || null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/analyses/:id/feedback", requireAuth, async (req, res) => {
    try {
      const { rating, comment } = req.body;
      if (!rating || !["up", "down"].includes(rating)) {
        return res.status(400).json({ error: "Rating must be 'up' or 'down'" });
      }
      const existing = await db.select().from(analysisFeedback).where(
        and3(
          eq4(analysisFeedback.analysisId, req.params.id),
          eq4(analysisFeedback.userId, req.session.userId)
        )
      ).limit(1);
      if (existing.length > 0) {
        await db.update(analysisFeedback).set({ rating, comment: comment || null }).where(eq4(analysisFeedback.id, existing[0].id));
      } else {
        await db.insert(analysisFeedback).values({
          analysisId: req.params.id,
          userId: req.session.userId,
          rating,
          comment: comment || null
        });
      }
      const [feedback] = await db.select().from(analysisFeedback).where(
        and3(
          eq4(analysisFeedback.analysisId, req.params.id),
          eq4(analysisFeedback.userId, req.session.userId)
        )
      ).limit(1);
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.delete("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (analysis.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only delete your own analyses" });
      }
      if (fs5.existsSync(analysis.videoPath)) {
        fs5.unlinkSync(analysis.videoPath);
      }
      await storage.deleteAnalysis(req.params.id);
      res.json({ message: "Analysis deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.delete("/api/analyses", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq4(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Only admins can clear history" });
      }
      const allAnalyses = await storage.getAllAnalyses(null);
      for (const analysis of allAnalyses) {
        if (analysis.videoPath && fs5.existsSync(analysis.videoPath)) {
          fs5.unlinkSync(analysis.videoPath);
        }
      }
      await db.transaction(async (tx) => {
        await tx.delete(coachingInsights);
        await tx.delete(analysisFeedback);
        await tx.delete(analysisShotAnnotations);
        await tx.delete(metrics);
        await tx.delete(analyses);
        await tx.execute(sql4`delete from "session"`);
      });
      res.json({ message: "History cleared", deletedCount: allAnalyses.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/seed-sports.ts
var SPORTS_DATA = [
  {
    name: "Tennis",
    icon: "tennisball-outline",
    color: "#10B981",
    description: "Analyze your tennis strokes with AI-powered biomechanics",
    sortOrder: 1,
    movements: [
      { name: "Forehand", description: "Forward stroke on dominant side", icon: "arrow-forward-circle-outline", sortOrder: 1 },
      { name: "Backhand", description: "Stroke on non-dominant side", icon: "arrow-back-circle-outline", sortOrder: 2 },
      { name: "Serve", description: "Overhead serving motion", icon: "arrow-up-circle-outline", sortOrder: 3 },
      { name: "Volley", description: "Net play and quick exchanges", icon: "flash-outline", sortOrder: 4 },
      { name: "Game", description: "Full match play analysis", icon: "trophy-outline", sortOrder: 5 }
    ]
  },
  {
    name: "Golf",
    icon: "golf-outline",
    color: "#22D3EE",
    description: "Perfect your swing with precision motion analysis",
    sortOrder: 2,
    movements: [
      { name: "Drive", description: "Long-distance tee shot", icon: "rocket-outline", sortOrder: 1 },
      { name: "Iron Shot", description: "Mid-range approach shots", icon: "navigate-outline", sortOrder: 2 },
      { name: "Chip", description: "Short game around the green", icon: "trending-up-outline", sortOrder: 3 },
      { name: "Putt", description: "Putting technique on the green", icon: "radio-button-on-outline", sortOrder: 4 },
      { name: "Full Swing", description: "Complete swing mechanics", icon: "sync-outline", sortOrder: 5 }
    ]
  },
  {
    name: "Pickleball",
    icon: "ellipse-outline",
    color: "#F59E0B",
    description: "Sharpen your pickleball technique with smart analysis",
    sortOrder: 3,
    movements: [
      { name: "Dink", description: "Soft shot near the kitchen line", icon: "water-outline", sortOrder: 1 },
      { name: "Drive", description: "Hard flat offensive shot", icon: "arrow-forward-outline", sortOrder: 2 },
      { name: "Serve", description: "Underhand serve technique", icon: "arrow-up-outline", sortOrder: 3 },
      { name: "Volley", description: "Quick net exchanges", icon: "flash-outline", sortOrder: 4 },
      { name: "Third Shot Drop", description: "Transition shot to the kitchen", icon: "trending-down-outline", sortOrder: 5 }
    ]
  },
  {
    name: "Paddle",
    icon: "tablet-landscape-outline",
    color: "#8B5CF6",
    description: "Elevate your padel game with movement insights",
    sortOrder: 4,
    movements: [
      { name: "Forehand", description: "Dominant side wall play", icon: "arrow-forward-circle-outline", sortOrder: 1 },
      { name: "Backhand", description: "Non-dominant side strokes", icon: "arrow-back-circle-outline", sortOrder: 2 },
      { name: "Serve", description: "Underhand serve technique", icon: "arrow-up-outline", sortOrder: 3 },
      { name: "Smash", description: "Overhead power shot", icon: "flash-outline", sortOrder: 4 },
      { name: "Bandeja", description: "Defensive overhead slice", icon: "umbrella-outline", sortOrder: 5 }
    ]
  },
  {
    name: "Badminton",
    icon: "fitness-outline",
    color: "#EF4444",
    description: "Optimize your badminton strokes and footwork",
    sortOrder: 5,
    movements: [
      { name: "Clear", description: "High deep shot to the baseline", icon: "arrow-up-circle-outline", sortOrder: 1 },
      { name: "Smash", description: "Powerful overhead attack", icon: "flash-outline", sortOrder: 2 },
      { name: "Drop", description: "Soft shot just over the net", icon: "trending-down-outline", sortOrder: 3 },
      { name: "Net Shot", description: "Delicate play at the net", icon: "git-network-outline", sortOrder: 4 },
      { name: "Serve", description: "Short or long serve technique", icon: "arrow-up-outline", sortOrder: 5 }
    ]
  },
  {
    name: "Table Tennis",
    icon: "radio-button-off-outline",
    color: "#3B82F6",
    description: "Analyze your table tennis technique at high speed",
    sortOrder: 6,
    movements: [
      { name: "Forehand", description: "Dominant side topspin drive", icon: "arrow-forward-circle-outline", sortOrder: 1 },
      { name: "Backhand", description: "Quick backhand flick or drive", icon: "arrow-back-circle-outline", sortOrder: 2 },
      { name: "Serve", description: "Spin serve techniques", icon: "arrow-up-outline", sortOrder: 3 },
      { name: "Loop", description: "Heavy topspin attack", icon: "sync-outline", sortOrder: 4 },
      { name: "Chop", description: "Defensive backspin return", icon: "cut-outline", sortOrder: 5 }
    ]
  }
];
async function seedSports() {
  const existingSports = await db.select().from(sports);
  if (existingSports.length > 0) {
    return;
  }
  console.log("Seeding sports and movements...");
  for (const sportData of SPORTS_DATA) {
    const [sport] = await db.insert(sports).values({
      name: sportData.name,
      icon: sportData.icon,
      color: sportData.color,
      description: sportData.description,
      sortOrder: sportData.sortOrder
    }).returning();
    for (const movement of sportData.movements) {
      await db.insert(sportMovements).values({
        sportId: sport.id,
        name: movement.name,
        description: movement.description,
        icon: movement.icon,
        sortOrder: movement.sortOrder
      });
    }
  }
  console.log("Sports and movements seeded successfully");
}

// server/index.ts
import * as fs6 from "fs";
import * as path6 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path7 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path7.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path7} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path6.resolve(process.cwd(), "app.json");
    const appJsonContent = fs6.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path6.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs6.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs6.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path6.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs6.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path6.resolve(process.cwd(), "assets")));
  app2.use("/uploads", express.static(path6.resolve(process.cwd(), "uploads")));
  app2.use(express.static(path6.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  await setupAuth(app);
  configureExpoAndLanding(app);
  await seedSports();
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  const isReplit = Boolean(process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS);
  const listenOptions = isReplit ? { port, host, reusePort: true } : { port, host };
  server.listen(listenOptions, () => {
    log(`express server serving on port ${port}`);
  });
})();
