var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/env.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function stripWrappingQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, equalsIndex).trim();
    const existingValue = process.env[key];
    if (!key || existingValue != null && String(existingValue).trim() !== "") {
      continue;
    }
    const rawValue = normalized.slice(equalsIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(rawValue);
  }
}
var serverDir = path.dirname(fileURLToPath(import.meta.url));
var PROJECT_ROOT = path.resolve(serverDir, "..");
function resolveProjectPath(...segments) {
  return path.resolve(PROJECT_ROOT, ...segments);
}
function ensureEnvLoaded() {
  const candidateRoots = Array.from(/* @__PURE__ */ new Set([process.cwd(), PROJECT_ROOT]));
  for (const root of candidateRoots) {
    loadEnvFile(path.resolve(root, ".env"));
    loadEnvFile(path.resolve(root, ".env.local"));
  }
}
ensureEnvLoaded();

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { execFile as execFile2, spawn as spawn2 } from "child_process";
import { randomUUID as randomUUID3 } from "crypto";
import multer2 from "multer";
import path4 from "path";
import fs7 from "fs";

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
  modelRegistryDatasetItems: () => modelRegistryDatasetItems,
  modelRegistryDatasets: () => modelRegistryDatasets,
  modelRegistryVersions: () => modelRegistryVersions,
  registerSchema: () => registerSchema,
  sportCategoryMetricRanges: () => sportCategoryMetricRanges,
  sportMovements: () => sportMovements,
  sports: () => sports,
  tennisModelTrainingRuns: () => tennisModelTrainingRuns,
  tennisTrainingDatasetRows: () => tennisTrainingDatasetRows,
  tennisTrainingDatasets: () => tennisTrainingDatasets,
  users: () => users
});
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  real,
  integer,
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
  role: text("role").default("admin").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id"),
  updatedByUserId: varchar("updated_by_user_id")
});
var sports = pgTable("sports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: real("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var sportMovements = pgTable("sport_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sportId: varchar("sport_id").notNull().references(() => sports.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  sortOrder: real("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sportId: varchar("sport_id").references(() => sports.id),
  movementId: varchar("movement_id").references(() => sportMovements.id),
  requestedSessionType: text("requested_session_type"),
  requestedFocusKey: text("requested_focus_key"),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var coachingInsights = pgTable("coaching_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  keyStrength: text("key_strength").notNull(),
  improvementArea: text("improvement_area").notNull(),
  trainingSuggestion: text("training_suggestion").notNull(),
  simpleExplanation: text("simple_explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var analysisFeedback = pgTable("analysis_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: text("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var modelRegistryVersions = pgTable("model_registry_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelVersion: varchar("model_version").notNull().unique(),
  description: text("description").notNull().default(""),
  status: varchar("status").notNull().default("draft"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  activatedByUserId: varchar("activated_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var modelRegistryDatasets = pgTable("model_registry_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  source: text("source").notNull().default("manual-annotation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var modelRegistryDatasetItems = pgTable("model_registry_dataset_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").notNull().references(() => modelRegistryDatasets.id),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  annotatorUserId: varchar("annotator_user_id").references(() => users.id),
  expectedMovement: text("expected_movement").notNull(),
  evaluationVideoId: text("evaluation_video_id"),
  sourceFilename: text("source_filename"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var tennisTrainingDatasets = pgTable("tennis_training_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sportName: text("sport_name").notNull().default("tennis"),
  datasetName: text("dataset_name").notNull(),
  source: text("source").notNull().default("manual-annotation"),
  analysisCount: integer("analysis_count").notNull().default(0),
  rowCount: integer("row_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var tennisTrainingDatasetRows = pgTable("tennis_training_dataset_rows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").notNull().references(() => tennisTrainingDatasets.id),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  userId: varchar("user_id").references(() => users.id),
  videoFilename: text("video_filename").notNull(),
  shotIndex: integer("shot_index").notNull(),
  groupKey: text("group_key").notNull(),
  label: text("label").notNull(),
  heuristicLabel: text("heuristic_label"),
  heuristicConfidence: real("heuristic_confidence"),
  heuristicReasons: jsonb("heuristic_reasons").$type().notNull().default(sql`'[]'::jsonb`),
  featureValues: jsonb("feature_values").$type().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
});
var tennisModelTrainingRuns = pgTable("tennis_model_training_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().unique(),
  sportName: text("sport_name").notNull().default("tennis"),
  status: varchar("status").notNull(),
  datasetId: varchar("dataset_id").references(() => tennisTrainingDatasets.id),
  eligibleAnalysisCount: integer("eligible_analysis_count").notNull().default(0),
  eligibleShotCount: integer("eligible_shot_count").notNull().default(0),
  exportRows: integer("export_rows"),
  trainRows: integer("train_rows"),
  testRows: integer("test_rows"),
  macroF1: real("macro_f1"),
  modelOutputPath: text("model_output_path"),
  metadata: jsonb("metadata").$type(),
  report: jsonb("report").$type(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id),
  savedModelVersion: varchar("saved_model_version"),
  savedModelArtifactPath: text("saved_model_artifact_path"),
  savedAt: timestamp("saved_at", { withTimezone: true }),
  versionDescription: text("version_description"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id)
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

// server/audit-metadata.ts
function buildInsertAuditFields(actorUserId) {
  const actor = String(actorUserId || "").trim() || null;
  const now = /* @__PURE__ */ new Date();
  return {
    createdAt: now,
    updatedAt: now,
    createdByUserId: actor,
    updatedByUserId: actor
  };
}
function buildUpdateAuditFields(actorUserId) {
  const actor = String(actorUserId || "").trim() || null;
  return {
    updatedAt: /* @__PURE__ */ new Date(),
    updatedByUserId: actor
  };
}

// server/storage.ts
var DatabaseStorage = class {
  async createAnalysis(videoFilename, videoPath, userId, sportId, movementId, requestedSessionType, requestedFocusKey, metadata, sourceFilename, evaluationVideoId, actorUserId) {
    const [analysis] = await db.insert(analyses).values({
      videoFilename,
      sourceFilename: sourceFilename || null,
      evaluationVideoId: evaluationVideoId || null,
      videoPath,
      status: "pending",
      userId: userId || null,
      sportId: sportId || null,
      movementId: movementId || null,
      requestedSessionType: requestedSessionType || null,
      requestedFocusKey: requestedFocusKey || null,
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
      gpsSource: metadata?.gpsSource ?? null,
      ...buildInsertAuditFields(actorUserId)
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
import { and as and3, desc as desc3, eq as eq6, isNotNull, ne, or } from "drizzle-orm";
import { spawn } from "child_process";
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip-to-ankle alignment stability throughout the stroke",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Variance in elbow angles and wrist speeds across the video",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness of the speed profile throughout the swing",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight transfer stability during the backhand stroke",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Stroke repeatability across frames",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Swing rhythm smoothness",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body balance throughout the service motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and consistency of the service motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the volley",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of volley technique",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and rhythm of the volley motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Overall body balance during match play",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Overall consistency of shot technique",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Movement rhythm and pacing between shots",
      optimalRange: [6, 9]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight distribution and stability throughout the swing",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Overall smoothness and flow of the swing",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight transfer and stability",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Swing rhythm consistency",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight distribution \u2014 should favor front foot",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Smoothness of the chipping motion",
      optimalRange: [7, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability \u2014 no swaying or weight shift",
      optimalRange: [8, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Smoothness and consistency of stroke tempo",
      optimalRange: [7.5, 9.8]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Weight distribution and stability",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "consistency",
      color: "#6C5CE7",
      description: "Overall swing rhythm and flow",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the dink motion",
      optimalRange: [7, 9.8]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of dink technique across multiple shots",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the dink motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the aggressive drive motion",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of drive technique across multiple shots",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the drive motion",
      optimalRange: [6, 9]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability throughout the serve motion",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the serve motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during quick volley exchanges",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of volley technique across exchanges",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and tempo of volley exchanges",
      optimalRange: [6, 9]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of third shot drop execution",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the transition drop shot",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the drop shot motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Hip-to-ankle alignment stability throughout the stroke",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Variance in technique across repeated strokes",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing flow throughout the swing",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability throughout the backhand stroke",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of backhand technique across strokes",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing flow of the backhand motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of serve technique across attempts",
      optimalRange: [7, 9.8]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the underhand serve motion",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the serve motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during and after the smash",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the smash motion",
      optimalRange: [6, 9.2]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the defensive overhead",
      optimalRange: [7, 9.8]
    },
    {
      key: "shotConsistency",
      label: "Consistency",
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of bandeja technique",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the bandeja motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability throughout the clear motion",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and tempo of the clear stroke",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the smash motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of drop shot placement",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the drop shot motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "body",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability during the net shot",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of net shot technique",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Fluidity and timing of the net shot motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#6C5CE7",
      description: "Repeatability of serve technique and placement",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#6C5CE7",
      description: "Smoothness and timing of the serve motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#FBBF24",
      description: "Repeatability of bat speed and stroke mechanics across frames",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Smoothness and tempo consistency of the stroke cycle",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#FBBF24",
      description: "Stroke repeatability across multiple backhand shots",
      optimalRange: [7, 9.8]
    },
    {
      key: "balanceScore",
      label: "Balance",
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability and center of gravity control during the stroke",
      optimalRange: [7, 9.8]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Tempo consistency and fluidity of the backhand motion",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Consistency of serve motion tempo and timing",
      optimalRange: [6.5, 9.5]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Body stability and weight transfer during the explosive loop",
      optimalRange: [6.5, 9.5]
    },
    {
      key: "rhythmConsistency",
      label: "Rhythm",
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Tempo consistency of the loop stroke cycle",
      optimalRange: [6, 9.2]
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
      unit: "/10",
      icon: "ribbon",
      category: "consistency",
      color: "#FBBF24",
      description: "Repeatability of chop depth and backspin across strokes",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "footsteps",
      category: "biomechanics",
      color: "#60A5FA",
      description: "Stability during the defensive chopping stance",
      optimalRange: [7, 9.8]
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
      unit: "/10",
      icon: "musical-notes",
      category: "timing",
      color: "#A78BFA",
      description: "Tempo consistency of the defensive chop cycle",
      optimalRange: [6.5, 9.5]
    }
  ]
};

// shared/metric-scale.ts
var TEN_POINT_METRIC_KEYS = /* @__PURE__ */ new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency"
]);
function round1(value) {
  return Number(value.toFixed(1));
}
function usesTenPointScale(metricKey) {
  return TEN_POINT_METRIC_KEYS.has(String(metricKey || ""));
}
function normalizeMetricUnit(metricKey, unit) {
  if (!usesTenPointScale(metricKey)) return unit;
  return "/10";
}
function normalizeMetricValueToTenScale(metricKey, value) {
  if (!Number.isFinite(value)) return value;
  if (!usesTenPointScale(metricKey)) return round1(value);
  const scaled = value > 10 ? value / 10 : value;
  return round1(Math.max(0, Math.min(10, scaled)));
}
function normalizeMetricRangeToTenScale(metricKey, range) {
  if (!range || range.length !== 2) return range;
  return [
    normalizeMetricValueToTenScale(metricKey, Number(range[0])),
    normalizeMetricValueToTenScale(metricKey, Number(range[1]))
  ];
}

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
function normalizeMetricPresentation(config) {
  return {
    ...config,
    metrics: (config.metrics || []).map((metric) => ({
      ...metric,
      unit: normalizeMetricUnit(metric.key, metric.unit),
      optimalRange: normalizeMetricRangeToTenScale(metric.key, metric.optimalRange)
    }))
  };
}
function getSportConfig(configKey) {
  const config = configRegistry[configKey];
  return config ? normalizeMetricPresentation(normalizeScoresWithoutConsistency(config)) : void 0;
}
function getAllConfigs() {
  return Object.fromEntries(
    Object.entries(configRegistry).map(([key, config]) => [key, normalizeMetricPresentation(normalizeScoresWithoutConsistency(config))])
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

// shared/pipeline-timing.ts
var PIPELINE_STAGE_DEFINITIONS = [
  {
    key: "upload",
    label: "Upload",
    description: "Video received over HTTP and stored"
  },
  {
    key: "firstPosePass",
    label: "First pose pass",
    description: "Initial full-video pose detection for classification"
  },
  {
    key: "classificationValidation",
    label: "Classification",
    description: "Background analysis, validation, segmentation, and scoring window selection"
  },
  {
    key: "secondPosePass",
    label: "Second pose pass",
    description: "Analyzer pass for metrics, scores, and coaching"
  },
  {
    key: "diagnostics",
    label: "Diagnostics",
    description: "Diagnostics subprocess and skeleton dataset build"
  }
];
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function toNullableString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function toNullableNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
function isPipelineStageKey(value) {
  return PIPELINE_STAGE_DEFINITIONS.some((stage) => stage.key === value);
}
function createDefaultStage(definition) {
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    status: "pending",
    startedAt: null,
    completedAt: null,
    elapsedMs: null,
    note: null
  };
}
function computeElapsedMs(stage, nowMs) {
  if (typeof stage.elapsedMs === "number" && Number.isFinite(stage.elapsedMs) && stage.elapsedMs >= 0) {
    return stage.elapsedMs;
  }
  const startedMs = stage.startedAt ? Date.parse(stage.startedAt) : NaN;
  if (!Number.isFinite(startedMs)) return null;
  if (stage.completedAt) {
    const completedMs = Date.parse(stage.completedAt);
    if (Number.isFinite(completedMs)) {
      return Math.max(completedMs - startedMs, 0);
    }
  }
  if (stage.status === "running") {
    return Math.max(nowMs - startedMs, 0);
  }
  return null;
}
function createEmptyPipelineTiming(nowIso) {
  return {
    stages: PIPELINE_STAGE_DEFINITIONS.map(createDefaultStage),
    currentStageKey: null,
    totalElapsedMs: 0,
    updatedAt: nowIso || null
  };
}
function extractPipelineTiming(value) {
  const raw = isRecord(value) && isRecord(value.pipelineTiming) ? value.pipelineTiming : isRecord(value) ? value : null;
  if (!raw || !Array.isArray(raw.stages)) {
    return null;
  }
  const stageMap = /* @__PURE__ */ new Map();
  for (const entry of raw.stages) {
    if (!isRecord(entry) || !isPipelineStageKey(entry.key)) continue;
    const definition = PIPELINE_STAGE_DEFINITIONS.find((stage) => stage.key === entry.key);
    if (!definition) continue;
    const status = entry.status;
    stageMap.set(entry.key, {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      status: status === "running" || status === "completed" || status === "failed" ? status : "pending",
      startedAt: toNullableString(entry.startedAt),
      completedAt: toNullableString(entry.completedAt),
      elapsedMs: toNullableNumber(entry.elapsedMs),
      note: toNullableString(entry.note)
    });
  }
  const stages = PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    return stageMap.get(definition.key) || createDefaultStage(definition);
  });
  const currentStageKey = isPipelineStageKey(raw.currentStageKey) ? raw.currentStageKey : null;
  const totalElapsedMs = toNullableNumber(raw.totalElapsedMs);
  const updatedAt = toNullableString(raw.updatedAt);
  return {
    stages,
    currentStageKey,
    totalElapsedMs,
    updatedAt
  };
}
function getPipelineTotalElapsedMs(timing, nowMs = Date.now()) {
  if (!timing) return null;
  const values = timing.stages.map((stage) => computeElapsedMs(stage, nowMs)).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0);
}
function updatePipelineTiming(current, update, nowIso) {
  const next = extractPipelineTiming(current) || createEmptyPipelineTiming(nowIso);
  const effectiveNowIso = nowIso || (/* @__PURE__ */ new Date()).toISOString();
  next.stages = next.stages.map((stage) => {
    if (stage.key !== update.stageKey) return stage;
    const startedAt = update.startedAt !== void 0 ? update.startedAt : update.status === "running" && !stage.startedAt ? effectiveNowIso : stage.startedAt || null;
    const completedAt = update.completedAt !== void 0 ? update.completedAt : update.status === "completed" || update.status === "failed" ? effectiveNowIso : stage.completedAt || null;
    let elapsedMs = update.elapsedMs !== void 0 ? update.elapsedMs : stage.elapsedMs ?? null;
    if ((elapsedMs == null || !Number.isFinite(elapsedMs)) && startedAt && completedAt) {
      const startedMs = Date.parse(startedAt);
      const completedMs = Date.parse(completedAt);
      if (Number.isFinite(startedMs) && Number.isFinite(completedMs)) {
        elapsedMs = Math.max(completedMs - startedMs, 0);
      }
    }
    return {
      ...stage,
      status: update.status,
      startedAt,
      completedAt,
      elapsedMs,
      note: update.note !== void 0 ? update.note : stage.note || null
    };
  });
  const runningStage = next.stages.find((stage) => stage.status === "running");
  next.currentStageKey = runningStage?.key || null;
  next.updatedAt = effectiveNowIso;
  next.totalElapsedMs = getPipelineTotalElapsedMs(next, Date.parse(effectiveNowIso));
  return next;
}
function attachPipelineTiming(payload, timing) {
  if (!timing) return payload;
  return {
    ...payload,
    pipelineTiming: timing
  };
}

// shared/video-validation.ts
var VIDEO_VALIDATION_MODES = ["disabled", "light", "medium", "full"];
function isVideoValidationMode(value) {
  return typeof value === "string" && VIDEO_VALIDATION_MODES.includes(value);
}

// server/model-registry.ts
import fs2 from "fs";
import path2 from "path";
import { createHash, randomUUID } from "crypto";
import { asc, desc as desc2, eq as eq2, inArray } from "drizzle-orm";
var legacyConfigPath = resolveProjectPath("config", "model-registry.config.json");
var legacyManifestPath = resolveProjectPath("model_evaluation_datasets", "manifest.json");
var legacyDatasetFolderPrefix = "model_evaluation_datasets/dataset";
var manualTuningDatasetName = "manual-annotations";
var databaseManifestPath = "database://model-registry";
var defaultConfig = {
  activeModelVersion: "0.1",
  modelVersionChangeDescription: "Initial baseline scoring model release.",
  evaluationDatasetManifestPath: databaseManifestPath
};
var cache = {
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
    warnings: []
  },
  versions: [],
  datasets: [],
  datasetMap: /* @__PURE__ */ new Map()
};
function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function normalizeFilenameToken(value) {
  return path2.basename(String(value || "").trim()).toLowerCase();
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
function parseLegacyConfigFile() {
  try {
    const raw = fs2.readFileSync(legacyConfigPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      activeModelVersion: String(parsed.activeModelVersion || defaultConfig.activeModelVersion),
      modelVersionChangeDescription: String(
        parsed.modelVersionChangeDescription || defaultConfig.modelVersionChangeDescription
      ),
      evaluationDatasetManifestPath: databaseManifestPath
    };
  } catch {
    return defaultConfig;
  }
}
function parseLegacyManifestFile() {
  try {
    const raw = fs2.readFileSync(legacyManifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const datasets = Array.isArray(parsed.datasets) ? parsed.datasets.map((dataset) => ({
      name: String(dataset?.name || "unnamed-dataset"),
      videos: Array.isArray(dataset?.videos) ? dataset.videos.map((video) => ({
        videoId: resolveVideoId(video || {}),
        filename: String(video?.filename || "").trim(),
        movementType: String(video?.movementType || "").trim()
      })).filter((video) => video.filename) : []
    })) : [];
    return {
      activeModelVersion: String(parsed.activeModelVersion || "").trim() || void 0,
      versionHistory: [],
      datasets
    };
  } catch {
    return { datasets: [] };
  }
}
function computeValidation(manifest) {
  const errors = [];
  const warnings = ["Evaluation registry is stored in the database."];
  const filenameCounts = /* @__PURE__ */ new Map();
  const videoIdCounts = /* @__PURE__ */ new Map();
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
  const duplicateFilenames = Array.from(filenameCounts.entries()).filter(([, count]) => count > 1).map(([filename]) => filename).sort();
  const duplicateVideoIds = Array.from(videoIdCounts.entries()).filter(([, count]) => count > 1).map(([videoId]) => videoId).sort();
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
    warnings
  };
}
function buildDatasetMap(manifest) {
  const map = /* @__PURE__ */ new Map();
  for (const dataset of manifest.datasets) {
    for (const video of dataset.videos) {
      const entry = {
        videoId: video.videoId,
        datasetName: dataset.name,
        movementType: video.movementType
      };
      const fullName = String(video.filename || "").trim();
      if (video.videoId) {
        map.set(video.videoId, entry);
      }
      if (!fullName) continue;
      map.set(fullName, entry);
      map.set(normalizeFilenameToken(fullName), entry);
      const legacyPath = `${legacyDatasetFolderPrefix}/${path2.basename(fullName)}`;
      map.set(legacyPath, entry);
      map.set(normalizeFilenameToken(legacyPath), entry);
    }
  }
  return map;
}
async function ensureDefaultVersionRow() {
  const [existing] = await db.select().from(modelRegistryVersions).where(eq2(modelRegistryVersions.modelVersion, defaultConfig.activeModelVersion)).limit(1);
  if (!existing) {
    await db.insert(modelRegistryVersions).values({
      modelVersion: defaultConfig.activeModelVersion,
      description: defaultConfig.modelVersionChangeDescription,
      status: "active",
      activatedAt: /* @__PURE__ */ new Date(),
      ...buildInsertAuditFields(null)
    });
  }
}
async function migrateLegacyFilesystemRegistryIfNeeded() {
  const [versionCountRow] = await db.select({ id: modelRegistryVersions.id }).from(modelRegistryVersions).limit(1);
  const hasVersions = Boolean(versionCountRow?.id);
  const [datasetCountRow] = await db.select({ id: modelRegistryDatasets.id }).from(modelRegistryDatasets).limit(1);
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
      activatedAt: /* @__PURE__ */ new Date(),
      ...buildInsertAuditFields(null)
    }).onConflictDoNothing();
  }
  if (hasDatasets || legacyManifest.datasets.length === 0) {
    return;
  }
  const allAnalyses = await db.select({
    id: analyses.id,
    videoFilename: analyses.videoFilename,
    sourceFilename: analyses.sourceFilename,
    evaluationVideoId: analyses.evaluationVideoId
  }).from(analyses);
  for (const dataset of legacyManifest.datasets) {
    const datasetName = String(dataset.name || "").trim() || manualTuningDatasetName;
    const [datasetRow] = await db.insert(modelRegistryDatasets).values({
      name: datasetName,
      description: "Migrated from legacy manifest",
      source: "legacy-manifest",
      ...buildInsertAuditFields(null)
    }).onConflictDoNothing().returning();
    const targetDataset = datasetRow || (await db.select().from(modelRegistryDatasets).where(eq2(modelRegistryDatasets.name, datasetName)).limit(1))[0];
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
          `${legacyDatasetFolderPrefix}/${analysis.sourceFilename || ""}`
        ].filter(Boolean).some((candidate) => normalizeFilenameToken(String(candidate)) === normalizedFilename);
      });
      if (!matchedAnalysis) continue;
      await db.insert(modelRegistryDatasetItems).values({
        datasetId: targetDataset.id,
        analysisId: matchedAnalysis.id,
        expectedMovement: String(video.movementType || "").trim() || "unknown",
        evaluationVideoId: videoId || matchedAnalysis.evaluationVideoId || null,
        sourceFilename: matchedAnalysis.sourceFilename || path2.basename(filename) || matchedAnalysis.videoFilename,
        ...buildInsertAuditFields(null)
      }).onConflictDoNothing();
      if (videoId && videoId !== String(matchedAnalysis.evaluationVideoId || "").trim()) {
        await db.update(analyses).set({
          evaluationVideoId: videoId,
          ...buildUpdateAuditFields(null)
        }).where(eq2(analyses.id, matchedAnalysis.id));
      }
    }
  }
}
async function loadVersionSummaries() {
  const rows = await db.select().from(modelRegistryVersions).orderBy(desc2(modelRegistryVersions.activatedAt), desc2(modelRegistryVersions.createdAt));
  return rows.map((row) => ({
    id: row.id,
    modelVersion: row.modelVersion,
    description: row.description,
    status: row.status,
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}
async function loadDatasetsAndManifest() {
  const datasetRows = await db.select().from(modelRegistryDatasets).orderBy(asc(modelRegistryDatasets.name));
  const datasetIds = datasetRows.map((row) => row.id);
  const items = datasetIds.length ? await db.select({
    item: modelRegistryDatasetItems,
    analysis: analyses
  }).from(modelRegistryDatasetItems).innerJoin(analyses, eq2(modelRegistryDatasetItems.analysisId, analyses.id)).where(inArray(modelRegistryDatasetItems.datasetId, datasetIds)) : [];
  const itemsByDatasetId = /* @__PURE__ */ new Map();
  for (const row of items) {
    const current = itemsByDatasetId.get(row.item.datasetId) || [];
    current.push(row);
    itemsByDatasetId.set(row.item.datasetId, current);
  }
  const summaries = [];
  const manifestDatasets = [];
  for (const dataset of datasetRows) {
    const rows = itemsByDatasetId.get(dataset.id) || [];
    const movementTypes = Array.from(new Set(rows.map((row) => String(row.item.expectedMovement || "").trim()).filter(Boolean))).sort();
    const videos = rows.map((row) => ({
      videoId: String(row.item.evaluationVideoId || row.analysis.evaluationVideoId || "").trim() || toLegacyVideoId(String(row.item.sourceFilename || row.analysis.sourceFilename || row.analysis.videoFilename || "")),
      filename: String(row.item.sourceFilename || row.analysis.sourceFilename || row.analysis.videoFilename || "").trim(),
      movementType: String(row.item.expectedMovement || "").trim() || "unknown"
    }));
    summaries.push({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      source: dataset.source,
      videoCount: videos.length,
      movementTypes,
      updatedAt: dataset.updatedAt.toISOString()
    });
    manifestDatasets.push({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      source: dataset.source,
      videos
    });
  }
  return {
    datasets: summaries,
    manifest: { datasets: manifestDatasets }
  };
}
async function ensureDraftVersion(activeModelVersion, actorUserId) {
  const nextModelVersion = incrementModelVersion(activeModelVersion);
  const [existing] = await db.select().from(modelRegistryVersions).where(eq2(modelRegistryVersions.modelVersion, nextModelVersion)).limit(1);
  if (!existing) {
    await db.insert(modelRegistryVersions).values({
      modelVersion: nextModelVersion,
      description: `Draft prepared after ${activeModelVersion}`,
      status: "draft",
      ...buildInsertAuditFields(actorUserId || null)
    });
  }
  return nextModelVersion;
}
async function initializeModelRegistryCache() {
  await refreshModelRegistryCache();
}
async function refreshModelRegistryCache() {
  await migrateLegacyFilesystemRegistryIfNeeded();
  await ensureDefaultVersionRow();
  let versions = await loadVersionSummaries();
  let activeVersion = versions.find((version) => version.status === "active");
  if (!activeVersion && versions.length > 0) {
    const fallback = versions[0];
    await db.update(modelRegistryVersions).set({
      status: "active",
      activatedAt: /* @__PURE__ */ new Date(),
      ...buildUpdateAuditFields(null)
    }).where(eq2(modelRegistryVersions.id, fallback.id));
    versions = await loadVersionSummaries();
    activeVersion = versions.find((version) => version.modelVersion === fallback.modelVersion) || versions[0];
  }
  const { datasets, manifest } = await loadDatasetsAndManifest();
  manifest.activeModelVersion = activeVersion?.modelVersion || defaultConfig.activeModelVersion;
  const validation = computeValidation(manifest);
  const config = {
    activeModelVersion: activeVersion?.modelVersion || defaultConfig.activeModelVersion,
    modelVersionChangeDescription: activeVersion?.description || defaultConfig.modelVersionChangeDescription,
    evaluationDatasetManifestPath: databaseManifestPath
  };
  cache = {
    initialized: true,
    config,
    manifest,
    validation,
    versions,
    datasets,
    datasetMap: buildDatasetMap(manifest)
  };
  return {
    storage: "database",
    config,
    versions,
    datasets,
    validation
  };
}
function readModelRegistryConfig() {
  return cache.config;
}
function readEvaluationDatasetManifest(_config) {
  return cache.manifest;
}
function getEvaluationDatasetVideoMap(_config) {
  return cache.datasetMap;
}
function listModelRegistryVersions() {
  return cache.versions;
}
function getModelRegistryOverview() {
  return {
    storage: "database",
    config: cache.config,
    versions: cache.versions,
    datasets: cache.datasets,
    validation: cache.validation
  };
}
async function writeModelRegistryConfig(nextConfig, actorUserId) {
  const activeModelVersion = String(nextConfig.activeModelVersion || "").trim() || defaultConfig.activeModelVersion;
  const description = String(nextConfig.modelVersionChangeDescription || "").trim();
  const [existingTarget] = await db.select().from(modelRegistryVersions).where(eq2(modelRegistryVersions.modelVersion, activeModelVersion)).limit(1);
  if (existingTarget) {
    await db.update(modelRegistryVersions).set({
      description,
      status: "active",
      activatedAt: /* @__PURE__ */ new Date(),
      activatedByUserId: actorUserId || null,
      ...buildUpdateAuditFields(actorUserId || null)
    }).where(eq2(modelRegistryVersions.id, existingTarget.id));
  } else {
    await db.insert(modelRegistryVersions).values({
      modelVersion: activeModelVersion,
      description,
      status: "active",
      activatedAt: /* @__PURE__ */ new Date(),
      activatedByUserId: actorUserId || null,
      ...buildInsertAuditFields(actorUserId || null)
    });
  }
  const activeRows = await db.select().from(modelRegistryVersions).where(eq2(modelRegistryVersions.status, "active"));
  for (const row of activeRows) {
    if (row.modelVersion === activeModelVersion) continue;
    await db.update(modelRegistryVersions).set({
      status: "archived",
      ...buildUpdateAuditFields(actorUserId || null)
    }).where(eq2(modelRegistryVersions.id, row.id));
  }
  await ensureDraftVersion(activeModelVersion, actorUserId || null);
  await refreshModelRegistryCache();
  return cache.config;
}
async function syncVideoForModelTuning(params) {
  const filename = path2.basename(String(params.sourceVideoFilename || "").trim());
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
    await db.delete(modelRegistryDatasetItems).where(eq2(modelRegistryDatasetItems.analysisId, params.analysisId));
    await refreshModelRegistryCache();
    return {
      enabled: false,
      manifestFilename,
      videoId: nextVideoId
    };
  }
  const [analysis] = await db.select().from(analyses).where(eq2(analyses.id, params.analysisId)).limit(1);
  if (!analysis) {
    throw new Error("Analysis not found for model training sync");
  }
  let [dataset] = await db.select().from(modelRegistryDatasets).where(eq2(modelRegistryDatasets.name, datasetName)).limit(1);
  if (!dataset) {
    [dataset] = await db.insert(modelRegistryDatasets).values({
      name: datasetName,
      description: "Manually curated evaluation dataset",
      source: "manual-annotation",
      ...buildInsertAuditFields(actorUserId)
    }).returning();
  }
  await db.delete(modelRegistryDatasetItems).where(eq2(modelRegistryDatasetItems.analysisId, params.analysisId));
  await db.insert(modelRegistryDatasetItems).values({
    datasetId: dataset.id,
    analysisId: params.analysisId,
    annotatorUserId: params.annotatorUserId || null,
    expectedMovement: nextMovementType,
    evaluationVideoId: nextVideoId,
    sourceFilename: analysis.sourceFilename || analysis.videoFilename,
    ...buildInsertAuditFields(actorUserId)
  });
  await refreshModelRegistryCache();
  return {
    enabled: true,
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
function validateEvaluationDatasetManifest(_config) {
  return cache.validation;
}

// server/score-input-params.ts
import fs3 from "fs";
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
  const analyzerPath = resolveProjectPath("python_analysis", "sports", `${configKey.replace(/-/g, "_")}.py`);
  if (!fs3.existsSync(analyzerPath)) {
    analyzerDepsCache.set(configKey, null);
    return null;
  }
  const src = fs3.readFileSync(analyzerPath, "utf8");
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
import fs6 from "fs";

// server/media-storage.ts
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq as eq3 } from "drizzle-orm";
import { randomUUID as randomUUID2 } from "node:crypto";
import fs4 from "node:fs";
import os from "node:os";
import path3 from "node:path";
import { pipeline } from "node:stream/promises";
import { sql as sql3 } from "drizzle-orm";
var VIDEO_STORAGE_MODE_KEY = "videoStorageMode";
var LEGACY_VIDEO_STORAGE_MODE_KEY = "VIDEO_STORAGE_MODE";
var uploadsRoot = resolveProjectPath("uploads");
var avatarUploadsDir = path3.join(uploadsRoot, "avatars");
var cachedR2Client = null;
function isVideoStorageMode(value) {
  return value === "filesystem" || value === "r2";
}
function getDefaultVideoStorageMode() {
  const envValue = String(
    process.env.videoStorageMode || process.env.VIDEO_STORAGE_MODE || ""
  ).trim().toLowerCase();
  if (isVideoStorageMode(envValue)) {
    return envValue;
  }
  const isReplitProduction = Boolean(process.env.REPLIT_DOMAINS) && !Boolean(process.env.REPLIT_DEV_DOMAIN);
  return isReplitProduction ? "r2" : "filesystem";
}
function ensureDirectory(dirPath) {
  if (!fs4.existsSync(dirPath)) {
    fs4.mkdirSync(dirPath, { recursive: true });
  }
}
function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}
function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}
function normalizeKeyPrefix(value, fallback) {
  const raw = String(value || fallback).trim().replace(/^\/+|\/+$/g, "");
  return raw || fallback;
}
function getR2Bucket() {
  const bucket = String(process.env.R2_BUCKET || "").trim();
  if (!bucket) {
    throw new Error("R2_BUCKET is required when videoStorageMode is r2");
  }
  return bucket;
}
function getR2Client() {
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
      secretAccessKey
    }
  });
  return cachedR2Client;
}
function getR2Prefix(kind) {
  return kind === "avatar" ? normalizeKeyPrefix(process.env.R2_PLAYER_AVATAR_FOLDER || process.env.R2_PLAYER_AVATAR || "avatar", "avatar") : normalizeKeyPrefix(process.env.R2_PLAYER_VIDEO_FOLDER || process.env.R2_PLAYER_VIDEO || "video", "video");
}
function buildR2Key(kind, filename) {
  return `${getR2Prefix(kind)}/${String(filename || "").replace(/^\/+/, "")}`;
}
function toR2Reference(key) {
  return `r2://${String(key || "").replace(/^\/+/, "")}`;
}
function parseR2Reference(value) {
  const raw = String(value || "").trim();
  if (!raw.toLowerCase().startsWith("r2://")) {
    return null;
  }
  const key = raw.slice(5).replace(/^\/+/, "");
  return key || null;
}
function getFilesystemPublicPath(storedPath) {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/uploads/")) {
    return raw;
  }
  if (!path3.isAbsolute(raw)) {
    return null;
  }
  const relative = path3.relative(uploadsRoot, raw);
  if (!relative || relative.startsWith("..") || path3.isAbsolute(relative)) {
    return null;
  }
  return `/uploads/${toPosixPath(relative)}`;
}
function getFilesystemLocalPath(storedPath) {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;
  if (path3.isAbsolute(raw)) {
    return raw;
  }
  if (raw.startsWith("/uploads/")) {
    const relative = raw.replace(/^\/uploads\/?/, "");
    return path3.join(uploadsRoot, relative);
  }
  return null;
}
async function downloadR2ObjectToFile(key, targetPath) {
  ensureDirectory(path3.dirname(targetPath));
  const client = getR2Client();
  const response = await client.send(new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: key
  }));
  if (!response.Body) {
    throw new Error(`R2 object not found: ${key}`);
  }
  const writeStream = fs4.createWriteStream(targetPath);
  await pipeline(response.Body, writeStream);
}
async function migrateLegacyVideoStorageModeSetting() {
  await db.execute(sql3`
    insert into app_settings (
      key,
      value,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    select
      ${VIDEO_STORAGE_MODE_KEY},
      legacy.value,
      legacy.created_at,
      legacy.updated_at,
      legacy.created_by_user_id,
      legacy.updated_by_user_id
    from app_settings as legacy
    where legacy.key = ${LEGACY_VIDEO_STORAGE_MODE_KEY}
      and not exists (
        select 1
        from app_settings as current_setting
        where current_setting.key = ${VIDEO_STORAGE_MODE_KEY}
      )
    on conflict (key) do nothing
  `);
  await db.delete(appSettings).where(eq3(appSettings.key, LEGACY_VIDEO_STORAGE_MODE_KEY));
}
async function ensureVideoStorageModeSetting() {
  await migrateLegacyVideoStorageModeSetting();
  const defaultMode = getDefaultVideoStorageMode();
  const [existing] = await db.select().from(appSettings).where(eq3(appSettings.key, VIDEO_STORAGE_MODE_KEY)).limit(1);
  const storedMode = existing?.value && typeof existing.value === "object" ? String(existing.value.mode || "").trim().toLowerCase() : "";
  if (isVideoStorageMode(storedMode)) {
    return storedMode;
  }
  await db.insert(appSettings).values({
    key: VIDEO_STORAGE_MODE_KEY,
    value: { mode: defaultMode },
    ...buildInsertAuditFields(null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: { mode: defaultMode },
      ...buildUpdateAuditFields(null)
    }
  });
  return defaultMode;
}
async function getVideoStorageMode() {
  await migrateLegacyVideoStorageModeSetting();
  const [existing] = await db.select().from(appSettings).where(eq3(appSettings.key, VIDEO_STORAGE_MODE_KEY)).limit(1);
  const storedMode = existing?.value && typeof existing.value === "object" ? String(existing.value.mode || "").trim().toLowerCase() : "";
  if (isVideoStorageMode(storedMode)) {
    return storedMode;
  }
  return ensureVideoStorageModeSetting();
}
async function setVideoStorageMode(mode, actorUserId) {
  await migrateLegacyVideoStorageModeSetting();
  await db.insert(appSettings).values({
    key: VIDEO_STORAGE_MODE_KEY,
    value: { mode },
    ...buildInsertAuditFields(actorUserId)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: { mode },
      ...buildUpdateAuditFields(actorUserId)
    }
  });
}
function buildFilesystemVideoPath(filename) {
  ensureDirectory(uploadsRoot);
  return path3.join(uploadsRoot, filename);
}
function buildFilesystemAvatarPath(filename) {
  ensureDirectory(avatarUploadsDir);
  return path3.join(avatarUploadsDir, filename);
}
async function storeAvatarBuffer(params) {
  const mode = await getVideoStorageMode();
  const extension = path3.extname(String(params.originalName || "")).trim() || ".jpg";
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  if (mode === "filesystem") {
    const targetPath = buildFilesystemAvatarPath(filename);
    fs4.writeFileSync(targetPath, params.buffer);
    return `/uploads/avatars/${filename}`;
  }
  const key = buildR2Key("avatar", filename);
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: params.buffer,
    ContentType: params.contentType || "application/octet-stream"
  }));
  return toR2Reference(key);
}
async function storeVideoBuffer(params) {
  const mode = await getVideoStorageMode();
  if (mode === "filesystem") {
    const targetPath = buildFilesystemVideoPath(params.filename);
    fs4.writeFileSync(targetPath, params.buffer);
    return targetPath;
  }
  const key = buildR2Key("video", params.filename);
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: params.buffer,
    ContentType: params.contentType || "application/octet-stream"
  }));
  return toR2Reference(key);
}
async function resolveMediaUrl(storedPath) {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;
  if (isHttpUrl(raw)) {
    return raw;
  }
  const r2Key = parseR2Reference(raw);
  if (r2Key) {
    return getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: r2Key
      }),
      { expiresIn: 60 * 60 }
    );
  }
  return getFilesystemPublicPath(raw) || raw;
}
async function withLocalMediaFile(storedPath, fallbackFilename, fn) {
  const raw = String(storedPath || "").trim();
  if (!raw) {
    throw new Error("Media path is empty");
  }
  const r2Key = parseR2Reference(raw);
  if (!r2Key) {
    const localPath = getFilesystemLocalPath(raw);
    if (!localPath || !fs4.existsSync(localPath)) {
      throw new Error("Media file not found");
    }
    return fn(localPath);
  }
  const extension = path3.extname(String(fallbackFilename || r2Key || "")).trim() || ".bin";
  const tempPath = path3.join(os.tmpdir(), `swingai-${randomUUID2()}${extension}`);
  await downloadR2ObjectToFile(r2Key, tempPath);
  try {
    return await fn(tempPath);
  } finally {
    try {
      fs4.unlinkSync(tempPath);
    } catch {
    }
  }
}
async function deleteStoredMedia(storedPath) {
  const raw = String(storedPath || "").trim();
  if (!raw) return;
  const r2Key = parseR2Reference(raw);
  if (r2Key) {
    await getR2Client().send(new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: r2Key
    }));
    return;
  }
  if (isHttpUrl(raw)) {
    return;
  }
  const localPath = getFilesystemLocalPath(raw);
  if (localPath && fs4.existsSync(localPath)) {
    fs4.unlinkSync(localPath);
  }
}
function isStoredMediaLocallyAccessible(storedPath) {
  const localPath = getFilesystemLocalPath(String(storedPath || ""));
  return Boolean(localPath && fs4.existsSync(localPath));
}

// server/tennis-upload-validation.ts
import { execFile } from "child_process";
import fs5 from "fs";
var PYTHON_VALIDATION_TIMEOUT_MS = Number(process.env.PYTHON_VALIDATION_TIMEOUT_MS || 36e5);
var PYTHON_VALIDATION_MAX_BUFFER = 10 * 1024 * 1024;
var LIGHT_VALIDATION_SAMPLE_COUNT = Number(process.env.PYTHON_LIGHT_VALIDATION_SAMPLE_COUNT || 8);
var MEDIUM_VALIDATION_SAMPLE_COUNT = Number(process.env.PYTHON_MEDIUM_VALIDATION_SAMPLE_COUNT || 24);
function parsePythonErrorPayload(raw) {
  const lines = String(raw || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index];
    if (!candidate.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && (typeof parsed.error === "string" || typeof parsed.traceback === "string")) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}
function summarizePythonFailure(context, error, stderr) {
  const parsedPayload = parsePythonErrorPayload(stderr);
  if (parsedPayload?.error) {
    return new Error(`${context}: ${parsedPayload.error}`);
  }
  if (error?.killed && error?.signal === "SIGTERM") {
    return new Error(
      `${context}: validation timed out after ${Math.round(PYTHON_VALIDATION_TIMEOUT_MS / 1e3)}s on the current runtime`
    );
  }
  const stderrLines = String(stderr || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter(
    (line) => !/^INFO: Created TensorFlow Lite XNNPACK delegate for CPU\.?$/i.test(line)
  ).filter(
    (line) => !/Feedback manager requires a model with a single signature inference/i.test(line)
  ).filter(
    (line) => !/Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI/i.test(line)
  );
  if (stderrLines.length > 0) {
    return new Error(`${context}: ${stderrLines[stderrLines.length - 1]}`);
  }
  return new Error(`${context}: ${error?.message || "command failed"}`);
}
function resolvePythonExecutable() {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs5.existsSync(envExecutable)) {
    return envExecutable;
  }
  const localCandidates = [
    resolveProjectPath(".venv", "bin", "python3"),
    resolveProjectPath(".venv", "bin", "python")
  ];
  for (const candidate of localCandidates) {
    if (fs5.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python3";
}
function runPythonSportValidation(videoPath, sportName, sampleCount) {
  return new Promise((resolve2, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    execFile(
      pythonExecutable,
      [
        "-m",
        "python_analysis.run_sport_validation",
        videoPath,
        "--sport",
        sportName.toLowerCase(),
        "--sample-count",
        String(Math.max(1, sampleCount))
      ],
      {
        cwd: PROJECT_ROOT,
        timeout: PYTHON_VALIDATION_TIMEOUT_MS,
        maxBuffer: PYTHON_VALIDATION_MAX_BUFFER
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error("Python sport validation stderr:", stderr);
          reject(summarizePythonFailure("Python sport validation failed", error, stderr));
          return;
        }
        try {
          const result = JSON.parse(String(stdout || "").trim());
          if (result?.error) {
            reject(new Error(result.error));
            return;
          }
          resolve2(result);
        } catch {
          if (stderr) console.error("Python sport validation stderr:", stderr);
          reject(new Error("Failed to parse sport validation results"));
        }
      }
    );
  });
}
function getTennisUploadValidationSampleCount(mode) {
  if (mode !== "light" && mode !== "medium") return null;
  return mode === "light" ? LIGHT_VALIDATION_SAMPLE_COUNT : MEDIUM_VALIDATION_SAMPLE_COUNT;
}
async function validateTennisVideoUpload(videoPath, validationMode, _dominantProfile) {
  if (validationMode === "disabled") {
    return { accepted: true, reason: null };
  }
  if (validationMode === "full") {
    return { accepted: true, reason: null };
  }
  const sampleCount = getTennisUploadValidationSampleCount(validationMode);
  if (!sampleCount) {
    return { accepted: true, reason: null };
  }
  const validation = await runPythonSportValidation(videoPath, "tennis", sampleCount);
  if (validation.valid) {
    return { accepted: true, reason: null };
  }
  return {
    accepted: false,
    reason: validation.reason || "Only tennis videos are allowed. Upload a clear tennis stroke or rally clip."
  };
}

// server/sport-availability.ts
import { and as and2, asc as asc2, eq as eq4 } from "drizzle-orm";
var PRIMARY_ENABLED_SPORT_NAME = "Tennis";
function normalizeSportName(value) {
  return String(value || "").trim().toLowerCase();
}
function isPrimaryEnabledSportName(value) {
  return normalizeSportName(value) === normalizeSportName(PRIMARY_ENABLED_SPORT_NAME);
}
function isSportEnabledRecord(sport) {
  if (!sport) return false;
  if (typeof sport.enabled === "boolean") return sport.enabled;
  return Boolean(sport.isActive);
}
async function listSports(options) {
  const includeDisabled = Boolean(options?.includeDisabled);
  const query = db.select().from(sports).orderBy(asc2(sports.sortOrder), asc2(sports.name));
  if (includeDisabled) {
    return query;
  }
  return db.select().from(sports).where(eq4(sports.enabled, true)).orderBy(asc2(sports.sortOrder), asc2(sports.name));
}
async function getSportById(sportId) {
  const [sport] = await db.select().from(sports).where(eq4(sports.id, sportId)).limit(1);
  return sport ?? null;
}
async function getEnabledPrimarySport() {
  const [sport] = await db.select().from(sports).where(and2(eq4(sports.enabled, true), eq4(sports.name, PRIMARY_ENABLED_SPORT_NAME))).limit(1);
  return sport ?? null;
}
function mapSportForApi(sport) {
  return {
    ...sport,
    enabled: isSportEnabledRecord(sport)
  };
}

// shared/pose-landmarker.ts
function isPoseLandmarkerModel(value) {
  return value === "lite" || value === "full" || value === "heavy";
}

// server/pose-landmarker-settings.ts
import { eq as eq5 } from "drizzle-orm";
var POSE_LANDMARKER_MODEL_KEY = "poseLandmarkerModel";
var DEFAULT_POSE_LANDMARKER_MODEL = "lite";
var POSE_LANDMARKER_ENV_KEY = "POSE_LANDMARKER_MODEL";
async function getPoseLandmarkerModel(actorUserId) {
  const [setting] = await db.select().from(appSettings).where(eq5(appSettings.key, POSE_LANDMARKER_MODEL_KEY)).limit(1);
  const rawModel = setting?.value && typeof setting.value === "object" ? setting.value.model : null;
  if (isPoseLandmarkerModel(rawModel)) {
    return rawModel;
  }
  await db.insert(appSettings).values({
    key: POSE_LANDMARKER_MODEL_KEY,
    value: { model: DEFAULT_POSE_LANDMARKER_MODEL },
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoNothing();
  return DEFAULT_POSE_LANDMARKER_MODEL;
}
async function setPoseLandmarkerModel(model, actorUserId) {
  await db.insert(appSettings).values({
    key: POSE_LANDMARKER_MODEL_KEY,
    value: { model },
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: { model },
      ...buildUpdateAuditFields(actorUserId || null)
    }
  });
}
async function getPoseLandmarkerPythonEnv(actorUserId) {
  const model = await getPoseLandmarkerModel(actorUserId);
  return {
    [POSE_LANDMARKER_ENV_KEY]: model
  };
}

// server/analysis-engine.ts
var VIDEO_VALIDATION_MODE_KEY = "videoValidationMode";
var ANALYSIS_FPS_MODE_KEY = "analysisFpsMode";
var ASYNC_METRIC_ENRICHMENT_KEYS_BY_CONFIG = {
  "tennis-forehand": ["elbowAngle"],
  "tennis-backhand": ["elbowAngle"],
  "tennis-volley": ["rhythmConsistency"],
  "tennis-game": ["rallyLength"]
};
function isAnalysisFpsMode(value) {
  return value === "3fps" || value === "6fps" || value === "12fps" || value === "15fps" || value === "24fps" || value === "30fps" || value === "full";
}
function isAnalysisFpsStep(value) {
  return value === "step1" || value === "step2" || value === "step3";
}
function shouldUseCoreMetricComputation(configKey) {
  return String(configKey || "").trim().toLowerCase().startsWith("tennis-");
}
function hasPendingAsyncMetricEnrichment(configKey, metricValues) {
  const requiredKeys = ASYNC_METRIC_ENRICHMENT_KEYS_BY_CONFIG[configKey] || [];
  if (!requiredKeys.length) return false;
  return requiredKeys.some((key) => !Number.isFinite(Number(metricValues?.[key])));
}
function buildValidationScreeningSnapshot(validationMode) {
  const uploadGuardSampleCount = getTennisUploadValidationSampleCount(validationMode);
  return {
    uploadGuardMode: validationMode,
    uploadGuardApplied: uploadGuardSampleCount != null,
    uploadGuardSampleCount,
    pipelineValidationMode: validationMode,
    pipelineValidationApplied: validationMode !== "disabled"
  };
}
function mergeValidationScreeningSnapshot(diagnosticsPayload, validationScreening) {
  if (!validationScreening) return diagnosticsPayload;
  return {
    ...diagnosticsPayload,
    validationScreening
  };
}
function coerceLowImpactStep(value) {
  if (isAnalysisFpsStep(value)) return value;
  if (isAnalysisFpsMode(value)) {
    if (value === "15fps") return "step2";
    if (value === "12fps" || value === "6fps" || value === "3fps") return "step3";
    return "step1";
  }
  return "step2";
}
function coerceHighImpactStep(value) {
  if (isAnalysisFpsStep(value)) return value;
  if (isAnalysisFpsMode(value)) {
    if (value === "15fps") return "step2";
    if (value === "12fps" || value === "6fps" || value === "3fps") return "step3";
    return "step1";
  }
  return "step1";
}
var DEFAULT_PIPELINE_CONFIG_KEY = "tennis-forehand";
var DEFAULT_PIPELINE_MODEL_VERSION = "0.1";
function isPipelineStageStatus(value) {
  return value === "pending" || value === "running" || value === "completed" || value === "failed";
}
function parsePipelineProgressLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.type !== "pipeline_timing") return null;
    if (!isPipelineStageKey(parsed.stageKey) || !isPipelineStageStatus(parsed.status)) return null;
    return {
      type: "pipeline_timing",
      stageKey: parsed.stageKey,
      status: parsed.status,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
      completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      elapsedMs: Number.isFinite(Number(parsed.elapsedMs)) ? Number(parsed.elapsedMs) : null,
      note: typeof parsed.note === "string" ? parsed.note : null
    };
  } catch {
    return null;
  }
}
async function upsertAnalysisDiagnosticsPayload(analysisId, aiDiagnostics, options = {}) {
  const [existingRow] = await db.select({
    id: metrics.id,
    configKey: metrics.configKey,
    modelVersion: metrics.modelVersion
  }).from(metrics).where(eq6(metrics.analysisId, analysisId)).orderBy(desc3(metrics.createdAt)).limit(1);
  const configKey = options.configKey || existingRow?.configKey || DEFAULT_PIPELINE_CONFIG_KEY;
  const modelVersion = options.modelVersion || existingRow?.modelVersion || DEFAULT_PIPELINE_MODEL_VERSION;
  if (existingRow) {
    await db.update(metrics).set({
      configKey,
      modelVersion,
      aiDiagnostics,
      ...buildUpdateAuditFields(options.auditActorUserId ?? null)
    }).where(eq6(metrics.id, existingRow.id));
    return;
  }
  await db.insert(metrics).values({
    analysisId,
    configKey,
    modelVersion,
    aiDiagnostics,
    ...buildInsertAuditFields(options.auditActorUserId ?? null)
  });
}
async function persistPipelineTimingUpdate(analysisId, update, options = {}) {
  let basePayload = {};
  let baseTiming = options.existingTiming || null;
  if (!baseTiming) {
    const [existingRow] = await db.select({ aiDiagnostics: metrics.aiDiagnostics }).from(metrics).where(eq6(metrics.analysisId, analysisId)).orderBy(desc3(metrics.createdAt)).limit(1);
    if (existingRow?.aiDiagnostics && typeof existingRow.aiDiagnostics === "object") {
      basePayload = existingRow.aiDiagnostics;
      baseTiming = extractPipelineTiming(basePayload);
    }
  }
  const nextTiming = updatePipelineTiming(baseTiming, update);
  const nextPayload = attachPipelineTiming(basePayload, nextTiming);
  await upsertAnalysisDiagnosticsPayload(analysisId, nextPayload, options);
  return nextTiming;
}
async function seedUploadPipelineTiming(analysisId, uploadTiming, options = {}) {
  return persistPipelineTimingUpdate(
    analysisId,
    {
      stageKey: "upload",
      status: "completed",
      startedAt: uploadTiming.startedAt,
      completedAt: uploadTiming.completedAt,
      elapsedMs: uploadTiming.elapsedMs
    },
    options
  );
}
async function resolveLockedMovementForRepeatUpload(analysis) {
  if (!analysis.userId || !analysis.sportId) return null;
  const hashValue = String(analysis.videoContentHash || "").trim();
  if (hashValue) {
    const [priorByHash] = await db.select({ detectedMovement: analyses.detectedMovement }).from(analyses).where(
      and3(
        eq6(analyses.userId, analysis.userId),
        eq6(analyses.sportId, analysis.sportId),
        eq6(analyses.status, "completed"),
        ne(analyses.id, analysis.id),
        isNotNull(analyses.detectedMovement),
        eq6(analyses.videoContentHash, hashValue)
      )
    ).orderBy(desc3(analyses.createdAt)).limit(1);
    const movementByHash = String(priorByHash?.detectedMovement || "").trim();
    if (movementByHash.length > 0) {
      return movementByHash;
    }
  }
  const filenameCandidates = [analysis.sourceFilename, analysis.videoFilename].map((value) => String(value || "").trim()).filter((value) => value.length > 0);
  if (!filenameCandidates.length) return null;
  const filenamePredicates = filenameCandidates.map(
    (candidate) => or(eq6(analyses.videoFilename, candidate), eq6(analyses.sourceFilename, candidate))
  );
  const [prior] = await db.select({ detectedMovement: analyses.detectedMovement }).from(analyses).where(
    and3(
      eq6(analyses.userId, analysis.userId),
      eq6(analyses.sportId, analysis.sportId),
      eq6(analyses.status, "completed"),
      ne(analyses.id, analysis.id),
      isNotNull(analyses.detectedMovement),
      filenamePredicates.length === 1 ? filenamePredicates[0] : or(...filenamePredicates)
    )
  ).orderBy(desc3(analyses.createdAt)).limit(1);
  const lockedMovement = String(prior?.detectedMovement || "").trim();
  return lockedMovement.length > 0 ? lockedMovement : null;
}
async function computeVideoContentHash(videoPath) {
  if (!videoPath || !fs6.existsSync(videoPath)) return null;
  const hash = createHash2("sha256");
  return await new Promise((resolve2, reject) => {
    const stream = fs6.createReadStream(videoPath);
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
    (candidate) => or(eq6(analyses.videoFilename, candidate), eq6(analyses.sourceFilename, candidate))
  );
  const duplicateMatchers = [];
  if (hashValue) {
    duplicateMatchers.push(eq6(analyses.videoContentHash, hashValue));
  }
  if (filenamePredicates.length === 1) {
    duplicateMatchers.push(filenamePredicates[0]);
  } else if (filenamePredicates.length > 1) {
    duplicateMatchers.push(or(...filenamePredicates));
  }
  if (!duplicateMatchers.length) return null;
  const conditions = [
    eq6(analyses.userId, analysis.userId),
    eq6(analyses.sportId, analysis.sportId),
    eq6(analyses.status, "completed"),
    ne(analyses.id, analysis.id),
    duplicateMatchers.length === 1 ? duplicateMatchers[0] : or(...duplicateMatchers)
  ];
  if (analysis.movementId) {
    conditions.push(eq6(analyses.movementId, analysis.movementId));
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
  }).from(analyses).leftJoin(metrics, eq6(metrics.analysisId, analyses.id)).leftJoin(coachingInsights, eq6(coachingInsights.analysisId, analyses.id)).where(and3(...conditions)).orderBy(desc3(analyses.createdAt)).limit(1);
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
function normalizeMetricScaleForPersistence(metricKey, value) {
  return normalizeMetricValueToTenScale(metricKey, value);
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
async function loadUserAnalysisPreferences(userId) {
  if (!userId) {
    return {
      dominantProfile: null,
      userMetricPreferences: null
    };
  }
  const [profile] = await db.select({
    dominantProfile: users.dominantProfile,
    selectedMetricKeys: users.selectedMetricKeys,
    selectedMetricKeysBySport: users.selectedMetricKeysBySport
  }).from(users).where(eq6(users.id, userId)).limit(1);
  return {
    dominantProfile: profile?.dominantProfile ?? null,
    userMetricPreferences: {
      selectedMetricKeys: Array.isArray(profile?.selectedMetricKeys) ? profile.selectedMetricKeys : [],
      selectedMetricKeysBySport: profile?.selectedMetricKeysBySport && typeof profile.selectedMetricKeysBySport === "object" ? profile.selectedMetricKeysBySport : {}
    }
  };
}
var COACHING_FACTOR_DEFINITIONS = [
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
  { key: "recover", label: "Recover", section: "movement", inputKey: "Recover" }
];
var DRILL_SUGGESTION_BY_METRIC = [
  {
    keys: ["reactionTime", "splitStepTime"],
    message: "Add split-step timing and live-reaction drills so your first move starts earlier."
  },
  {
    keys: ["balanceScore", "stanceAngle", "recoveryTime"],
    message: "Use balance and recovery footwork drills to stabilize your base before and after contact."
  },
  {
    keys: ["hipRotationSpeed", "shoulderRotation", "shoulderRotationSpeed"],
    message: "Work on hip-to-shoulder sequencing drills to create cleaner rotation through the shot."
  },
  {
    keys: ["contactDistance", "contactHeight", "contactTiming"],
    message: "Run spacing and contact-point reps to make your strike window more repeatable."
  },
  {
    keys: ["racketLagAngle", "swingPathAngle", "spinRate"],
    message: "Use shadow swings and guided path drills to refine racket delivery and shape at contact."
  },
  {
    keys: ["ballSpeed", "shotSpeed", "wristSpeed"],
    message: "Build controlled acceleration with progressive speed reps instead of chasing power too early."
  }
];
function toSportPreferenceKey(configKey) {
  return String(configKey || "").split("-")[0]?.trim().toLowerCase() || "";
}
function titleCase(value) {
  return String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().replace(/\b\w/g, (ch) => ch.toUpperCase());
}
function formatScore10(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(1)}/10`;
}
function formatMetricValue(value, unit) {
  if (unit.startsWith("/")) {
    return `${value.toFixed(1)}${unit}`;
  }
  if (unit === "%") {
    return `${Math.round(value)}%`;
  }
  const decimals = Math.abs(value) >= 100 ? 0 : 1;
  return unit ? `${value.toFixed(decimals)} ${unit}` : value.toFixed(decimals);
}
function formatRange(range, unit) {
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
  return unit ? `${min.toFixed(decimals)}-${max.toFixed(decimals)} ${unit}` : `${min.toFixed(decimals)}-${max.toFixed(decimals)}`;
}
function resolveSelectedMetricKeysForCoaching(configKey, preferences) {
  if (!preferences) return [];
  const sportKey = toSportPreferenceKey(configKey);
  const scoped = sportKey ? preferences.selectedMetricKeysBySport?.[sportKey] : null;
  const fallback = Array.isArray(preferences.selectedMetricKeys) ? preferences.selectedMetricKeys : [];
  const base = Array.isArray(scoped) && scoped.length > 0 ? scoped : fallback;
  return Array.from(new Set(base.map((key) => String(key || "").trim()).filter(Boolean)));
}
function buildMetricSnapshotMap(configKey, metricValues) {
  const config = getSportConfig(configKey);
  const metricDefs = new Map(
    (config?.metrics || []).map((metric) => [canonicalKey4(metric.key), metric])
  );
  const snapshots = /* @__PURE__ */ new Map();
  for (const [rawKey, rawValue] of Object.entries(metricValues || {})) {
    const key = String(rawKey || "").trim();
    const value = Number(rawValue);
    if (!key || !Number.isFinite(value)) continue;
    const def = metricDefs.get(canonicalKey4(key));
    const optimalRange = def?.optimalRange;
    const inRange = !!(optimalRange && Number.isFinite(optimalRange[0]) && Number.isFinite(optimalRange[1]) && value >= optimalRange[0] && value <= optimalRange[1]);
    snapshots.set(key, {
      key,
      label: def?.label || titleCase(key),
      unit: def?.unit || "",
      value,
      optimalRange,
      inRange
    });
  }
  return snapshots;
}
function extractCoachingFactors(scoreInputs, scoreOutputs) {
  if (!scoreInputs || !scoreOutputs) return [];
  return COACHING_FACTOR_DEFINITIONS.map((definition) => {
    const sectionOutputs = scoreOutputs[definition.section];
    const components = sectionOutputs && typeof sectionOutputs === "object" ? sectionOutputs.components : null;
    const rawScore = components && typeof components === "object" ? components[definition.key] : null;
    const score = Number(rawScore);
    if (!Number.isFinite(score)) return null;
    const sectionInputs = scoreInputs[definition.section];
    const detail = sectionInputs && typeof sectionInputs === "object" ? sectionInputs[definition.inputKey] : null;
    const parameters = detail && typeof detail === "object" && Array.isArray(detail.parameters) ? detail.parameters.map((item) => String(item || "").trim()).filter(Boolean) : [];
    return {
      ...definition,
      score,
      parameters
    };
  }).filter((item) => item !== null).sort((a, b) => b.score - a.score);
}
function chooseSignals(factor, selectedMetricKeys, snapshots, mode) {
  const selectedCanonical = new Set(selectedMetricKeys.map((key) => canonicalKey4(key)));
  const factorParameterCanon = new Set((factor?.parameters || []).map((key) => canonicalKey4(key)));
  const all = [...snapshots.values()].filter(
    (snapshot) => mode === "positive" ? snapshot.inRange : !snapshot.inRange
  );
  const prioritized = all.map((snapshot) => ({
    snapshot,
    selected: selectedCanonical.has(canonicalKey4(snapshot.key)),
    linked: factorParameterCanon.has(canonicalKey4(snapshot.key))
  })).sort((left, right) => {
    if (left.selected !== right.selected) return left.selected ? -1 : 1;
    if (left.linked !== right.linked) return left.linked ? -1 : 1;
    return left.snapshot.label.localeCompare(right.snapshot.label, void 0, { sensitivity: "base" });
  }).map((item) => item.snapshot);
  return prioritized.slice(0, 2);
}
function metricSignalText(snapshot, mode) {
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
function buildTrainingSuggestion(parameters, selectedSignals) {
  const parameterCanon = new Set(parameters.map((key) => canonicalKey4(key)));
  const matched = DRILL_SUGGESTION_BY_METRIC.find(
    (entry) => entry.keys.some((key) => parameterCanon.has(canonicalKey4(key)))
  );
  const trackedMetrics = selectedSignals.map((snapshot) => snapshot.label);
  const trackLine = trackedMetrics.length > 0 ? ` Keep an eye on ${trackedMetrics.join(trackedMetrics.length > 1 ? " and " : "")} across your next few sessions so the improvement is measurable.` : "";
  return `${matched?.message || "Build the next training block around the weakest score factor, then recheck the supporting metrics after each session."}${trackLine}`;
}
function buildPersonalizedCoaching(args) {
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
    { label: "Movement", score: Number(args.scoreOutputs?.movement?.overall) }
  ].filter((entry) => Number.isFinite(entry.score));
  const bestSection = sectionScores.slice().sort((a, b) => b.score - a.score)[0] || null;
  const weakestSection = sectionScores.slice().sort((a, b) => a.score - b.score)[0] || null;
  const positiveSignals = chooseSignals(bestFactor, selectedMetricKeys, metricSnapshots, "positive");
  const improvementSignals = chooseSignals(weakestFactor, selectedMetricKeys, metricSnapshots, "improvement");
  const intro = args.overallScore != null && args.overallScore >= 8 ? "Excellent work. This session shows high-quality patterns you can trust and build on." : args.overallScore != null && args.overallScore >= 6.5 ? "There is a strong base here, and several indicators are moving in the right direction." : "There is still work to do, but this session already shows a few encouraging building blocks.";
  const strengthLines = [intro];
  if (bestSection && bestFactor) {
    strengthLines.push(
      `${bestSection.label} leads this session at ${formatScore10(bestSection.score)}, with ${bestFactor.label} setting the tone at ${formatScore10(bestFactor.score)}.`
    );
  }
  if (positiveSignals.length > 0) {
    strengthLines.push(`Shout-out: ${positiveSignals.map((signal) => metricSignalText(signal, "positive")).join("; ")}. These are the indicators to keep owning.`);
  } else if (bestFactor?.parameters?.length) {
    strengthLines.push(`Shout-out: the indicators feeding ${bestFactor.label} are giving you a strong platform to build from.`);
  }
  const improvementLines = [];
  if (weakestSection && weakestFactor) {
    improvementLines.push(
      `${weakestSection.label} is the clearest opportunity right now at ${formatScore10(weakestSection.score)}, especially ${weakestFactor.label} at ${formatScore10(weakestFactor.score)}.`
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
    simpleExplanation
  };
}
function hasAllRequiredUploadDiagnosticsMetrics(metricValues) {
  for (const key of REQUIRED_UPLOAD_DIAGNOSTIC_METRIC_KEYS) {
    if (!Number.isFinite(Number(metricValues[key]))) {
      return false;
    }
  }
  return true;
}
function resolvePythonExecutable2() {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs6.existsSync(envExecutable)) {
    return envExecutable;
  }
  const localCandidates = [
    resolveProjectPath(".venv", "bin", "python3"),
    resolveProjectPath(".venv", "bin", "python")
  ];
  for (const candidate of localCandidates) {
    if (fs6.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python3";
}
function runPythonAnalysis(videoPath, sportName, movementName, validationMode, analysisFpsSnapshot, metricComputationMode, dominantProfile, onProgress) {
  return new Promise((resolve2, reject) => {
    void (async () => {
      const pythonExecutable = resolvePythonExecutable2();
      const poseEnv = await getPoseLandmarkerPythonEnv();
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
        metricComputationMode
      ];
      const dominant = String(dominantProfile || "").trim().toLowerCase();
      if (dominant === "right" || dominant === "left") {
        args.push("--dominant-profile", dominant);
      }
      const child = spawn(pythonExecutable, args, {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...poseEnv }
      });
      let stdout = "";
      let stderr = "";
      let stderrBuffer = "";
      let progressChain = Promise.resolve();
      let settled = false;
      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        child.kill("SIGKILL");
      }, 36e5);
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        const text2 = chunk.toString();
        stderr += text2;
        stderrBuffer += text2;
        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || "";
        for (const line of lines) {
          const event = parsePipelineProgressLine(line);
          if (!event || !onProgress) continue;
          progressChain = progressChain.then(() => Promise.resolve(onProgress(event))).catch((error) => {
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
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve2(result);
        } catch {
          if (stderr) console.error("Python analysis stderr:", stderr);
          reject(new Error("Failed to parse analysis results"));
        }
      });
    })().catch((error) => {
      reject(error);
    });
  });
}
function runPythonMetricEnrichment(videoPath, configKey, analysisArtifactPath) {
  return new Promise((resolve2, reject) => {
    const pythonExecutable = resolvePythonExecutable2();
    const args = [
      "-m",
      "python_analysis.run_metric_enrichment",
      videoPath,
      "--config-key",
      configKey,
      "--analysis-artifact",
      analysisArtifactPath
    ];
    const child = spawn(pythonExecutable, args, {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, 36e5);
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
        resolve2(result);
      } catch {
        if (stderr) console.error("Python metric enrichment stderr:", stderr);
        reject(new Error("Failed to parse metric enrichment results"));
      }
    });
  });
}
async function backfillAnalysisEnrichment(args) {
  const enrichmentStartedAt = Date.now();
  let pipelineTiming = await persistPipelineTimingUpdate(
    args.analysisId,
    {
      stageKey: "diagnostics",
      status: "running",
      startedAt: new Date(enrichmentStartedAt).toISOString()
    },
    {
      configKey: args.configKey,
      modelVersion: args.modelVersion,
      auditActorUserId: args.auditActorUserId
    }
  );
  try {
    const [analysisRow] = await db.select({
      userId: analyses.userId,
      detectedMovement: analyses.detectedMovement
    }).from(analyses).where(eq6(analyses.id, args.analysisId)).limit(1);
    const [metricRow] = await db.select({
      id: metrics.id,
      configKey: metrics.configKey,
      modelVersion: metrics.modelVersion,
      overallScore: metrics.overallScore,
      metricValues: metrics.metricValues,
      scoreOutputs: metrics.scoreOutputs,
      aiDiagnostics: metrics.aiDiagnostics
    }).from(metrics).where(eq6(metrics.analysisId, args.analysisId)).orderBy(desc3(metrics.createdAt)).limit(1);
    const configKey = metricRow?.configKey || args.configKey || DEFAULT_PIPELINE_CONFIG_KEY;
    const analysisArtifactPath = String(args.analysisArtifactPath || "").trim();
    const shouldRunMetricEnrichment = Boolean(
      analysisArtifactPath && metricRow && hasPendingAsyncMetricEnrichment(
        configKey,
        metricRow.metricValues || {}
      )
    );
    const [diagnosticsResult, metricEnrichmentResult] = await Promise.allSettled([
      runPythonDiagnostics(
        args.videoPath,
        args.sportName,
        args.movementName,
        args.dominantProfile,
        args.analysisArtifactPath
      ),
      shouldRunMetricEnrichment ? runPythonMetricEnrichment(args.videoPath, configKey, analysisArtifactPath) : Promise.resolve(null)
    ]);
    const diagnosticsPayload = diagnosticsResult.status === "fulfilled" ? diagnosticsResult.value : null;
    const diagnosticsError = diagnosticsResult.status === "rejected" ? diagnosticsResult.reason : null;
    const metricEnrichmentPayload = metricEnrichmentResult.status === "fulfilled" ? metricEnrichmentResult.value : null;
    const metricEnrichmentError = metricEnrichmentResult.status === "rejected" ? metricEnrichmentResult.reason : null;
    const existingDiagnosticsRecord = metricRow?.aiDiagnostics && typeof metricRow.aiDiagnostics === "object" ? metricRow.aiDiagnostics : {};
    const existingValidationScreening = existingDiagnosticsRecord.validationScreening;
    const diagnosticsFailureMessage = diagnosticsError ? String(diagnosticsError.message || diagnosticsError) : null;
    const metricEnrichmentFailureMessage = metricEnrichmentError ? String(metricEnrichmentError.message || metricEnrichmentError) : null;
    const finalStatus = diagnosticsFailureMessage && metricEnrichmentFailureMessage ? "failed" : "completed";
    const noteParts = [
      diagnosticsFailureMessage ? `diagnostics: ${diagnosticsFailureMessage}` : null,
      metricEnrichmentFailureMessage ? `metric enrichment: ${metricEnrichmentFailureMessage}` : null
    ].filter((value) => Boolean(value));
    pipelineTiming = await persistPipelineTimingUpdate(
      args.analysisId,
      {
        stageKey: "diagnostics",
        status: finalStatus,
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        elapsedMs: Date.now() - enrichmentStartedAt,
        note: noteParts.length ? noteParts.join(" | ") : null
      },
      {
        configKey: args.configKey,
        modelVersion: args.modelVersion,
        auditActorUserId: args.auditActorUserId,
        existingTiming: pipelineTiming
      }
    );
    const diagnosticsBaseRecord = diagnosticsPayload && typeof diagnosticsPayload === "object" ? mergeValidationScreeningSnapshot(
      diagnosticsPayload,
      existingValidationScreening
    ) : mergeValidationScreeningSnapshot(existingDiagnosticsRecord, existingValidationScreening);
    const diagnosticsWithTiming = attachPipelineTiming(
      diagnosticsBaseRecord,
      pipelineTiming
    );
    if (!metricRow || !analysisRow) {
      await upsertAnalysisDiagnosticsPayload(args.analysisId, diagnosticsWithTiming, {
        configKey: args.configKey,
        modelVersion: args.modelVersion,
        auditActorUserId: args.auditActorUserId
      });
      if (diagnosticsError && metricEnrichmentError) {
        throw diagnosticsError;
      }
      return;
    }
    const metricEnrichmentResultValue = metricEnrichmentPayload;
    const enrichedMetricValues = metricEnrichmentResultValue?.metricValues || {};
    const mergedMetricValuesRaw = {
      ...metricRow.metricValues || {},
      ...enrichedMetricValues
    };
    const normalizedMetricValues = normalizeMetricValuesForPersistence(
      mergedMetricValuesRaw,
      diagnosticsWithTiming
    );
    const metricValues = sanitizePersistedMap(normalizedMetricValues);
    const scoreInputs = buildScoreInputsPayload(configKey, metricValues);
    const tacticalComponents = extractStandardizedTacticalScores10(
      sanitizePersistedMap(
        metricRow.scoreOutputs?.tactical?.components || metricRow.scoreOutputs?.tacticalComponents || {}
      )
    );
    const scoreOutputs = buildScoreOutputsPayload({
      configKey,
      detectedMovement: analysisRow.detectedMovement || args.movementName,
      tacticalComponents,
      metricValues,
      overallScore: metricRow.overallScore == null ? null : Number(metricRow.overallScore)
    });
    const { userMetricPreferences } = await loadUserAnalysisPreferences(analysisRow.userId);
    const coaching = buildPersonalizedCoaching({
      configKey,
      detectedMovement: analysisRow.detectedMovement || args.movementName,
      overallScore: metricRow.overallScore == null ? null : Number(metricRow.overallScore),
      scoreInputs,
      scoreOutputs,
      metricValues,
      preferences: userMetricPreferences
    });
    await db.transaction(async (tx) => {
      await tx.update(metrics).set({
        configKey,
        modelVersion: metricRow.modelVersion || args.modelVersion || DEFAULT_PIPELINE_MODEL_VERSION,
        metricValues,
        scoreInputs,
        scoreOutputs,
        aiDiagnostics: diagnosticsWithTiming,
        ...buildUpdateAuditFields(args.auditActorUserId ?? null)
      }).where(eq6(metrics.id, metricRow.id));
      await tx.delete(coachingInsights).where(eq6(coachingInsights.analysisId, args.analysisId));
      await tx.insert(coachingInsights).values({
        analysisId: args.analysisId,
        ...coaching,
        ...buildInsertAuditFields(args.auditActorUserId ?? null)
      });
    });
    if (diagnosticsFailureMessage) {
      console.warn(
        `Diagnostics generation failed for analysis ${args.analysisId}: ${diagnosticsFailureMessage}`
      );
    }
    if (metricEnrichmentFailureMessage) {
      console.warn(
        `Metric enrichment failed for analysis ${args.analysisId}: ${metricEnrichmentFailureMessage}`
      );
    }
  } catch (error) {
    await persistPipelineTimingUpdate(
      args.analysisId,
      {
        stageKey: "diagnostics",
        status: "failed",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        note: error?.message || String(error)
      },
      {
        configKey: args.configKey,
        modelVersion: args.modelVersion,
        auditActorUserId: args.auditActorUserId,
        existingTiming: pipelineTiming
      }
    );
    console.warn(
      `Diagnostics generation failed for analysis ${args.analysisId}: ${error?.message || error}`
    );
  } finally {
    const artifactPath = String(args.analysisArtifactPath || "").trim();
    if (artifactPath) {
      try {
        fs6.unlinkSync(artifactPath);
      } catch (cleanupError) {
        console.warn(
          `Failed to remove analysis artifact for ${args.analysisId}: ${String(cleanupError)}`
        );
      }
    }
  }
}
async function getVideoValidationMode() {
  const [setting] = await db.select().from(appSettings).where(eq6(appSettings.key, VIDEO_VALIDATION_MODE_KEY)).limit(1);
  const rawMode = setting?.value && typeof setting.value === "object" ? setting.value.mode : null;
  return isVideoValidationMode(rawMode) ? rawMode : "disabled";
}
async function getAnalysisFpsSettings() {
  const [setting] = await db.select().from(appSettings).where(eq6(appSettings.key, ANALYSIS_FPS_MODE_KEY)).limit(1);
  const rawValue = setting?.value && typeof setting.value === "object" ? setting.value : null;
  return {
    lowImpactStep: coerceLowImpactStep(rawValue?.lowImpactStep ?? rawValue?.lowImpactMode),
    highImpactStep: coerceHighImpactStep(rawValue?.highImpactStep ?? rawValue?.highImpactMode),
    tennisAutoDetectUsesHighImpact: Boolean(rawValue?.tennisAutoDetectUsesHighImpact),
    tennisMatchPlayUsesHighImpact: Boolean(rawValue?.tennisMatchPlayUsesHighImpact)
  };
}
function resolveAnalysisFpsModeForMovement(sportName, movementName, requestedSessionType, settings) {
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
      routingReason: "serve-selected"
    };
  }
  if (normalizedSport === "tennis" && normalized === "auto-detect" && settings.tennisAutoDetectUsesHighImpact) {
    return {
      effectiveStep: settings.highImpactStep,
      lowImpactStep: settings.lowImpactStep,
      highImpactStep: settings.highImpactStep,
      tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
      routingReason: "tennis-auto-detect-override"
    };
  }
  if (normalizedSport === "tennis" && normalizedSessionType === "match-play" && settings.tennisMatchPlayUsesHighImpact) {
    return {
      effectiveStep: settings.highImpactStep,
      lowImpactStep: settings.lowImpactStep,
      highImpactStep: settings.highImpactStep,
      tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
      routingReason: "tennis-match-play-override"
    };
  }
  return {
    effectiveStep: settings.lowImpactStep,
    lowImpactStep: settings.lowImpactStep,
    highImpactStep: settings.highImpactStep,
    tennisAutoDetectUsesHighImpact: settings.tennisAutoDetectUsesHighImpact,
    tennisMatchPlayUsesHighImpact: settings.tennisMatchPlayUsesHighImpact,
    routingReason: "default-low-impact"
  };
}
function runPythonDiagnostics(videoPath, sportName, movementName, dominantProfile, analysisArtifactPath) {
  return new Promise((resolve2, reject) => {
    void (async () => {
      const pythonExecutable = resolvePythonExecutable2();
      const poseEnv = await getPoseLandmarkerPythonEnv();
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
      if (analysisArtifactPath) {
        args.push("--analysis-artifact", analysisArtifactPath);
      }
      const child = spawn(pythonExecutable, args, {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...poseEnv }
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        child.kill("SIGKILL");
      }, 36e5);
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
          resolve2(result);
        } catch {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error("Failed to parse diagnostics results"));
        }
      });
    })().catch((error) => {
      reject(error);
    });
  });
}
async function processAnalysis(analysisId, options) {
  let pipelineTiming = null;
  try {
    await db.update(analyses).set({ status: "processing", rejectionReason: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(analyses.id, analysisId));
    const [analysis] = await db.select().from(analyses).where(eq6(analyses.id, analysisId));
    if (!analysis) {
      throw new Error("Analysis not found");
    }
    const auditActorUserId = analysis.createdByUserId || analysis.userId || null;
    let sportName = "tennis";
    let movementName = "auto-detect";
    if (analysis.movementId) {
      const [movement] = await db.select().from(sportMovements).where(eq6(sportMovements.id, analysis.movementId));
      if (movement) {
        movementName = movement.name;
      }
    }
    if (analysis.sportId) {
      const sport = await getSportById(analysis.sportId);
      if (sport) {
        if (!isSportEnabledRecord(sport)) {
          await db.update(analyses).set({
            status: "failed",
            rejectionReason: `${sport.name} is currently disabled and was not executed.`,
            ...buildUpdateAuditFields(auditActorUserId)
          }).where(eq6(analyses.id, analysisId));
          return;
        }
        sportName = sport.name;
      }
    } else {
      const enabledPrimarySport = await getEnabledPrimarySport();
      if (!enabledPrimarySport) {
        await db.update(analyses).set({
          status: "failed",
          rejectionReason: "No enabled sport is available for execution.",
          ...buildUpdateAuditFields(auditActorUserId)
        }).where(eq6(analyses.id, analysisId));
        return;
      }
      sportName = enabledPrimarySport.name;
    }
    let dominantProfile = null;
    let userMetricPreferences = null;
    const [videoValidationMode, analysisFpsSettings] = await Promise.all([
      getVideoValidationMode(),
      getAnalysisFpsSettings()
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
          dominantProfile
        );
        if (!tennisUploadGuard.accepted) {
          await db.update(analyses).set({
            status: "rejected",
            rejectionReason: tennisUploadGuard.reason || "Only tennis videos are allowed. Upload a clear tennis stroke or rally clip.",
            ...buildUpdateAuditFields(auditActorUserId)
          }).where(eq6(analyses.id, analysisId));
          return;
        }
      }
      const videoContentHashPromise = computeVideoContentHash(localVideoPath).then(async (videoContentHash) => {
        if (!videoContentHash) return null;
        await db.update(analyses).set({ videoContentHash, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(analyses.id, analysis.id));
        analysis.videoContentHash = videoContentHash;
        return videoContentHash;
      }).catch((hashError) => {
        console.warn(
          `Video hash computation failed for analysis ${analysisId}: ${String(hashError)}`
        );
        return null;
      });
      const modelRegistryConfig = readModelRegistryConfig();
      const initialConfigKey = getConfigKey(sportName, movementName);
      const applyPipelineUpdate = async (update) => {
        pipelineTiming = await persistPipelineTimingUpdate(analysisId, update, {
          configKey: initialConfigKey,
          modelVersion: modelRegistryConfig.activeModelVersion,
          auditActorUserId,
          existingTiming: pipelineTiming
        });
      };
      const reusablePayload = options?.forceFreshDiagnostics ? null : await findReusableAnalysisPayload(
        analysis,
        modelRegistryConfig.activeModelVersion
      );
      if (reusablePayload) {
        const needsDiagnosticsBackfill = !hasAllRequiredUploadDiagnosticsMetrics(
          normalizeMetricValuesForPersistence(
            reusablePayload.metricValues || {},
            reusablePayload.aiDiagnostics
          )
        );
        const needsAsyncMetricEnrichment = hasPendingAsyncMetricEnrichment(
          reusablePayload.configKey,
          reusablePayload.metricValues
        );
        let normalizedReusableMetrics = normalizeMetricValuesForPersistence(
          reusablePayload.metricValues || {},
          reusablePayload.aiDiagnostics
        );
        let reusableDiagnosticsPayload = reusablePayload.aiDiagnostics;
        if (needsDiagnosticsBackfill || needsAsyncMetricEnrichment) {
          pipelineTiming = updatePipelineTiming(pipelineTiming, {
            stageKey: "diagnostics",
            status: "pending"
          });
          const queuedDiagnostics = reusableDiagnosticsPayload && typeof reusableDiagnosticsPayload === "object" ? reusableDiagnosticsPayload : {};
          reusableDiagnosticsPayload = attachPipelineTiming(
            mergeValidationScreeningSnapshot(queuedDiagnostics, validationScreening),
            pipelineTiming
          );
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
        const reusableCoaching = buildPersonalizedCoaching({
          configKey: reusablePayload.configKey,
          detectedMovement: reusablePayload.detectedMovement || movementName,
          overallScore: reusablePayload.overallScore,
          scoreInputs: reusableScoreInputs,
          scoreOutputs: reusableScoreOutputs,
          metricValues: sanitizedMetricValues,
          preferences: userMetricPreferences
        });
        await db.transaction(async (tx) => {
          await tx.delete(coachingInsights).where(eq6(coachingInsights.analysisId, analysisId));
          await tx.delete(metrics).where(eq6(metrics.analysisId, analysisId));
          await tx.insert(metrics).values({
            analysisId,
            configKey: reusablePayload.configKey,
            modelVersion: reusablePayload.modelVersion,
            overallScore: reusablePayload.overallScore,
            metricValues: sanitizedMetricValues,
            scoreInputs: reusableScoreInputs,
            scoreOutputs: reusableScoreOutputs,
            aiDiagnostics: reusableDiagnosticsPayload,
            ...buildInsertAuditFields(auditActorUserId)
          });
          await tx.insert(coachingInsights).values({
            analysisId,
            ...reusableCoaching,
            ...buildInsertAuditFields(auditActorUserId)
          });
        });
        await db.update(analyses).set({
          status: "completed",
          detectedMovement: reusablePayload.detectedMovement || movementName,
          rejectionReason: null,
          ...buildUpdateAuditFields(auditActorUserId)
        }).where(eq6(analyses.id, analysisId));
        if (needsDiagnosticsBackfill || needsAsyncMetricEnrichment) {
          void backfillAnalysisEnrichment({
            analysisId,
            videoPath: localVideoPath,
            sportName,
            movementName: reusablePayload.detectedMovement || movementName,
            dominantProfile,
            configKey: reusablePayload.configKey,
            modelVersion: modelRegistryConfig.activeModelVersion,
            auditActorUserId
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
            `Deterministic movement lock for repeated upload: using prior detected movement "${lockedMovement}" instead of auto-detect`
          );
          movementName = lockedMovement;
        }
      }
      const configKey = getConfigKey(sportName, movementName);
      const analysisFpsSnapshot = resolveAnalysisFpsModeForMovement(
        sportName,
        movementName,
        analysis.requestedSessionType,
        analysisFpsSettings
      );
      console.log(
        `Starting Python analysis for: ${analysis.videoPath} (${sportName}/${movementName}, config: ${configKey})`
      );
      const result = await runPythonAnalysis(
        localVideoPath,
        sportName,
        movementName,
        videoValidationMode,
        analysisFpsSnapshot,
        shouldUseCoreMetricComputation(configKey) ? "core" : "full",
        dominantProfile,
        async (event) => {
          await applyPipelineUpdate(event);
        }
      );
      if (result.rejected) {
        console.warn(
          `Analysis ${analysisId} rejected by pipeline validation mode ${videoValidationMode}: ${result.rejectionReason}`
        );
        await db.update(analyses).set({
          status: "rejected",
          rejectionReason: result.rejectionReason || "Video content does not match the selected validation mode.",
          ...buildUpdateAuditFields(auditActorUserId)
        }).where(eq6(analyses.id, analysisId));
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
      pipelineTiming = updatePipelineTiming(pipelineTiming, {
        stageKey: "diagnostics",
        status: "pending"
      });
      const diagnosticsPayload = pipelineTiming ? attachPipelineTiming(
        mergeValidationScreeningSnapshot({}, validationScreening),
        pipelineTiming
      ) : null;
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
      const coaching = buildPersonalizedCoaching({
        configKey: resolvedConfigKey,
        detectedMovement: actualMovement,
        overallScore: persistedOverallScore,
        scoreInputs,
        scoreOutputs,
        metricValues,
        preferences: userMetricPreferences
      });
      await db.transaction(async (tx) => {
        await tx.delete(coachingInsights).where(eq6(coachingInsights.analysisId, analysisId));
        await tx.delete(metrics).where(eq6(metrics.analysisId, analysisId));
        await tx.insert(metrics).values({
          analysisId,
          configKey: resolvedConfigKey,
          modelVersion: modelRegistryConfig.activeModelVersion,
          overallScore: persistedOverallScore,
          metricValues,
          scoreInputs,
          scoreOutputs,
          aiDiagnostics: diagnosticsPayload,
          ...buildInsertAuditFields(auditActorUserId)
        });
        await tx.insert(coachingInsights).values({
          analysisId,
          ...coaching,
          ...buildInsertAuditFields(auditActorUserId)
        });
      });
      await db.update(analyses).set({
        status: "completed",
        detectedMovement: actualMovement,
        rejectionReason: null,
        ...buildUpdateAuditFields(auditActorUserId)
      }).where(eq6(analyses.id, analysisId));
      void backfillAnalysisEnrichment({
        analysisId,
        videoPath: localVideoPath,
        sportName,
        movementName: actualMovement,
        dominantProfile,
        analysisArtifactPath: result.analysisArtifactPath,
        configKey: resolvedConfigKey,
        modelVersion: modelRegistryConfig.activeModelVersion,
        auditActorUserId
      });
      void videoContentHashPromise;
      console.log(`Analysis ${analysisId} completed successfully`);
    });
  } catch (error) {
    console.error("Analysis processing error:", error);
    const failureMessage = error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : "Processing failed unexpectedly. Please try again.";
    const currentTiming = pipelineTiming;
    const currentStageKey = currentTiming?.currentStageKey ?? null;
    if (currentStageKey) {
      try {
        pipelineTiming = await persistPipelineTimingUpdate(
          analysisId,
          {
            stageKey: currentStageKey,
            status: "failed",
            note: failureMessage
          },
          { existingTiming: currentTiming }
        );
      } catch (timingError) {
        console.warn("Failed to persist pipeline timing failure state:", timingError);
      }
    }
    await db.update(analyses).set({
      status: "failed",
      rejectionReason: failureMessage,
      ...buildUpdateAuditFields(null)
    }).where(eq6(analyses.id, analysisId));
  }
}

// server/auth.ts
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import multer from "multer";

// shared/default-user-preferences.ts
var DEFAULT_SELECTED_METRIC_KEYS = [
  "ballSpeed",
  "spinRate",
  "shoulderRotation",
  "hipRotationSpeed"
];
var DEFAULT_SELECTED_SCORE_SECTIONS = [
  "Technical (Biomechanics)",
  "Tactical",
  "Movement"
];

// server/auth.ts
import { eq as eq7, or as or2, sql as sql4 } from "drizzle-orm";
async function sanitizeUser(user) {
  const selectedScoreSectionsBySport = user.selectedScoreSectionsBySport && typeof user.selectedScoreSectionsBySport === "object" ? user.selectedScoreSectionsBySport : {};
  const selectedMetricKeysBySport = user.selectedMetricKeysBySport && typeof user.selectedMetricKeysBySport === "object" ? user.selectedMetricKeysBySport : {};
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: await resolveMediaUrl(user.avatarUrl),
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
var avatarUpload = multer({
  storage: multer.memoryStorage(),
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
    sql4`alter table users add column if not exists dominant_profile text`
  );
  await db.execute(
    sql4`alter table users add column if not exists selected_score_sections jsonb default '[]'::jsonb`
  );
  await db.execute(
    sql4`alter table users add column if not exists selected_metric_keys jsonb default '[]'::jsonb`
  );
  await db.execute(
    sql4`alter table users add column if not exists selected_score_sections_by_sport jsonb default '{}'::jsonb`
  );
  await db.execute(
    sql4`alter table users add column if not exists selected_metric_keys_by_sport jsonb default '{}'::jsonb`
  );
  await db.execute(
    sql4`alter table users alter column role set default 'admin'`
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
      const [existing] = await db.select().from(users).where(eq7(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const [user] = await db.insert(users).values({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: "admin",
        selectedScoreSections: [...DEFAULT_SELECTED_SCORE_SECTIONS],
        selectedMetricKeys: [...DEFAULT_SELECTED_METRIC_KEYS],
        ...buildInsertAuditFields(null)
      }).returning();
      req.session.userId = user.id;
      res.json(await sanitizeUser(user));
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });
  app2.post("/api/admin/players", requireAuth, async (req, res) => {
    try {
      const [requester] = await db.select().from(users).where(eq7(users.id, req.session.userId));
      if (!requester || requester.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { email, name, password } = parsed.data;
      const [existing] = await db.select().from(users).where(eq7(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const [createdPlayer] = await db.insert(users).values({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: "player",
        country: requester.country || null,
        selectedScoreSections: [...DEFAULT_SELECTED_SCORE_SECTIONS],
        selectedMetricKeys: [...DEFAULT_SELECTED_METRIC_KEYS],
        ...buildInsertAuditFields(requester.id)
      }).returning();
      res.status(201).json(await sanitizeUser(createdPlayer));
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
          eq7(users.id, normalizedIdentifier),
          eq7(users.email, normalizedEmail)
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
      res.json(await sanitizeUser(user));
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
      const [existing] = await db.select().from(users).where(eq7(users.email, googleUser.email.toLowerCase()));
      if (existing) {
        req.session.userId = existing.id;
        const updates = {};
        if (googleUser.picture && !existing.avatarUrl) {
          updates.avatarUrl = googleUser.picture;
        }
        if (Object.keys(updates).length > 0) {
          const [updated] = await db.update(users).set({
            ...updates,
            ...buildUpdateAuditFields(existing.id)
          }).where(eq7(users.id, existing.id)).returning();
          return res.json(await sanitizeUser(updated));
        }
        return res.json(await sanitizeUser(existing));
      }
      const randomPassword = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      const [newUser] = await db.insert(users).values({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        passwordHash,
        avatarUrl: googleUser.picture || null,
        country: "Singapore",
        role: "admin",
        selectedScoreSections: [...DEFAULT_SELECTED_SCORE_SECTIONS],
        selectedMetricKeys: [...DEFAULT_SELECTED_METRIC_KEYS],
        ...buildInsertAuditFields(null)
      }).returning();
      req.session.userId = newUser.id;
      res.json(await sanitizeUser(newUser));
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
      const [user] = await db.select().from(users).where(eq7(users.id, req.session.userId));
      if (!user) {
        req.session.destroy(() => {
        });
        return res.status(401).json({ error: "User not found" });
      }
      res.json(await sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  app2.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq7(users.id, req.session.userId));
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(await sanitizeUser(user));
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
      const [requester] = await db.select().from(users).where(eq7(users.id, requesterId));
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
      if (sportsInterests !== void 0) {
        const normalizedSportsInterest = String(sportsInterests || "").trim();
        if (!normalizedSportsInterest) {
          updates.sportsInterests = null;
        } else {
          const enabledSports = await listSports({ includeDisabled: false });
          const matchingEnabledSport = enabledSports.find(
            (sport) => normalizeSportName(sport.name) === normalizeSportName(normalizedSportsInterest)
          );
          if (!matchingEnabledSport) {
            return res.status(400).json({ error: "Selected sport is not enabled." });
          }
          updates.sportsInterests = matchingEnabledSport.name;
        }
      }
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
      const [updated] = await db.update(users).set({
        ...updates,
        ...buildUpdateAuditFields(requesterId)
      }).where(eq7(users.id, requesterId)).returning();
      res.json(await sanitizeUser(updated));
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
        const avatarUrl = await storeAvatarBuffer({
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
          originalName: req.file.originalname
        });
        const [updated] = await db.update(users).set({
          avatarUrl,
          ...buildUpdateAuditFields(req.session.userId)
        }).where(eq7(users.id, req.session.userId)).returning();
        res.json(await sanitizeUser(updated));
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
import { eq as eq8, asc as asc3, and as and4, desc as desc4, inArray as inArray2, sql as sql6 } from "drizzle-orm";

// server/tennis-training-storage.ts
import { sql as sql5 } from "drizzle-orm";
function normalizeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (["forehand", "backhand", "serve", "volley", "unknown"].includes(normalized)) return normalized;
  return "";
}
function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function boolNumber(value) {
  return value ? 1 : 0;
}
function toLabelArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
function toShotDiagnosticsArray(diagnostics) {
  if (Array.isArray(diagnostics?.shotLabelDiagnostics)) {
    return diagnostics.shotLabelDiagnostics;
  }
  if (Array.isArray(diagnostics?.shotSegments)) {
    return diagnostics.shotSegments.map((segment) => ({
      shotIndex: numberOrNull(segment?.index) ?? void 0,
      label: String(segment?.label || ""),
      rawLabel: String(segment?.rawLabel || segment?.label || ""),
      confidence: numberOrNull(segment?.confidence) ?? void 0,
      frames: numberOrNull(segment?.frames) ?? void 0,
      fps: numberOrNull(diagnostics?.fps) ?? void 0,
      validPoseFrames: numberOrNull(segment?.validPoseFrames) ?? void 0,
      classificationDebug: segment?.classificationDebug && typeof segment.classificationDebug === "object" ? segment.classificationDebug : {},
      reasons: Array.isArray(segment?.classificationDebug?.reasons) ? segment.classificationDebug.reasons : []
    }));
  }
  return [];
}
function buildFeatureValues(diag, row) {
  const dbg = diag?.classificationDebug && typeof diag.classificationDebug === "object" ? diag.classificationDebug : {};
  const key = diag?.keyFeatures && typeof diag.keyFeatures === "object" ? diag.keyFeatures : {};
  const reasons = Array.isArray(diag?.reasons) ? diag.reasons : Array.isArray(dbg?.reasons) ? dbg.reasons : [];
  const rightSpeed = numberOrNull(dbg.rightWristSpeed ?? key.max_rw_speed);
  const leftSpeed = numberOrNull(dbg.leftWristSpeed ?? key.max_lw_speed);
  const maxWristSpeed = numberOrNull(dbg.maxWristSpeed ?? key.max_wrist_speed);
  const swingArcRatio = numberOrNull(dbg.swingArcRatio ?? key.swing_arc_ratio);
  const contactHeightRatio = numberOrNull(dbg.contactHeightRatio ?? key.contact_height_ratio);
  const shoulderRotationDeltaDeg = numberOrNull(dbg.shoulderRotationDeltaDeg ?? key.shoulder_rotation_delta_deg);
  const isServe = Boolean(dbg.isServe ?? key.is_serve);
  const isOverhead = Boolean(dbg.isOverhead ?? key.is_overhead);
  const segmentFrames = numberOrNull(diag?.frames);
  const fps = numberOrNull(diag?.fps);
  const validPoseFrames = numberOrNull(diag?.validPoseFrames);
  const wristSpeedBalanceRatio = rightSpeed != null && leftSpeed != null ? Math.max(rightSpeed, leftSpeed) / Math.max(Math.min(rightSpeed, leftSpeed), 1e-6) : null;
  const wristSpeedGap = rightSpeed != null && leftSpeed != null ? Math.abs(rightSpeed - leftSpeed) : null;
  const segmentDurationSec = segmentFrames != null && fps != null && fps > 0 ? segmentFrames / fps : null;
  const validPoseFrameRatio = validPoseFrames != null && segmentFrames != null && segmentFrames > 0 ? validPoseFrames / segmentFrames : null;
  const label = normalizeLabel(diag?.label);
  const heuristicLabel = normalizeLabel(diag?.rawLabel || diag?.label);
  return {
    analysisId: row.analysisId,
    userId: row.userId,
    videoFilename: row.videoFilename,
    shotIndex: row.shotIndex,
    groupKey: row.userId || row.analysisId || row.videoFilename,
    label,
    heuristicLabel: heuristicLabel || null,
    heuristicConfidence: numberOrNull(diag?.confidence),
    heuristicReasons: reasons,
    featureValues: {
      dominant_side: String(dbg.dominantSide ?? key.dominant_side ?? "").trim(),
      dominant_side_confidence: numberOrNull(dbg.dominantSideConfidence ?? key.dominant_side_confidence),
      is_cross_body: boolNumber(Boolean(dbg.isCrossBody ?? key.is_cross_body)),
      is_serve: boolNumber(Boolean(dbg.isServe ?? key.is_serve)),
      is_compact_forward: boolNumber(Boolean(dbg.isCompactForward ?? key.is_compact_forward)),
      is_overhead: boolNumber(Boolean(dbg.isOverhead ?? key.is_overhead)),
      is_downward_motion: boolNumber(Boolean(dbg.isDownwardMotion ?? key.is_downward_motion)),
      max_wrist_speed: maxWristSpeed,
      max_rw_speed: rightSpeed,
      max_lw_speed: leftSpeed,
      swing_arc_ratio: swingArcRatio,
      contact_height_ratio: contactHeightRatio,
      dominant_wrist_median_offset: numberOrNull(dbg.dominantWristMedianOffset ?? key.dominant_wrist_median_offset),
      dominant_wrist_opposite_ratio: numberOrNull(dbg.dominantWristOppositeRatio ?? key.dominant_wrist_opposite_ratio),
      dominant_wrist_same_ratio: numberOrNull(dbg.dominantWristSameRatio ?? key.dominant_wrist_same_ratio),
      dominant_wrist_mean_speed: numberOrNull(dbg.dominantWristMeanSpeed ?? key.dominant_wrist_mean_speed),
      dominant_wrist_speed_std: numberOrNull(dbg.dominantWristSpeedStd ?? key.dominant_wrist_speed_std),
      dominant_wrist_speed_p90: numberOrNull(dbg.dominantWristSpeedP90 ?? key.dominant_wrist_speed_p90),
      dominant_wrist_accel_p90: numberOrNull(dbg.dominantWristAccelP90 ?? key.dominant_wrist_accel_p90),
      peak_speed_frame_ratio: numberOrNull(dbg.peakSpeedFrameRatio ?? key.peak_speed_frame_ratio),
      dominant_wrist_horizontal_range_ratio: numberOrNull(dbg.dominantWristHorizontalRangeRatio ?? key.dominant_wrist_horizontal_range_ratio),
      dominant_wrist_vertical_range_ratio: numberOrNull(dbg.dominantWristVerticalRangeRatio ?? key.dominant_wrist_vertical_range_ratio),
      wrist_height_range: numberOrNull(dbg.wristHeightRange ?? key.wrist_height_range),
      peak_wrist_height_frame_ratio: numberOrNull(dbg.peakWristHeightFrameRatio ?? key.peak_wrist_height_frame_ratio),
      contact_height_std: numberOrNull(dbg.contactHeightStd ?? key.contact_height_std),
      shoulder_rotation_delta_deg: shoulderRotationDeltaDeg,
      shoulder_rotation_range_deg: numberOrNull(dbg.shoulderRotationRangeDeg ?? key.shoulder_rotation_range_deg),
      shoulder_rotation_std_deg: numberOrNull(dbg.shoulderRotationStdDeg ?? key.shoulder_rotation_std_deg),
      dominant_wrist_offset_std: numberOrNull(dbg.dominantWristOffsetStd ?? key.dominant_wrist_offset_std),
      segment_frames: segmentFrames,
      segment_duration_sec: segmentDurationSec,
      valid_pose_frame_ratio: validPoseFrameRatio,
      wrist_speed_balance_ratio: wristSpeedBalanceRatio,
      wrist_speed_gap: wristSpeedGap,
      arc_speed_product: maxWristSpeed != null && swingArcRatio != null ? maxWristSpeed * swingArcRatio : null,
      contact_arc_product: contactHeightRatio != null && swingArcRatio != null ? contactHeightRatio * swingArcRatio : null,
      serve_height_product: contactHeightRatio != null ? (isServe ? 1 : 0) * contactHeightRatio : null,
      overhead_contact_product: contactHeightRatio != null ? (isOverhead ? 1 : 0) * contactHeightRatio : null,
      shoulder_rotation_abs_deg: shoulderRotationDeltaDeg != null ? Math.abs(shoulderRotationDeltaDeg) : null,
      valid_pose_frames: validPoseFrames
    }
  };
}
function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}
async function exportTennisTrainingDatasetSnapshot(params) {
  const countsResult = await db.execute(sql5`
    with latest_annotations as (
      select distinct on (ann.analysis_id)
        ann.analysis_id,
        ann.user_id,
        ann.ordered_shot_labels,
        ann.updated_at
      from analysis_shot_annotations ann
      order by ann.analysis_id, ann.updated_at desc
    )
    select
      a.id as analysis_id,
      a.user_id,
      a.video_filename,
      m.ai_diagnostics,
      la.ordered_shot_labels
    from analyses a
    inner join metrics m on m.analysis_id = a.id
    inner join latest_annotations la on la.analysis_id = a.id
    where a.status = 'completed'
      and m.ai_diagnostics is not null
      and lower(coalesce(m.config_key, '')) like 'tennis-%'
    order by a.created_at desc
  `);
  const rows = Array.isArray(countsResult.rows) ? countsResult.rows : [];
  const datasetRows = [];
  const trainingSamples = [];
  const analysisIds = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const diagnostics = row.ai_diagnostics && typeof row.ai_diagnostics === "object" ? row.ai_diagnostics : {};
    const shotDiags = toShotDiagnosticsArray(diagnostics);
    const manualLabels = toLabelArray(row.ordered_shot_labels).map(normalizeLabel);
    if (!shotDiags.length || !manualLabels.length) continue;
    for (let index = 0; index < Math.min(shotDiags.length, manualLabels.length); index += 1) {
      const manualLabel = manualLabels[index];
      if (!manualLabel) continue;
      const built = buildFeatureValues(shotDiags[index], {
        analysisId: String(row.analysis_id),
        userId: row.user_id ? String(row.user_id) : null,
        videoFilename: String(row.video_filename || ""),
        shotIndex: index + 1
      });
      if (!built) continue;
      datasetRows.push({
        ...built,
        label: manualLabel
      });
      trainingSamples.push({
        label: manualLabel,
        groupKey: built.groupKey,
        featureValues: built.featureValues
      });
      analysisIds.add(String(row.analysis_id));
    }
  }
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const datasetName = String(params?.datasetName || `tennis-training-${timestamp2}`).trim();
  const actorUserId = params?.actorUserId || null;
  const [dataset] = await db.insert(tennisTrainingDatasets).values({
    sportName: "tennis",
    datasetName,
    source: "manual-annotation",
    analysisCount: analysisIds.size,
    rowCount: datasetRows.length,
    notes: params?.notes || null,
    ...buildInsertAuditFields(actorUserId)
  }).returning({ id: tennisTrainingDatasets.id });
  if (datasetRows.length > 0) {
    for (const chunk of chunkArray(datasetRows, 500)) {
      await db.insert(tennisTrainingDatasetRows).values(
        chunk.map((row) => ({
          datasetId: dataset.id,
          analysisId: row.analysisId,
          userId: row.userId,
          videoFilename: row.videoFilename,
          shotIndex: row.shotIndex,
          groupKey: row.groupKey,
          label: row.label,
          heuristicLabel: row.heuristicLabel,
          heuristicConfidence: row.heuristicConfidence,
          heuristicReasons: row.heuristicReasons,
          featureValues: row.featureValues,
          ...buildInsertAuditFields(actorUserId)
        }))
      );
    }
  }
  return {
    datasetId: dataset.id,
    outputPath: `database://tennis-training-datasets/${dataset.id}`,
    rows: datasetRows.length,
    analyses: analysisIds.size,
    samples: trainingSamples
  };
}

// server/routes.ts
var uploadDir = resolveProjectPath("uploads");
if (!fs7.existsSync(uploadDir)) {
  fs7.mkdirSync(uploadDir, { recursive: true });
}
var uploadToFilesystem = multer2({
  storage: multer2.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path4.extname(file.originalname) || ".mp4";
      cb(null, `${randomUUID3().toUpperCase()}${ext}`);
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
var uploadToMemory = multer2({
  storage: multer2.memoryStorage(),
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
async function runVideoUploadMiddleware(req, res, next) {
  try {
    const mode = await getVideoStorageMode();
    const middleware = mode === "r2" ? uploadToMemory.single("video") : uploadToFilesystem.single("video");
    middleware(req, res, (err) => {
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
function resolvePythonExecutable3() {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs7.existsSync(envExecutable)) {
    return envExecutable;
  }
  const localCandidates = [
    resolveProjectPath(".venv", "bin", "python3"),
    resolveProjectPath(".venv", "bin", "python")
  ];
  for (const candidate of localCandidates) {
    if (fs7.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python3";
}
function runPythonDiagnostics2(videoPath, sportName, movementName, dominantProfile) {
  return (async () => {
    const pythonExecutable = resolvePythonExecutable3();
    const poseLandmarkerEnv = await getPoseLandmarkerPythonEnv();
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
    return new Promise((resolve2, reject) => {
      execFile2(
        pythonExecutable,
        args,
        {
          cwd: PROJECT_ROOT,
          env: { ...process.env, ...poseLandmarkerEnv },
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
  })();
}
var TENNIS_DATASET_INSIGHT_LABELS = ["forehand", "backhand", "serve", "volley"];
var TENNIS_MODEL_TRAINING_STATE_KEY = "tennisModelTrainingState";
var TENNIS_MODEL_VERSION_ARCHIVE_DIR = resolveProjectPath("models", "versions");
var MAX_TENNIS_TRAINING_HISTORY = 20;
var activeTennisTrainingJobId = null;
var activeTennisTrainingPromise = null;
function runPythonJsonModuleWithInput(moduleName, args, input, env) {
  return new Promise((resolve2, reject) => {
    const pythonExecutable = resolvePythonExecutable3();
    const child = spawn2(pythonExecutable, ["-m", moduleName, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
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
        resolve2(JSON.parse(String(stdout || "").trim()));
      } catch {
        if (stderr) console.error(`Python module stderr (${moduleName}):`, stderr);
        reject(new Error(`Failed to parse ${moduleName} output`));
      }
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}
async function statIfExists(filePath) {
  try {
    return await fs7.promises.stat(filePath);
  } catch {
    return null;
  }
}
function normalizeTennisTrainingHistoryEntry(value) {
  if (!value || typeof value !== "object") return null;
  const row = value;
  const jobId = String(row.jobId || "").trim();
  const status = String(row.status || "").trim();
  const requestedAt = String(row.requestedAt || "").trim();
  if (!jobId || !requestedAt) return null;
  if (status !== "queued" && status !== "running" && status !== "succeeded" && status !== "failed") {
    return null;
  }
  const numOrNull = (input) => {
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
    versionDescription: row.versionDescription ? String(row.versionDescription) : null
  };
}
function normalizeTennisTrainingState(value) {
  const source = value && typeof value === "object" ? value : {};
  const rawHistory = Array.isArray(source.history) ? source.history : [];
  const history = rawHistory.map((entry) => normalizeTennisTrainingHistoryEntry(entry)).filter((entry) => Boolean(entry)).sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt))).slice(0, MAX_TENNIS_TRAINING_HISTORY);
  const currentJobIdRaw = String(source.currentJobId || "").trim();
  const currentJobId = history.some((entry) => entry.jobId === currentJobIdRaw && (entry.status === "queued" || entry.status === "running")) ? currentJobIdRaw : null;
  return { currentJobId, history };
}
function upsertTennisTrainingHistoryEntry(history, nextEntry) {
  const next = [nextEntry, ...history.filter((entry) => entry.jobId !== nextEntry.jobId)].sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt)));
  return next.slice(0, MAX_TENNIS_TRAINING_HISTORY);
}
async function readTennisTrainingState() {
  const [setting] = await db.select().from(appSettings).where(eq8(appSettings.key, TENNIS_MODEL_TRAINING_STATE_KEY)).limit(1);
  const normalized = normalizeTennisTrainingState(setting?.value);
  const current = normalized.currentJobId ? normalized.history.find((entry) => entry.jobId === normalized.currentJobId) || null : null;
  if (current && (current.status === "queued" || current.status === "running") && activeTennisTrainingJobId !== current.jobId) {
    const repairedEntry = {
      ...current,
      status: "failed",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      error: "Training job was interrupted before completion."
    };
    const repairedState = {
      currentJobId: null,
      history: upsertTennisTrainingHistoryEntry(normalized.history, repairedEntry)
    };
    await db.insert(appSettings).values({
      key: TENNIS_MODEL_TRAINING_STATE_KEY,
      value: repairedState,
      ...buildInsertAuditFields(null)
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: repairedState,
        ...buildUpdateAuditFields(null)
      }
    });
    return repairedState;
  }
  return normalized;
}
async function writeTennisTrainingState(nextState, actorUserId) {
  const normalized = normalizeTennisTrainingState(nextState);
  await db.insert(appSettings).values({
    key: TENNIS_MODEL_TRAINING_STATE_KEY,
    value: normalized,
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: normalized,
      ...buildUpdateAuditFields(actorUserId || null)
    }
  });
  return normalized;
}
async function mutateTennisTrainingState(actorUserId, updater) {
  const current = await readTennisTrainingState();
  return writeTennisTrainingState(updater(current), actorUserId || null);
}
function buildTennisModelArchivePaths(modelVersion) {
  const safeVersion = String(modelVersion || "").trim().replace(/[^0-9A-Za-z._-]+/g, "_");
  const normalizedVersion = safeVersion.toLowerCase().startsWith("v") ? safeVersion : `v${safeVersion}`;
  return {
    modelPath: path4.join(TENNIS_MODEL_VERSION_ARCHIVE_DIR, `tennis_movement_classifier_${normalizedVersion}.joblib`)
  };
}
async function createTennisTrainingRun(jobId, actorUserId, payload) {
  await db.insert(tennisModelTrainingRuns).values({
    jobId,
    sportName: "tennis",
    status: payload.status,
    eligibleAnalysisCount: payload.eligibleAnalysisCount,
    eligibleShotCount: payload.eligibleShotCount,
    requestedAt: payload.requestedAt || /* @__PURE__ */ new Date(),
    startedAt: payload.startedAt || null,
    completedAt: payload.completedAt || null,
    requestedByUserId: payload.requestedByUserId || actorUserId,
    ...buildInsertAuditFields(actorUserId)
  });
}
async function updateTennisTrainingRun(jobId, actorUserId, patch) {
  const updates = {
    ...patch,
    ...buildUpdateAuditFields(actorUserId || null)
  };
  Object.keys(updates).forEach((key) => {
    if (updates[key] === void 0) delete updates[key];
  });
  await db.update(tennisModelTrainingRuns).set(updates).where(eq8(tennisModelTrainingRuns.jobId, jobId));
}
async function getLatestSuccessfulTennisTrainingRun() {
  const [row] = await db.select().from(tennisModelTrainingRuns).where(and4(eq8(tennisModelTrainingRuns.sportName, "tennis"), eq8(tennisModelTrainingRuns.status, "succeeded"))).orderBy(desc4(tennisModelTrainingRuns.completedAt), desc4(tennisModelTrainingRuns.updatedAt)).limit(1);
  return row || null;
}
async function getTennisTrainingStatus() {
  const modelPath = resolveProjectPath("models", "tennis_movement_classifier.joblib");
  const config = readModelRegistryConfig();
  const trainingState = await readTennisTrainingState();
  const [countsResult, latestRun, modelStats] = await Promise.all([
    db.execute(sql6`
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
    getLatestSuccessfulTennisTrainingRun(),
    statIfExists(modelPath)
  ]);
  const row = Array.isArray(countsResult.rows) ? countsResult.rows[0] : null;
  const metadata = latestRun?.metadata && typeof latestRun.metadata === "object" ? latestRun.metadata : null;
  const report = latestRun?.report && typeof latestRun.report === "object" ? latestRun.report : null;
  const macroF1Raw = report?.classificationReport?.["macro avg"]?.["f1-score"];
  const macroF1 = typeof macroF1Raw === "number" ? macroF1Raw : null;
  const latestTraining = latestRun && metadata ? {
    modelVersion: String(latestRun.savedModelVersion || metadata.modelVersion || config.activeModelVersion),
    trainedAt: String(metadata.trainedAt || latestRun.completedAt?.toISOString() || (modelStats?.mtime?.toISOString() || "")),
    trainRows: Number(latestRun.trainRows || metadata.trainRows || 0),
    testRows: Number(latestRun.testRows || metadata.testRows || 0),
    datasetPath: String(metadata.datasetPath || `database://tennis-training-datasets/${latestRun.datasetId || "latest"}`),
    macroF1
  } : null;
  return {
    sport: "tennis",
    eligibleAnalysisCount: Number(row?.eligible_analysis_count || 0),
    eligibleShotCount: Number(row?.eligible_shot_count || 0),
    trainedModelAvailable: Boolean(modelStats && latestRun),
    latestTraining,
    activeVersion: config.activeModelVersion,
    activeVersionDescription: config.modelVersionChangeDescription,
    draftVersion: incrementModelVersion(config.activeModelVersion),
    currentJob: trainingState.currentJobId ? trainingState.history.find((entry) => entry.jobId === trainingState.currentJobId) || null : null,
    history: trainingState.history
  };
}
async function getTennisDatasetInsights(params) {
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
    sql6`a.status = 'completed'`,
    sql6`m.ai_diagnostics is not null`,
    sql6`lower(coalesce(m.config_key, '')) like 'tennis-%'`
  ];
  if (playerId) {
    datasetWhereClauses.push(sql6`a.user_id = ${playerId}`);
  }
  if (startDate) {
    datasetWhereClauses.push(sql6`coalesce(a.captured_at, a.created_at) >= ${startDate.toISOString()}`);
  }
  if (endDate) {
    datasetWhereClauses.push(sql6`coalesce(a.captured_at, a.created_at) <= ${endDate.toISOString()}`);
  }
  const [eligibleResult, activeRun, trendRuns] = await Promise.all([
    db.execute(sql6`
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
      where ${sql6.join(datasetWhereClauses, sql6` and `)}
      order by a.created_at desc
    `),
    db.select().from(tennisModelTrainingRuns).where(
      and4(
        eq8(tennisModelTrainingRuns.sportName, "tennis"),
        eq8(tennisModelTrainingRuns.status, "succeeded"),
        eq8(tennisModelTrainingRuns.savedModelVersion, config.activeModelVersion)
      )
    ).orderBy(
      desc4(tennisModelTrainingRuns.savedAt),
      desc4(tennisModelTrainingRuns.completedAt),
      desc4(tennisModelTrainingRuns.updatedAt)
    ).limit(1).then((rows) => rows[0] || null),
    db.select().from(tennisModelTrainingRuns).where(
      and4(
        eq8(tennisModelTrainingRuns.sportName, "tennis"),
        eq8(tennisModelTrainingRuns.status, "succeeded"),
        sql6`${tennisModelTrainingRuns.savedModelVersion} is not null`
      )
    ).orderBy(
      desc4(tennisModelTrainingRuns.savedAt),
      desc4(tennisModelTrainingRuns.completedAt),
      desc4(tennisModelTrainingRuns.updatedAt)
    ).limit(12)
  ]);
  const eligibleRows = Array.isArray(eligibleResult.rows) ? eligibleResult.rows : [];
  const videoCounts = /* @__PURE__ */ new Map();
  const shotCounts = /* @__PURE__ */ new Map();
  const sessionCounts = /* @__PURE__ */ new Map();
  let eligibleShotCount = 0;
  for (const row of eligibleRows) {
    const rawLabels = Array.isArray(row.ordered_shot_labels) ? row.ordered_shot_labels : [];
    const normalizedLabels = rawLabels.map((value) => normalizeShotLabel(value)).filter((value) => TENNIS_DATASET_INSIGHT_LABELS.includes(value));
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
    sessionTypeDistribution: ["practice", "match-play"].map((label) => ({
      label,
      count: Number(sessionCounts.get(label) || 0),
      pct: toFixedPercent(Number(sessionCounts.get(label) || 0), eligibleRows.length)
    }))
  };
  let activeModel = null;
  if (activeRun) {
    const report = activeRun.report && typeof activeRun.report === "object" ? activeRun.report : {};
    const classificationReport = report.classificationReport && typeof report.classificationReport === "object" ? report.classificationReport : {};
    const rawLabels = Array.isArray(report.labels) ? report.labels.map((item) => normalizeShotLabel(item)) : [];
    const labelIndex = /* @__PURE__ */ new Map();
    rawLabels.forEach((label, index) => labelIndex.set(label, index));
    const matrix = Array.isArray(report.confusionMatrix) ? report.confusionMatrix : [];
    const accuracyFromReport = numberOrNull2(classificationReport.accuracy);
    const dataset = activeRun.datasetId ? await db.select().from(tennisTrainingDatasets).where(eq8(tennisTrainingDatasets.id, activeRun.datasetId)).limit(1).then((rows) => rows[0] || null) : null;
    const perLabel = TENNIS_DATASET_INSIGHT_LABELS.map((label) => {
      const metricsForLabel = classificationReport[label] && typeof classificationReport[label] === "object" ? classificationReport[label] : {};
      const rowIndex = labelIndex.get(label);
      const rowValues = rowIndex != null && Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
      const supportFromMatrix = rowValues.reduce((sum, value) => sum + Number(value || 0), 0);
      return {
        label,
        precision: numberOrNull2(metricsForLabel.precision),
        recall: numberOrNull2(metricsForLabel.recall),
        f1: numberOrNull2(metricsForLabel["f1-score"]),
        support: Number(numberOrNull2(metricsForLabel.support) ?? supportFromMatrix ?? 0)
      };
    });
    const confusionLabels = [...TENNIS_DATASET_INSIGHT_LABELS];
    const confusionRows = confusionLabels.map((actual) => {
      const actualIndex = labelIndex.get(actual);
      const actualRow = actualIndex != null && Array.isArray(matrix[actualIndex]) ? matrix[actualIndex] : [];
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
            pct: toFixedPercent(count, rowTotal)
          };
        })
      };
    });
    const matrixTotal = confusionRows.reduce(
      (total, row) => total + row.counts.reduce((sum, cell) => sum + cell.count, 0),
      0
    );
    const matrixCorrect = confusionRows.reduce(
      (total, row) => total + (row.counts.find((cell) => cell.predicted === row.actual)?.count || 0),
      0
    );
    activeModel = {
      modelVersion: String(activeRun.savedModelVersion || config.activeModelVersion),
      trainedAt: String(
        activeRun.savedAt?.toISOString() || activeRun.completedAt?.toISOString() || activeRun.requestedAt.toISOString()
      ),
      trainRows: Number(activeRun.trainRows || 0),
      testRows: Number(activeRun.testRows || 0),
      datasetAnalysisCount: Number(dataset?.analysisCount || 0),
      datasetShotCount: Number(dataset?.rowCount || 0),
      macroF1: numberOrNull2(activeRun.macroF1),
      accuracy: accuracyFromReport ?? (matrixTotal > 0 ? Number((matrixCorrect / matrixTotal).toFixed(4)) : null),
      perLabel,
      confusionMatrix: {
        labels: confusionLabels,
        rows: confusionRows
      }
    };
  }
  const versionsByNumber = new Map(
    listModelRegistryVersions().map((version) => [version.modelVersion, version])
  );
  const modelTrend = trendRuns.slice().reverse().map((run) => {
    const runReport = run.report && typeof run.report === "object" ? run.report : {};
    const trendClassificationReport = runReport.classificationReport && typeof runReport.classificationReport === "object" ? runReport.classificationReport : {};
    const versionMeta = versionsByNumber.get(String(run.savedModelVersion || ""));
    return {
      modelVersion: String(run.savedModelVersion || run.jobId),
      trainedAt: String(run.completedAt?.toISOString() || run.requestedAt.toISOString()),
      savedAt: run.savedAt?.toISOString() || null,
      macroF1: numberOrNull2(run.macroF1),
      accuracy: numberOrNull2(trendClassificationReport.accuracy),
      trainRows: Number(run.trainRows || 0),
      testRows: Number(run.testRows || 0),
      isActiveModelVersion: versionMeta?.status === "active",
      versionStatus: versionMeta?.status || "archived",
      versionDescription: versionMeta?.description || String(run.versionDescription || "")
    };
  });
  return {
    sport: "tennis",
    currentVersion: config.activeModelVersion,
    currentVersionDescription: config.modelVersionChangeDescription,
    filters: {
      playerId,
      startDate: startDate?.toISOString() || null,
      endDate: endDate?.toISOString() || null
    },
    currentDataset,
    activeModel,
    modelTrend,
    suggestions: buildTennisDatasetInsightSuggestions({
      currentDataset,
      activeModel: activeModel ? {
        macroF1: activeModel.macroF1,
        perLabel: activeModel.perLabel.map((item) => ({ label: item.label, f1: item.f1 }))
      } : null
    })
  };
}
async function trainTennisMovementModel(jobId, actorUserId) {
  const exportSummary = await exportTennisTrainingDatasetSnapshot({
    actorUserId,
    datasetName: `tennis-training-${jobId}`,
    notes: `Generated for job ${jobId}`
  });
  const trainingSummary = await runPythonJsonModuleWithInput(
    "python_analysis.train_tennis_movement_model",
    ["--dataset-json-stdin"],
    JSON.stringify({
      datasetId: exportSummary.datasetId,
      datasetPath: exportSummary.outputPath,
      rows: exportSummary.samples
    })
  );
  const status = await getTennisTrainingStatus();
  return {
    ...status,
    exportSummary: {
      outputPath: String(exportSummary?.outputPath || ""),
      rows: Number(exportSummary?.rows || 0),
      analyses: Number(exportSummary?.analyses || 0)
    },
    trainingSummary: {
      modelOut: String(trainingSummary?.modelOut || ""),
      trainRows: Number(trainingSummary?.trainRows || 0),
      testRows: Number(trainingSummary?.testRows || 0),
      labels: trainingSummary?.labels && typeof trainingSummary.labels === "object" ? trainingSummary.labels : {},
      macroF1: typeof trainingSummary?.macroF1 === "number" ? trainingSummary.macroF1 : null,
      metadata: trainingSummary?.metadata && typeof trainingSummary.metadata === "object" ? trainingSummary.metadata : {},
      report: trainingSummary?.report && typeof trainingSummary.report === "object" ? trainingSummary.report : {},
      datasetId: exportSummary.datasetId
    }
  };
}
async function runTennisTrainingJobInBackground(jobId, actorUserId) {
  activeTennisTrainingJobId = jobId;
  await updateTennisTrainingRun(jobId, actorUserId, {
    status: "running",
    startedAt: /* @__PURE__ */ new Date(),
    error: null
  });
  await mutateTennisTrainingState(actorUserId, (state) => {
    const current = state.history.find((entry) => entry.jobId === jobId);
    if (!current) return state;
    return {
      ...state,
      currentJobId: jobId,
      history: upsertTennisTrainingHistoryEntry(state.history, {
        ...current,
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        error: null
      })
    };
  });
  try {
    const result = await trainTennisMovementModel(jobId, actorUserId);
    await updateTennisTrainingRun(jobId, actorUserId, {
      status: "succeeded",
      completedAt: /* @__PURE__ */ new Date(),
      datasetId: result.trainingSummary.datasetId,
      exportRows: result.exportSummary.rows,
      trainRows: result.trainingSummary.trainRows,
      testRows: result.trainingSummary.testRows,
      macroF1: typeof result.trainingSummary.macroF1 === "number" ? result.trainingSummary.macroF1 : null,
      metadata: result.trainingSummary.metadata,
      report: result.trainingSummary.report,
      modelOutputPath: result.trainingSummary.modelOut,
      error: null
    });
    await mutateTennisTrainingState(actorUserId, (state) => {
      const current = state.history.find((entry) => entry.jobId === jobId);
      if (!current) return state;
      return {
        ...state,
        currentJobId: null,
        history: upsertTennisTrainingHistoryEntry(state.history, {
          ...current,
          status: "succeeded",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          exportRows: result.exportSummary.rows,
          trainRows: result.trainingSummary.trainRows,
          testRows: result.trainingSummary.testRows,
          macroF1: typeof result.trainingSummary.macroF1 === "number" ? result.trainingSummary.macroF1 : null,
          error: null
        })
      };
    });
  } catch (error) {
    await updateTennisTrainingRun(jobId, actorUserId, {
      status: "failed",
      completedAt: /* @__PURE__ */ new Date(),
      error: error?.message || "Training failed"
    });
    await mutateTennisTrainingState(actorUserId, (state) => {
      const current = state.history.find((entry) => entry.jobId === jobId);
      if (!current) return state;
      return {
        ...state,
        currentJobId: null,
        history: upsertTennisTrainingHistoryEntry(state.history, {
          ...current,
          status: "failed",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          error: error?.message || "Training failed"
        })
      };
    });
  } finally {
    activeTennisTrainingJobId = null;
    activeTennisTrainingPromise = null;
  }
}
async function queueTennisTrainingJob(actorUserId) {
  const status = await getTennisTrainingStatus();
  if (status.currentJob && (status.currentJob.status === "queued" || status.currentJob.status === "running")) {
    throw new Error("A tennis training job is already running.");
  }
  if (status.eligibleAnalysisCount < 1 || status.eligibleShotCount < 20) {
    throw new Error("Need at least 1 annotated tennis analysis and 20 labeled shots before training.");
  }
  const jobId = randomUUID3();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await createTennisTrainingRun(jobId, actorUserId, {
    status: "queued",
    eligibleAnalysisCount: status.eligibleAnalysisCount,
    eligibleShotCount: status.eligibleShotCount,
    requestedAt: new Date(now),
    requestedByUserId: actorUserId
  });
  await mutateTennisTrainingState(actorUserId, (state) => ({
    currentJobId: jobId,
    history: upsertTennisTrainingHistoryEntry(state.history, {
      jobId,
      status: "queued",
      requestedAt: now,
      startedAt: null,
      completedAt: null,
      requestedByUserId: actorUserId,
      eligibleAnalysisCount: status.eligibleAnalysisCount,
      eligibleShotCount: status.eligibleShotCount,
      exportRows: null,
      trainRows: null,
      testRows: null,
      macroF1: null,
      error: null,
      savedModelVersion: null,
      savedAt: null,
      versionDescription: null
    })
  }));
  activeTennisTrainingPromise = runTennisTrainingJobInBackground(jobId, actorUserId);
  return getTennisTrainingStatus();
}
async function saveCurrentTennisModelVersion(actorUserId, payload) {
  const modelPath = resolveProjectPath("models", "tennis_movement_classifier.joblib");
  const latestRun = await getLatestSuccessfulTennisTrainingRun();
  const modelStats = await statIfExists(modelPath);
  if (!modelStats || !latestRun) {
    throw new Error("Train a tennis model before saving a version.");
  }
  const config = readModelRegistryConfig();
  const modelVersion = String(payload?.modelVersion || "").trim() || incrementModelVersion(config.activeModelVersion);
  const description = String(payload?.description || "").trim() || `Tennis classifier ${modelVersion}`;
  const archivePaths = buildTennisModelArchivePaths(modelVersion);
  const [existingVersion] = await db.select().from(tennisModelTrainingRuns).where(eq8(tennisModelTrainingRuns.savedModelVersion, modelVersion)).limit(1);
  if (existingVersion || fs7.existsSync(archivePaths.modelPath)) {
    throw new Error(`Model version ${modelVersion} already exists. Choose a new version before saving.`);
  }
  await fs7.promises.mkdir(TENNIS_MODEL_VERSION_ARCHIVE_DIR, { recursive: true });
  await fs7.promises.copyFile(modelPath, archivePaths.modelPath);
  const nextMetadata = {
    ...latestRun.metadata && typeof latestRun.metadata === "object" ? latestRun.metadata : {},
    modelVersion,
    versionDescription: description,
    savedAt: (/* @__PURE__ */ new Date()).toISOString(),
    modelArtifactPath: archivePaths.modelPath
  };
  await updateTennisTrainingRun(latestRun.jobId, actorUserId, {
    savedModelVersion: modelVersion,
    savedModelArtifactPath: archivePaths.modelPath,
    savedAt: /* @__PURE__ */ new Date(),
    versionDescription: description,
    metadata: nextMetadata
  });
  await writeModelRegistryConfig({
    activeModelVersion: modelVersion,
    modelVersionChangeDescription: description,
    evaluationDatasetManifestPath: "database://model-registry"
  }, actorUserId);
  await mutateTennisTrainingState(actorUserId, (state) => {
    const latestSuccessful = state.history.find((entry) => entry.status === "succeeded");
    if (!latestSuccessful) return state;
    return {
      ...state,
      history: upsertTennisTrainingHistoryEntry(state.history, {
        ...latestSuccessful,
        savedModelVersion: modelVersion,
        savedAt: (/* @__PURE__ */ new Date()).toISOString(),
        versionDescription: description
      })
    };
  });
  return getTennisTrainingStatus();
}
async function resolveUserDominantProfile(userId) {
  if (!userId) return null;
  const [profile] = await db.select({ dominantProfile: users.dominantProfile }).from(users).where(eq8(users.id, userId)).limit(1);
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
function parseUploadRecordedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return parseDateValue(raw);
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
function toFixedPercent(count, total) {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;
  return Number((count / total * 100).toFixed(1));
}
function normalizeTennisSessionType(value) {
  return normalizeFilterToken(value) === "match-play" ? "match-play" : "practice";
}
function buildInsightDistribution(counts, total, labels) {
  return labels.map((label) => ({
    label,
    count: Number(counts.get(label) || 0),
    pct: toFixedPercent(Number(counts.get(label) || 0), total)
  }));
}
function getPrimaryInsightLabel(labels) {
  const counts = /* @__PURE__ */ new Map();
  for (const rawLabel of labels) {
    const label = normalizeShotLabel(rawLabel);
    if (!TENNIS_DATASET_INSIGHT_LABELS.includes(label)) {
      continue;
    }
    counts.set(label, Number(counts.get(label) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return TENNIS_DATASET_INSIGHT_LABELS.indexOf(left[0]) - TENNIS_DATASET_INSIGHT_LABELS.indexOf(right[0]);
  });
  return sorted[0]?.[0] || "unknown";
}
function numberOrNull2(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseDateFilterBoundary(value, boundary) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const normalized = boundary === "start" ? `${raw}T00:00:00.000Z` : `${raw}T23:59:59.999Z`;
    const parsed2 = new Date(normalized);
    return Number.isNaN(parsed2.getTime()) ? null : parsed2;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function buildTennisDatasetInsightSuggestions(payload) {
  const suggestions = [];
  const practiceShare = payload.currentDataset.sessionTypeDistribution.find((item) => item.label === "practice")?.pct || 0;
  const matchPlayShare = payload.currentDataset.sessionTypeDistribution.find((item) => item.label === "match-play")?.pct || 0;
  if (practiceShare >= 70) {
    suggestions.push("Current training pool is practice-heavy. Add more annotated match-play videos so the classifier sees live-point stroke variation.");
  } else if (matchPlayShare >= 70) {
    suggestions.push("Current training pool is match-play-heavy. Add a few focused drill videos to sharpen single-stroke examples.");
  }
  const underrepresentedVideoLabels = payload.currentDataset.videoDistribution.filter((item) => item.pct > 0 && item.pct < 15).map((item) => item.label);
  if (underrepresentedVideoLabels.length > 0) {
    suggestions.push(`Video coverage is thin for ${underrepresentedVideoLabels.join(", ")}. Prioritize new uploads there before the next retrain.`);
  }
  const underrepresentedShotLabels = payload.currentDataset.shotDistribution.filter((item) => item.pct > 0 && item.pct < 10).map((item) => item.label);
  if (underrepresentedShotLabels.length > 0) {
    suggestions.push(`Shot-level balance is light for ${underrepresentedShotLabels.join(", ")}. More labels in those classes should reduce class skew.`);
  }
  if (payload.activeModel?.macroF1 != null && payload.activeModel.macroF1 < 0.8) {
    suggestions.push("Active model Macro F1 is below 80%. Rebalance the dataset, then retrain and compare per-label results before saving the next version.");
  }
  const weakestLabel = (payload.activeModel?.perLabel || []).filter((item) => item.f1 != null).sort((left, right) => Number(left.f1 || 0) - Number(right.f1 || 0))[0];
  if (weakestLabel?.f1 != null && weakestLabel.f1 < 0.7) {
    suggestions.push(`Per-label quality is weakest on ${weakestLabel.label}. Review annotation consistency there and add more examples before promoting another version.`);
  }
  if (suggestions.length === 0) {
    suggestions.push("Dataset balance and active-model quality look reasonable. Keep adding fresh annotated videos and recheck after each saved version.");
  }
  return suggestions.slice(0, 4);
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
function normalizeTenOrHundredScoreForImprovedModel(value) {
  if (!Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return n <= 10 ? n * 10 : n;
}
function buildImprovedTacticalDetail(key, scoreRaw) {
  const score = Number(scoreRaw);
  const normalized = Number.isFinite(score) ? Number(Math.max(1, Math.min(10, score)).toFixed(1)) : 5.5;
  if (key === "power") {
    return {
      key,
      label: "Power",
      score: normalized,
      explanation: normalized >= 8 ? "Ball quality and body drive are creating strong pressure through the session." : normalized >= 6 ? "Power is present, but cleaner force transfer would raise penetration." : "Power output fades too often; body drive and acceleration need work."
    };
  }
  if (key === "control") {
    return {
      key,
      label: "Control",
      score: normalized,
      explanation: normalized >= 8 ? "You are controlling ball shape and depth well under live-play variation." : normalized >= 6 ? "Control is usable, but quality drops when tempo rises." : "Control is unstable and is leaking points through short or rushed execution."
    };
  }
  if (key === "timing") {
    return {
      key,
      label: "Timing",
      score: normalized,
      explanation: normalized >= 8 ? "Preparation and strike timing stay coordinated across the rally." : normalized >= 6 ? "Timing is mostly solid, but setup arrives late on some shots." : "Late preparation is forcing rushed contact and weaker transitions."
    };
  }
  return {
    key,
    label: "Technique",
    score: normalized,
    explanation: normalized >= 8 ? "Your movement shapes and shot mechanics hold together well during play." : normalized >= 6 ? "Technique remains serviceable, though shape breaks down under pressure." : "Mechanical shape is inconsistent and needs better repeatability in live points."
  };
}
function buildImprovedStrokeMix(aiDiagnosticsRaw) {
  const aiDiagnostics = aiDiagnosticsRaw && typeof aiDiagnosticsRaw === "object" ? aiDiagnosticsRaw : {};
  const countsRaw = aiDiagnostics.movementTypeCounts && typeof aiDiagnostics.movementTypeCounts === "object" ? aiDiagnostics.movementTypeCounts : {};
  const strokes = ["forehand", "backhand", "serve", "volley"];
  const rows = strokes.map((stroke) => ({
    stroke,
    count: Math.max(0, Math.trunc(Number(countsRaw[stroke] || 0)))
  })).filter((item) => item.count > 0);
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return [];
  return rows.map((item) => ({
    stroke: item.stroke,
    count: item.count,
    sharePct: Number((item.count / total * 100).toFixed(1))
  })).sort((a, b) => b.count - a.count);
}
function buildImprovedTennisReportFromMetrics(requestedSessionType, configKey, detectedMovement, metricValuesRaw, tacticalComponentsRaw, overallScoreRaw, aiDiagnosticsRaw) {
  const metricValues = metricValuesRaw && typeof metricValuesRaw === "object" ? metricValuesRaw : {};
  const tacticalComponents = tacticalComponentsRaw && typeof tacticalComponentsRaw === "object" ? tacticalComponentsRaw : {};
  const normalizedSessionType = String(requestedSessionType || "").trim().toLowerCase();
  const normalizedConfigKey = String(configKey || "").trim().toLowerCase();
  const sessionType = normalizedSessionType === "match-play" || normalizedConfigKey === "tennis-game" ? "match-play" : "practice";
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
  const shotConsistency = normalizeTenOrHundredScoreForImprovedModel(
    improvedPickMetric(metricValues, ["shotConsistency", "shot_consistency"])
  );
  const rhythmConsistency = normalizeTenOrHundredScoreForImprovedModel(
    improvedPickMetric(metricValues, ["rhythmConsistency", "rhythm_consistency"])
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
      0.5 * improvedNorm(balanceScoreForModel, 55, 98) + 0.3 * improvedNorm(courtCoverage, 30, 98) + 0.2 * improvedNorm(recoverySpeed, 1.5, 6)
    );
    const contactQuality = improvedScoreFromUnit(
      0.45 * improvedNorm(shotConsistency, 55, 98) + 0.35 * improvedNorm(ballSpeed, 40, 100) + 0.2 * improvedNorm(rhythmConsistency, 50, 95)
    );
    const strokeShape = improvedScoreFromUnit(
      0.55 * improvedNorm(rhythmConsistency, 50, 95) + 0.45 * improvedNorm(shotVariety, 30, 95)
    );
    const forceTransfer = improvedScoreFromUnit(
      0.35 * improvedNorm(hipRotationSpeed, 250, 1100) + 0.25 * improvedNorm(shoulderRotationSpeed, 300, 1200) + 0.2 * improvedNorm(ballSpeed, 40, 100) + 0.2 * improvedNorm(balanceScoreForModel, 55, 98)
    );
    const biomechanics2 = [
      {
        key: "balance-load",
        label: "Balance Under Load",
        score: balanceUnderLoad,
        explanation: balanceUnderLoad >= 8 ? "You are staying organized and stable while moving through live-play demands." : balanceUnderLoad >= 6 ? "Balance holds up reasonably well, but body control drops at higher tempo." : "Stability under live pressure is inconsistent and is affecting shot quality."
      },
      {
        key: "contact-quality",
        label: "Contact Quality",
        score: contactQuality,
        explanation: contactQuality >= 8 ? "Contact quality is repeatable across rallies, giving you cleaner ball outcomes." : contactQuality >= 6 ? "Contact quality is workable, though it dips during faster exchanges." : "Inconsistent contact quality is limiting depth, pace, and repeatability."
      },
      {
        key: "stroke-shape",
        label: "Stroke Shape & Rhythm",
        score: strokeShape,
        explanation: strokeShape >= 8 ? "Your shapes and rhythm remain composed across a varied shot mix." : strokeShape >= 6 ? "Stroke shape is mostly stable, but rhythm breaks under rally stress." : "Stroke shape and rhythm drift too often during points."
      },
      {
        key: "force-transfer",
        label: "Force Transfer",
        score: forceTransfer,
        explanation: forceTransfer >= 8 ? "Body sequencing is turning movement into useful ball pressure consistently." : forceTransfer >= 6 ? "Force transfer is present, but some shots still rely too much on the arm." : "Energy transfer is inefficient and is capping reliable match-play pressure."
      }
    ];
    const tactical = [
      buildImprovedTacticalDetail("power", tacticalComponents.power),
      buildImprovedTacticalDetail("control", tacticalComponents.control),
      buildImprovedTacticalDetail("timing", tacticalComponents.timing),
      buildImprovedTacticalDetail("technique", tacticalComponents.technique)
    ];
    const movement2 = [
      {
        key: "ready-base",
        label: "Ready Base",
        score: improvedScoreFromUnit(
          0.5 * improvedNorm(balanceScoreForModel, 55, 98) + 0.5 * improvedNorm(rhythmConsistency, 50, 95)
        ),
        explanation: "How consistently you establish a usable base before the next ball."
      },
      {
        key: "react-ball",
        label: "React To Ball",
        score: improvedScoreFromUnit(
          0.6 * improvedNorm(courtCoverage, 30, 98) + 0.4 * improvedNorm(recoverySpeed, 1.5, 6)
        ),
        explanation: "How quickly your movement patterns turn recognition into usable court position."
      },
      {
        key: "recover-neutral",
        label: "Recover To Neutral",
        score: improvedScoreFromUnit(
          0.65 * improvedNorm(recoverySpeed, 1.5, 6) + 0.35 * improvedNorm(balanceScoreForModel, 55, 98)
        ),
        explanation: "How efficiently you reset after contact and prepare for the next ball."
      },
      {
        key: "sustain-rally",
        label: "Sustain Rally",
        score: improvedScoreFromUnit(
          0.55 * improvedNorm(rallyLength, 3, 12) + 0.45 * improvedNorm(shotConsistency, 55, 98)
        ),
        explanation: "How well your movement and shot quality hold up across longer exchanges."
      },
      {
        key: "cover-space",
        label: "Cover Space",
        score: improvedScoreFromUnit(
          0.7 * improvedNorm(courtCoverage, 30, 98) + 0.3 * improvedNorm(recoverySpeed, 1.5, 6)
        ),
        explanation: "How effectively you move into and out of the spaces the rally demands."
      }
    ];
    const strokeMix = buildImprovedStrokeMix(aiDiagnosticsRaw);
    const allItems = [...biomechanics2, ...tactical, ...movement2].sort((a, b) => b.score - a.score);
    const strongest2 = allItems.slice(0, 3);
    const weakest2 = [...allItems].reverse().slice(0, 3);
    const storedOverallScore = Number(overallScoreRaw);
    const overallScore2 = Number.isFinite(storedOverallScore) ? Math.max(0, Math.min(100, Math.round(storedOverallScore))) : Math.round(
      improvedClamp(
        (biomechanics2.reduce((sum, item) => sum + item.score, 0) / Math.max(biomechanics2.length, 1) * 0.3 + tactical.reduce((sum, item) => sum + item.score, 0) / Math.max(tactical.length, 1) * 0.4 + movement2.reduce((sum, item) => sum + item.score, 0) / Math.max(movement2.length, 1) * 0.3) * 10,
        0,
        100
      )
    );
    const coachingTips2 = [
      `${weakest2[0]?.label || "Control"}: make this the first match-play training priority.`,
      `${weakest2[1]?.label || "Recover To Neutral"}: improve this with live-ball repetition and short-interval work.`,
      strokeMix.length > 0 ? `${strokeMix[0].stroke.charAt(0).toUpperCase()}${strokeMix[0].stroke.slice(1)} made up ${strokeMix[0].sharePct}% of the session. Train that pattern first, then stabilize the weakest secondary pattern.` : "Use live-ball sequences that challenge recovery, spacing, and shot selection under pressure."
    ];
    return {
      sessionType,
      stroke: "match-play",
      biomechanics: biomechanics2,
      tactical,
      movement: movement2,
      strokeMix,
      strengths: strongest2.map((item) => `${item.label} is a match-play strength (${item.score}/10).`),
      improvementAreas: weakest2.map((item) => `${item.label} is the next match-play improvement area (${item.score}/10).`),
      coachingTips: coachingTips2,
      overallScore: overallScore2
    };
  }
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
    sessionType,
    stroke,
    biomechanics,
    tactical: [],
    movement,
    strokeMix: [],
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
var VIDEO_VALIDATION_MODE_KEY2 = "videoValidationMode";
var ANALYSIS_FPS_MODE_KEY2 = "analysisFpsMode";
function isAnalysisFpsMode2(value) {
  return value === "3fps" || value === "6fps" || value === "12fps" || value === "15fps" || value === "24fps" || value === "30fps" || value === "full";
}
function isAnalysisFpsStep2(value) {
  return value === "step1" || value === "step2" || value === "step3";
}
function coerceLowImpactStep2(value) {
  if (isAnalysisFpsStep2(value)) return value;
  if (isAnalysisFpsMode2(value)) {
    if (value === "15fps") return "step2";
    if (value === "12fps" || value === "6fps" || value === "3fps") return "step3";
    return "step1";
  }
  return "step2";
}
function coerceHighImpactStep2(value) {
  if (isAnalysisFpsStep2(value)) return value;
  if (isAnalysisFpsMode2(value)) {
    if (value === "15fps") return "step2";
    if (value === "12fps" || value === "6fps" || value === "3fps") return "step3";
    return "step1";
  }
  return "step1";
}
var SKELETON_CACHE_TTL_MS = 5 * 60 * 1e3;
var SKELETON_CACHE_MAX_ENTRIES = 200;
var skeletonCache = /* @__PURE__ */ new Map();
function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
function createSkeletonRecord(video_id, shot_id, frame_number, landmarks, timestamp2 = 0) {
  const mappedLandmarks = (landmarks || []).slice(0, 33).map((joint, idx) => ({
    id: Number.isFinite(Number(joint.id)) ? Number(joint.id) : idx,
    x: clamp01(Number(joint.x)),
    y: clamp01(Number(joint.y)),
    z: clamp01(Number(joint.z)),
    visibility: clamp01(Number(joint.visibility))
  }));
  return {
    frame_number: Number(frame_number),
    timestamp: Number.isFinite(Number(timestamp2)) ? Number(timestamp2) : 0,
    landmarks: mappedLandmarks
  };
}
function normalizeSkeletonDataset(raw, fallbackVideoId) {
  if (!raw || typeof raw !== "object") return null;
  const source = raw;
  const video_id = String(source.video_id || fallbackVideoId || "").trim();
  if (!video_id) return null;
  const rawShots = Array.isArray(source.shots) ? source.shots : [];
  const shots = rawShots.map((item, idx) => {
    const shot = item && typeof item === "object" ? item : {};
    const shot_id = Number.isFinite(Number(shot.shot_id)) ? Number(shot.shot_id) : idx + 1;
    const rawFrames = Array.isArray(shot.frames) ? shot.frames : [];
    const frames = rawFrames.map((frameRaw) => {
      const frame = frameRaw && typeof frameRaw === "object" ? frameRaw : {};
      const frame_number = Number.isFinite(Number(frame.frame_number)) ? Number(frame.frame_number) : 0;
      const timestamp2 = Number.isFinite(Number(frame.timestamp)) ? Number(frame.timestamp) : 0;
      const landmarks = Array.isArray(frame.landmarks) ? frame.landmarks : [];
      return createSkeletonRecord(video_id, shot_id, frame_number, landmarks, timestamp2);
    }).filter((frame) => frame.frame_number > 0);
    return {
      shot_id,
      frames
    };
  }).filter((shot) => shot.frames.length > 0);
  return {
    video_id,
    shots
  };
}
function buildSkeletonCacheEntry(dataset) {
  const shotsById = /* @__PURE__ */ new Map();
  for (const shot of dataset.shots) {
    const sortedFrames = [...shot.frames].sort((a, b) => a.frame_number - b.frame_number);
    const frameNumbers = sortedFrames.map((frame) => frame.frame_number);
    const framesByNumber = /* @__PURE__ */ new Map();
    for (const frame of sortedFrames) {
      framesByNumber.set(frame.frame_number, frame);
    }
    shotsById.set(shot.shot_id, {
      shot: {
        ...shot,
        frames: sortedFrames
      },
      frameNumbers,
      framesByNumber
    });
  }
  const now = Date.now();
  return {
    dataset,
    shotsById,
    cachedAt: now,
    expiresAt: now + SKELETON_CACHE_TTL_MS
  };
}
function evictOldestSkeletonCacheEntry() {
  if (skeletonCache.size < SKELETON_CACHE_MAX_ENTRIES) return;
  let oldestKey = null;
  let oldestTime = Number.POSITIVE_INFINITY;
  for (const [key, entry] of skeletonCache.entries()) {
    if (entry.cachedAt < oldestTime) {
      oldestTime = entry.cachedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) skeletonCache.delete(oldestKey);
}
function invalidateSkeletonCache(video_id) {
  skeletonCache.delete(video_id);
}
function getCachedSkeletonEntry(video_id) {
  const hit = skeletonCache.get(video_id);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    skeletonCache.delete(video_id);
    return null;
  }
  return hit;
}
function setCachedSkeletonEntry(video_id, entry) {
  evictOldestSkeletonCacheEntry();
  skeletonCache.set(video_id, entry);
}
function lowerBoundFrameIndex(values, target) {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function upperBoundFrameIndex(values, target) {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function selectShotFramesByRange(shotIndex, startFrame, endFrame) {
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
async function getSkeletonCacheEntry(video_id) {
  const cached = getCachedSkeletonEntry(video_id);
  if (cached) return cached;
  const [row] = await db.select({ aiDiagnostics: metrics.aiDiagnostics }).from(metrics).where(eq8(metrics.analysisId, video_id)).limit(1);
  const diagnostics = row?.aiDiagnostics && typeof row.aiDiagnostics === "object" ? row.aiDiagnostics : null;
  if (!diagnostics) return null;
  const dataset = normalizeSkeletonDataset(diagnostics.skeletonData, video_id);
  if (!dataset) return null;
  const entry = buildSkeletonCacheEntry(dataset);
  setCachedSkeletonEntry(video_id, entry);
  return entry;
}
async function getShotSkeleton(video_id, shot_id, startFrame, endFrame) {
  const cacheEntry = await getSkeletonCacheEntry(video_id);
  if (!cacheEntry) return null;
  const shot = cacheEntry.shotsById.get(shot_id);
  if (!shot) return null;
  const frames = selectShotFramesByRange(shot, startFrame, endFrame);
  return {
    video_id: cacheEntry.dataset.video_id,
    shot_id,
    frames
  };
}
async function getFrameSkeleton(video_id, shot_id, frame_number) {
  const cacheEntry = await getSkeletonCacheEntry(video_id);
  if (!cacheEntry) return null;
  const shot = cacheEntry.shotsById.get(shot_id);
  if (!shot) return null;
  const frame = shot.framesByNumber.get(frame_number);
  if (!frame) return null;
  return {
    video_id: cacheEntry.dataset.video_id,
    shot_id,
    frame
  };
}
function applyDbRangesToConfig(config, rows) {
  const byMetricKey = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byMetricKey.set(String(row.metricKey || ""), row);
  }
  const metricsByKey = /* @__PURE__ */ new Map();
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
        optimalRange: normalizeMetricRangeToTenScale(key, [Number(row.optimalMin), Number(row.optimalMax)])
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
      optimalRange: normalizeMetricRangeToTenScale(key, [Number(row.optimalMin), Number(row.optimalMax)])
    });
  }
  const metrics3 = Array.from(metricsByKey.values()).map((metric) => {
    const row = byMetricKey.get(metric.key);
    if (!row) return metric;
    return {
      ...metric,
      label: row.metricLabel || metric.label,
      unit: normalizeMetricUnit(metric.key, row.unit || metric.unit),
      optimalRange: normalizeMetricRangeToTenScale(metric.key, [Number(row.optimalMin), Number(row.optimalMax)])
    };
  });
  return {
    ...config,
    metrics: metrics3
  };
}
async function fetchMetricRangeRows(filters = {}) {
  const conditions = [];
  if (filters.configKey) {
    conditions.push(eq8(sportCategoryMetricRanges.configKey, String(filters.configKey).trim()));
  }
  if (filters.metricKey) {
    conditions.push(eq8(sportCategoryMetricRanges.metricKey, String(filters.metricKey).trim()));
  }
  if (filters.sportName) {
    conditions.push(
      sql6`lower(${sportCategoryMetricRanges.sportName}) = ${String(filters.sportName).trim().toLowerCase()}`
    );
  }
  if (filters.movementName) {
    conditions.push(
      sql6`lower(${sportCategoryMetricRanges.movementName}) = ${String(filters.movementName).trim().toLowerCase()}`
    );
  }
  if (!filters.includeInactive) {
    conditions.push(eq8(sportCategoryMetricRanges.isActive, true));
  }
  const rows = await db.select().from(sportCategoryMetricRanges).where(conditions.length ? and4(...conditions) : void 0).orderBy(
    asc3(sportCategoryMetricRanges.configKey),
    asc3(sportCategoryMetricRanges.metricKey)
  );
  return rows;
}
function normalizeMetricRangeRow(row) {
  const metricKey = String(row.metricKey || "").trim();
  return {
    ...row,
    unit: normalizeMetricUnit(metricKey, row.unit),
    optimalMin: normalizeMetricValueToTenScale(metricKey, Number(row.optimalMin)),
    optimalMax: normalizeMetricValueToTenScale(metricKey, Number(row.optimalMax))
  };
}
async function getVideoValidationMode2(actorUserId) {
  const [setting] = await db.select().from(appSettings).where(eq8(appSettings.key, VIDEO_VALIDATION_MODE_KEY2)).limit(1);
  const rawMode = setting?.value && typeof setting.value === "object" ? setting.value.mode : null;
  if (isVideoValidationMode(rawMode)) {
    return rawMode;
  }
  const defaultMode = "disabled";
  await db.insert(appSettings).values({
    key: VIDEO_VALIDATION_MODE_KEY2,
    value: { mode: defaultMode },
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoNothing();
  return defaultMode;
}
async function setVideoValidationMode(mode, actorUserId) {
  await db.insert(appSettings).values({
    key: VIDEO_VALIDATION_MODE_KEY2,
    value: { mode },
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: { mode },
      ...buildUpdateAuditFields(actorUserId || null)
    }
  });
}
async function ensureVideoValidationModeSetting() {
  await db.insert(appSettings).values({
    key: VIDEO_VALIDATION_MODE_KEY2,
    value: { mode: "disabled" },
    ...buildInsertAuditFields(null)
  }).onConflictDoNothing();
}
async function getAnalysisFpsSettings2(actorUserId) {
  const [setting] = await db.select().from(appSettings).where(eq8(appSettings.key, ANALYSIS_FPS_MODE_KEY2)).limit(1);
  const rawValue = setting?.value && typeof setting.value === "object" ? setting.value : null;
  const lowImpactStep = coerceLowImpactStep2(rawValue?.lowImpactStep ?? rawValue?.lowImpactMode);
  const highImpactStep = coerceHighImpactStep2(rawValue?.highImpactStep ?? rawValue?.highImpactMode);
  const tennisAutoDetectUsesHighImpact = Boolean(rawValue?.tennisAutoDetectUsesHighImpact);
  const tennisMatchPlayUsesHighImpact = Boolean(rawValue?.tennisMatchPlayUsesHighImpact);
  if (setting && rawValue?.lowImpactStep === lowImpactStep && rawValue?.highImpactStep === highImpactStep && rawValue?.tennisAutoDetectUsesHighImpact === tennisAutoDetectUsesHighImpact && rawValue?.tennisMatchPlayUsesHighImpact === tennisMatchPlayUsesHighImpact) {
    return {
      lowImpactStep,
      highImpactStep,
      tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact
    };
  }
  const value = {
    lowImpactStep,
    highImpactStep,
    tennisAutoDetectUsesHighImpact,
    tennisMatchPlayUsesHighImpact
  };
  await db.insert(appSettings).values({
    key: ANALYSIS_FPS_MODE_KEY2,
    value,
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value,
      ...buildUpdateAuditFields(actorUserId || null)
    }
  });
  return value;
}
async function setAnalysisFpsSettings(settings, actorUserId) {
  await db.insert(appSettings).values({
    key: ANALYSIS_FPS_MODE_KEY2,
    value: settings,
    ...buildInsertAuditFields(actorUserId || null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: settings,
      ...buildUpdateAuditFields(actorUserId || null)
    }
  });
}
async function ensureAnalysisFpsSetting() {
  await db.insert(appSettings).values({
    key: ANALYSIS_FPS_MODE_KEY2,
    value: {
      lowImpactStep: "step2",
      highImpactStep: "step1",
      tennisAutoDetectUsesHighImpact: false,
      tennisMatchPlayUsesHighImpact: false
    },
    ...buildInsertAuditFields(null)
  }).onConflictDoNothing();
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
    path4.basename(sourceFilename),
    videoFilename,
    path4.basename(videoFilename)
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
  }).from(analysisShotDiscrepancies).innerJoin(analyses, eq8(analysisShotDiscrepancies.analysisId, analyses.id)).where(eq8(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion)) : await db.select({
    discrepancy: analysisShotDiscrepancies,
    analysis: analyses
  }).from(analysisShotDiscrepancies).innerJoin(analyses, eq8(analysisShotDiscrepancies.analysisId, analyses.id)).where(
    and4(
      eq8(analysisShotDiscrepancies.modelVersion, modelConfig.activeModelVersion),
      eq8(analysisShotDiscrepancies.userId, userId)
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
  if (analysis.videoPath) {
    try {
      const diagnostics = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => runPythonDiagnostics2(
          localPath,
          sportName,
          movementName,
          dominantProfile
        )
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
    const [sport] = await db.select().from(sports).where(eq8(sports.id, analysis.sportId));
    if (sport?.name) {
      sportName = sport.name;
    }
  }
  if (analysis.movementId) {
    const [movement] = await db.select().from(sportMovements).where(eq8(sportMovements.id, analysis.movementId));
    if (movement?.name) {
      movementName = movement.name;
    }
  }
  return { sportName, movementName };
}
async function attachVideoUrl(row) {
  return {
    ...row,
    videoUrl: await resolveMediaUrl(row.videoPath || null)
  };
}
var AUDIT_METADATA_BACKFILL_KEY = "AUDIT_METADATA_BACKFILL_V1";
async function ensureAuditMetadataBackfill() {
  const [existing] = await db.select().from(appSettings).where(eq8(appSettings.key, AUDIT_METADATA_BACKFILL_KEY)).limit(1);
  if (existing) {
    return;
  }
  await db.execute(sql6`
    update users
    set
      updated_at = coalesce(updated_at, created_at, now()),
      created_by_user_id = coalesce(created_by_user_id, id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, id)
    where updated_at is null
       or created_by_user_id is null
       or updated_by_user_id is null
  `);
  await db.execute(sql6`
    update sports
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where created_at is null
       or updated_at is null
  `);
  await db.execute(sql6`
    update sport_movements
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where created_at is null
       or updated_at is null
  `);
  await db.execute(sql6`
    update analyses
    set
      created_by_user_id = coalesce(created_by_user_id, user_id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, user_id)
    where created_by_user_id is null
       or updated_by_user_id is null
  `);
  await db.execute(sql6`
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
  await db.execute(sql6`
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
  await db.execute(sql6`
    update analysis_feedback
    set
      updated_at = coalesce(updated_at, created_at, now()),
      created_by_user_id = coalesce(created_by_user_id, user_id),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id, user_id)
    where updated_at is null
       or created_by_user_id is null
       or updated_by_user_id is null
  `);
  await db.execute(sql6`
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
  await db.execute(sql6`
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
  await db.execute(sql6`
    update app_settings
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now())
    where created_at is null
       or updated_at is null
  `);
  await db.execute(sql6`
    update sport_category_metric_ranges
    set
      created_at = coalesce(created_at, updated_at, now()),
      updated_at = coalesce(updated_at, created_at, now()),
      updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id)
    where created_at is null
       or updated_at is null
       or updated_by_user_id is null
  `);
  await db.insert(appSettings).values({
    key: AUDIT_METADATA_BACKFILL_KEY,
    value: {
      version: 1,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    ...buildInsertAuditFields(null)
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: {
        version: 1,
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      ...buildUpdateAuditFields(null)
    }
  });
  console.log("Applied one-time audit metadata backfill for existing records");
}
async function refreshDiscrepancySnapshotsForAnalysis(analysisId) {
  const modelConfig = readModelRegistryConfig();
  const [analysis] = await db.select().from(analyses).where(eq8(analyses.id, analysisId)).limit(1);
  if (!analysis) {
    return { refreshed: 0, skipped: 1 };
  }
  const annotations = await db.select().from(analysisShotAnnotations).where(eq8(analysisShotAnnotations.analysisId, analysisId));
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
        confusionPairs: snapshot.confusionPairs,
        ...buildInsertAuditFields(annotation.userId)
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
          ...buildUpdateAuditFields(annotation.userId)
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
  await db.execute(sql6`alter table users add column if not exists dominant_profile text`);
  await db.execute(sql6`alter table users add column if not exists updated_at timestamp default now()`);
  await db.execute(sql6`alter table users add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table users add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`
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
  await db.execute(sql6`alter table sports add column if not exists created_at timestamp default now()`);
  await db.execute(sql6`alter table sports add column if not exists updated_at timestamp default now()`);
  await db.execute(sql6`alter table sports add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table sports add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`alter table sports add column if not exists enabled boolean`);
  await db.execute(sql6`
    update sports
    set enabled = case
      when lower(name) = 'tennis' then true
      else false
    end
    where enabled is null
  `);
  await db.execute(sql6`alter table sports alter column enabled set default false`);
  await db.execute(sql6`update sports set enabled = true where lower(name) = 'tennis' and enabled is null`);
  await db.execute(sql6`alter table sport_movements add column if not exists created_at timestamp default now()`);
  await db.execute(sql6`alter table sport_movements add column if not exists updated_at timestamp default now()`);
  await db.execute(sql6`alter table sport_movements add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table sport_movements add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`alter table analyses add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table analyses add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`alter table metrics add column if not exists score_inputs jsonb`);
  await db.execute(sql6`alter table metrics add column if not exists score_outputs jsonb`);
  await db.execute(sql6`alter table metrics add column if not exists ai_diagnostics jsonb`);
  await db.execute(sql6`alter table metrics add column if not exists updated_at timestamp default now()`);
  await db.execute(sql6`alter table metrics add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table metrics add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`alter table coaching_insights add column if not exists updated_at timestamp default now()`);
  await db.execute(sql6`alter table coaching_insights add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table coaching_insights add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`alter table analysis_feedback add column if not exists updated_at timestamp default now()`);
  await db.execute(sql6`alter table analysis_feedback add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table analysis_feedback add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`alter table metrics drop column if exists tactical_scores`);
  await db.execute(sql6`alter table metrics drop column if exists sub_scores`);
  await db.execute(sql6`
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
  await db.execute(sql6`alter table analysis_shot_annotations add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table analysis_shot_annotations add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`
    create unique index if not exists analysis_shot_annotations_analysis_user_uq
    on analysis_shot_annotations (analysis_id, user_id)
  `);
  await db.execute(sql6`
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
  await db.execute(sql6`alter table analysis_shot_discrepancies add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table analysis_shot_discrepancies add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`
    create unique index if not exists analysis_shot_discrepancies_analysis_user_uq
    on analysis_shot_discrepancies (analysis_id, user_id)
  `);
  await db.execute(sql6`
    create table if not exists app_settings (
      key varchar primary key,
      value jsonb not null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
      ,created_by_user_id varchar
      ,updated_by_user_id varchar
    )
  `);
  await db.execute(sql6`alter table app_settings add column if not exists created_at timestamp default now()`);
  await db.execute(sql6`alter table app_settings add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table app_settings add column if not exists updated_by_user_id varchar`);
  await ensureVideoValidationModeSetting();
  await ensureAnalysisFpsSetting();
  await ensureVideoStorageModeSetting();
  await db.execute(sql6`
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
  await db.execute(sql6`alter table sport_category_metric_ranges add column if not exists created_by_user_id varchar`);
  await db.execute(sql6`alter table sport_category_metric_ranges add column if not exists updated_by_user_id varchar`);
  await db.execute(sql6`
    create unique index if not exists sport_category_metric_ranges_config_metric_uq
    on sport_category_metric_ranges (config_key, metric_key)
  `);
  await db.execute(sql6`
    create index if not exists sport_category_metric_ranges_sport_movement_idx
    on sport_category_metric_ranges (sport_name, movement_name, is_active)
  `);
  await db.execute(sql6`alter table metrics add column if not exists model_version varchar not null default '0.1'`);
  await db.execute(sql6`alter table analysis_shot_discrepancies add column if not exists model_version varchar not null default '0.1'`);
  await db.execute(sql6`drop table if exists scoring_model_registry_dataset_metrics`);
  await db.execute(sql6`drop table if exists scoring_model_registry_entries`);
  await db.execute(sql6`
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
  await db.execute(sql6`
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
  await db.execute(sql6`
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
  await db.execute(sql6`
    create unique index if not exists model_registry_dataset_items_dataset_analysis_uq
    on model_registry_dataset_items (dataset_id, analysis_id)
  `);
  await db.execute(sql6`
    create index if not exists model_registry_dataset_items_analysis_idx
    on model_registry_dataset_items (analysis_id)
  `);
  await db.execute(sql6`
    create table if not exists tennis_training_datasets (
      id varchar primary key default gen_random_uuid(),
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
  await db.execute(sql6`
    create table if not exists tennis_training_dataset_rows (
      id varchar primary key default gen_random_uuid(),
      dataset_id varchar not null references tennis_training_datasets(id),
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
  await db.execute(sql6`
    create index if not exists tennis_training_dataset_rows_dataset_idx
    on tennis_training_dataset_rows (dataset_id, shot_index)
  `);
  await db.execute(sql6`
    create table if not exists tennis_model_training_runs (
      id varchar primary key default gen_random_uuid(),
      job_id varchar not null unique,
      sport_name text not null default 'tennis',
      status varchar not null,
      dataset_id varchar references tennis_training_datasets(id),
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
  await db.execute(sql6`
    create index if not exists tennis_model_training_runs_sport_status_idx
    on tennis_model_training_runs (sport_name, status, completed_at)
  `);
  await db.execute(sql6`alter table analyses add column if not exists captured_at timestamp`);
  await db.execute(sql6`alter table analyses add column if not exists source_filename text`);
  await db.execute(sql6`alter table analyses add column if not exists evaluation_video_id text`);
  await db.execute(sql6`alter table analyses add column if not exists source_app text`);
  await db.execute(sql6`alter table analyses add column if not exists video_duration_sec real`);
  await db.execute(sql6`alter table analyses add column if not exists video_fps real`);
  await db.execute(sql6`alter table analyses add column if not exists video_width real`);
  await db.execute(sql6`alter table analyses add column if not exists video_height real`);
  await db.execute(sql6`alter table analyses add column if not exists video_rotation real`);
  await db.execute(sql6`alter table analyses add column if not exists video_codec text`);
  await db.execute(sql6`alter table analyses add column if not exists video_content_hash text`);
  await db.execute(sql6`alter table analyses add column if not exists video_bitrate_kbps real`);
  await db.execute(sql6`alter table analyses add column if not exists file_size_bytes real`);
  await db.execute(sql6`alter table analyses add column if not exists container_format text`);
  await db.execute(sql6`alter table analyses add column if not exists gps_lat real`);
  await db.execute(sql6`alter table analyses add column if not exists gps_lng real`);
  await db.execute(sql6`alter table analyses add column if not exists gps_alt_m real`);
  await db.execute(sql6`alter table analyses add column if not exists gps_speed_mps real`);
  await db.execute(sql6`alter table analyses add column if not exists gps_heading_deg real`);
  await db.execute(sql6`alter table analyses add column if not exists gps_accuracy_m real`);
  await db.execute(sql6`alter table analyses add column if not exists gps_timestamp timestamp`);
  await db.execute(sql6`alter table analyses add column if not exists gps_source text`);
  await initializeModelRegistryCache();
  await db.execute(sql6`
    delete from app_settings
    where key = 'modelEvaluationMode'
       or key like 'modelEvaluationMode:%'
  `);
  await db.execute(sql6`alter table analyses add column if not exists requested_session_type text`);
  await db.execute(sql6`alter table analyses add column if not exists requested_focus_key text`);
  await ensureAuditMetadataBackfill();
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
      await db.execute(sql6`
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
    await db.execute(sql6`
      update analyses
      set status = 'failed',
          rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
          updated_at = now()
      where status = 'processing'
        and updated_at < now() - interval '60 minutes'
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
  app2.get("/api/model-registry/config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const overview = getModelRegistryOverview();
      res.json({
        ...overview.config,
        storage: overview.storage,
        versions: overview.versions,
        datasets: overview.datasets,
        manifestValidation: overview.validation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/model-registry/config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
        evaluationDatasetManifestPath: String(req.body?.evaluationDatasetManifestPath || "").trim() || "database://model-registry"
      }, userId);
      const overview = getModelRegistryOverview();
      res.json({
        ...next,
        storage: overview.storage,
        versions: overview.versions,
        datasets: overview.datasets,
        manifestValidation: overview.validation
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/model-registry/validate-manifest", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const config = readModelRegistryConfig();
      const validation = validateEvaluationDatasetManifest(config);
      res.json({
        config,
        validation,
        datasets: getModelRegistryOverview().datasets
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/platform/storage-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      res.json({
        mode: await getVideoStorageMode(),
        isAdmin
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/platform/pose-landmarker-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      res.json({
        model: await getPoseLandmarkerModel(userId),
        isAdmin
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/platform/pose-landmarker-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const model = String(req.body?.model || "").trim().toLowerCase();
      if (!isPoseLandmarkerModel(model)) {
        return res.status(400).json({ error: "model must be one of lite, full, or heavy" });
      }
      await setPoseLandmarkerModel(model, userId);
      res.json({ model });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/platform/validation-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      res.json({
        mode: await getVideoValidationMode2(userId),
        isAdmin
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/platform/validation-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const mode = String(req.body?.mode || "").trim().toLowerCase();
      if (!isVideoValidationMode(mode)) {
        return res.status(400).json({ error: "mode must be one of disabled, light, medium, or full" });
      }
      await setVideoValidationMode(mode, userId);
      res.json({ mode });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/platform/analysis-fps-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const settings = await getAnalysisFpsSettings2(userId);
      res.json({
        ...settings,
        isAdmin
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/platform/analysis-fps-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const lowImpactStep = String(req.body?.lowImpactStep ?? req.body?.lowImpactMode ?? "").trim().toLowerCase();
      const highImpactStep = String(req.body?.highImpactStep ?? req.body?.highImpactMode ?? "").trim().toLowerCase();
      const tennisAutoDetectUsesHighImpact = Boolean(req.body?.tennisAutoDetectUsesHighImpact);
      const tennisMatchPlayUsesHighImpact = Boolean(req.body?.tennisMatchPlayUsesHighImpact);
      if (!isAnalysisFpsStep2(lowImpactStep)) {
        return res.status(400).json({ error: "lowImpactStep must be one of step1, step2, or step3" });
      }
      if (!isAnalysisFpsStep2(highImpactStep)) {
        return res.status(400).json({ error: "highImpactStep must be one of step1, step2, or step3" });
      }
      const settings = {
        lowImpactStep,
        highImpactStep,
        tennisAutoDetectUsesHighImpact,
        tennisMatchPlayUsesHighImpact
      };
      await setAnalysisFpsSettings(settings, userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/platform/sports-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const allSports = await listSports({ includeDisabled: true });
      res.json({
        sports: allSports.map(mapSportForApi),
        isAdmin
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/platform/sports-settings/:sportId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const enabled = Boolean(req.body?.enabled);
      const sport = await getSportById(req.params.sportId);
      if (!sport) {
        return res.status(404).json({ error: "Sport not found" });
      }
      const allSports = await listSports({ includeDisabled: true });
      const enabledCount = allSports.filter((item) => isSportEnabledRecord(item)).length;
      if (!enabled && isSportEnabledRecord(sport) && enabledCount <= 1) {
        return res.status(400).json({ error: "At least one sport must remain enabled" });
      }
      const [updatedSport] = await db.update(sports).set({
        enabled,
        isActive: enabled,
        ...buildUpdateAuditFields(userId)
      }).where(eq8(sports.id, sport.id)).returning();
      res.json(mapSportForApi(updatedSport));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/platform/storage-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/scoring-model/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const dashboard = await buildScoringModelDashboard(
        userId,
        isAdmin,
        String(req.query.movementName || ""),
        String(req.query.playerId || "")
      );
      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/model-training/tennis", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      res.json(await getTennisTrainingStatus());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/model-training/tennis/dataset-insights", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      res.json(await getTennisDatasetInsights({
        playerId: req.query.playerId ? String(req.query.playerId) : null,
        startDate: req.query.startDate ? String(req.query.startDate) : null,
        endDate: req.query.endDate ? String(req.query.endDate) : null
      }));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/model-training/tennis/train", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const status = await getTennisTrainingStatus();
      if (status.currentJob && (status.currentJob.status === "queued" || status.currentJob.status === "running")) {
        return res.status(409).json({ error: "A tennis training job is already running.", status });
      }
      const queuedStatus = await queueTennisTrainingJob(userId);
      res.status(202).json(queuedStatus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/model-training/tennis/save-version", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const status = await getTennisTrainingStatus();
      if (status.currentJob && (status.currentJob.status === "queued" || status.currentJob.status === "running")) {
        return res.status(409).json({ error: "Wait for the current tennis training job to finish before saving a version." });
      }
      res.json(await saveCurrentTennisModelVersion(userId, {
        modelVersion: req.body?.modelVersion,
        description: req.body?.description
      }));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sports", async (req, res) => {
    try {
      const includeDisabled = String(req.query.includeDisabled || "").trim().toLowerCase() === "true";
      const allSports = await listSports({ includeDisabled });
      res.json(allSports.map(mapSportForApi));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sports/:sportId/movements", async (req, res) => {
    try {
      const movements = await db.select().from(sportMovements).where(eq8(sportMovements.sportId, req.params.sportId)).orderBy(asc3(sportMovements.sortOrder));
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
      res.json(rows.map(normalizeMetricRangeRow));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/metric-optimal-ranges", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
          error: "configKey, metricKey, sportName, movementName, and unit are required"
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
      await db.insert(sportCategoryMetricRanges).values({
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
        ...buildInsertAuditFields(userId)
      }).onConflictDoUpdate({
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
          ...buildUpdateAuditFields(userId)
        }
      });
      const rows = await fetchMetricRangeRows({ configKey, metricKey, includeInactive: true });
      res.json(rows[0] ? normalizeMetricRangeRow(rows[0]) : null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.put("/api/metric-optimal-ranges/bulk", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
        const optimalMinRaw = Number(raw.optimalMin);
        const optimalMaxRaw = Number(raw.optimalMax);
        const isActive = raw.isActive == null ? true : Boolean(raw.isActive);
        if (!configKey || !metricKey || !sportName || !movementName || !unit) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: configKey, metricKey, sportName, movementName, and unit are required`
          });
        }
        if (!Number.isFinite(optimalMinRaw) || !Number.isFinite(optimalMaxRaw)) {
          return res.status(400).json({
            error: `Invalid item at index ${idx}: optimalMin and optimalMax must be numbers`
          });
        }
        const optimalMin = normalizeMetricValueToTenScale(metricKey, optimalMinRaw);
        const optimalMax = normalizeMetricValueToTenScale(metricKey, optimalMaxRaw);
        const normalizedUnit = normalizeMetricUnit(metricKey, unit);
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
          unit: normalizedUnit,
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
          source: "admin",
          ...buildInsertAuditFields(userId)
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
            ...buildUpdateAuditFields(userId)
          }
        });
      }
      const uniqueConfigKeys = Array.from(new Set(items.map((item) => item.configKey)));
      const rows = await db.select().from(sportCategoryMetricRanges).where(
        and4(
          inArray2(sportCategoryMetricRanges.configKey, uniqueConfigKeys),
          eq8(sportCategoryMetricRanges.isActive, true)
        )
      ).orderBy(
        asc3(sportCategoryMetricRanges.configKey),
        asc3(sportCategoryMetricRanges.metricKey)
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
    (req, _res, next) => {
      req.uploadStartMs = Date.now();
      next();
    },
    runVideoUploadMiddleware,
    async (req, res) => {
      let finalPathToCleanup = null;
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }
        const storageMode = await getVideoStorageMode();
        const requesterUserId = req.session.userId;
        const targetUserIdRaw = String(req.body?.targetUserId || "").trim();
        let userId = requesterUserId;
        if (targetUserIdRaw) {
          const [targetUser] = await db.select({ id: users.id }).from(users).where(eq8(users.id, targetUserIdRaw));
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
        const requestedSessionType = requestedSessionTypeRaw === "practice" || requestedSessionTypeRaw === "match-play" ? requestedSessionTypeRaw : null;
        const requestedFocusKey = requestedFocusKeyRaw === "auto-detect" || requestedFocusKeyRaw === "forehand" || requestedFocusKeyRaw === "backhand" || requestedFocusKeyRaw === "serve" || requestedFocusKeyRaw === "volley" || requestedFocusKeyRaw === "game" ? requestedFocusKeyRaw : null;
        if (recordedAtRaw && !recordedAtOverride) {
          return res.status(400).json({ error: "Invalid session date/time provided" });
        }
        if (recordedAtOverride && recordedAtOverride.getTime() > Date.now() + 6e4) {
          return res.status(400).json({ error: "Session date/time cannot be in the future" });
        }
        let resolvedSportId = null;
        let resolvedMovementId = null;
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
          const [movement] = await db.select().from(sportMovements).where(eq8(sportMovements.id, movementId));
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
        const finalFilename = req.file.filename || `${randomUUID3().toUpperCase()}${path4.extname(req.file.originalname || "") || ".mp4"}`;
        const finalPath = storageMode === "r2" ? await storeVideoBuffer({
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
          filename: finalFilename
        }) : req.file.path;
        finalPathToCleanup = finalPath;
        const uploadStartedAtMs = Number(req.uploadStartMs);
        const uploadCompletedAtMs = Date.now();
        const sourceFilename = null;
        const evaluationVideoId = null;
        const extractedMetadata = await withLocalMediaFile(
          finalPath,
          finalFilename,
          async (localPath) => extractVideoMetadata(localPath)
        );
        const uploadMetadata = recordedAtOverride ? { ...extractedMetadata, capturedAt: recordedAtOverride } : extractedMetadata;
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
          requesterUserId
        );
        finalPathToCleanup = null;
        try {
          await seedUploadPipelineTiming(
            analysis.id,
            {
              startedAt: Number.isFinite(uploadStartedAtMs) ? new Date(uploadStartedAtMs).toISOString() : null,
              completedAt: new Date(uploadCompletedAtMs).toISOString(),
              elapsedMs: Number.isFinite(uploadStartedAtMs) ? Math.max(uploadCompletedAtMs - uploadStartedAtMs, 0) : null
            },
            {
              configKey: getConfigKey(resolvedSportName || "tennis", resolvedMovementName || "auto-detect"),
              modelVersion: readModelRegistryConfig().activeModelVersion,
              auditActorUserId: requesterUserId
            }
          );
        } catch (timingError) {
          console.warn("Failed to seed upload pipeline timing:", timingError);
        }
        processAnalysis(analysis.id).catch(console.error);
        res.json({
          id: analysis.id,
          status: analysis.status,
          message: "Video uploaded successfully. Processing started."
        });
      } catch (error) {
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
    }
  );
  app2.get("/api/analyses", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const sportId = req.query.sportId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const includeAll = isAdmin && String(req.query.includeAll || "").trim().toLowerCase() === "true";
      await markStaleProcessingAsFailed(isAdmin ? void 0 : userId);
      const query = db.select({
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
        modelVersion: metrics.modelVersion
      }).from(analyses).leftJoin(users, eq8(analyses.userId, users.id)).leftJoin(sports, eq8(analyses.sportId, sports.id)).leftJoin(sportMovements, eq8(analyses.movementId, sportMovements.id)).leftJoin(metrics, eq8(analyses.id, metrics.analysisId));
      const rows = isAdmin ? await query.orderBy(sql6`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`) : await query.where(eq8(analyses.userId, userId)).orderBy(sql6`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);
      const normalizedRows = rows.map((row) => {
        const normalized = normalizeScoreRow(row);
        return {
          ...normalized,
          sectionScores: computeSummarySectionScores({
            scoreOutputs: row.scoreOutputs
          })
        };
      });
      if (isAdmin && !includeAll) {
        return res.json(await Promise.all(normalizedRows.map((row) => attachVideoUrl(row))));
      }
      res.json(await Promise.all(normalizedRows.map((row) => attachVideoUrl(row))));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/coach/ask", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      }).from(analyses).leftJoin(metrics, eq8(analyses.id, metrics.analysisId)).where(eq8(analyses.userId, targetPlayerId)).orderBy(sql6`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      const [analysisUser] = analysis.userId ? await db.select({ name: users.name }).from(users).where(eq8(users.id, analysis.userId)).limit(1) : [null];
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const metricsData = await storage.getMetrics(req.params.id);
      const insights = await storage.getCoachingInsights(req.params.id);
      let selectedMovementName = null;
      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq8(sportMovements.id, analysis.movementId));
        if (movement) {
          selectedMovementName = movement.name;
        }
      }
      const normalizedMetricsData = metricsData ? {
        ...metricsData,
        metricValues: normalizeMetricValuesForApi(metricsData.metricValues)
      } : null;
      res.json({
        analysis: await attachVideoUrl({
          ...analysis,
          userName: analysisUser?.name || null
        }),
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
        const [sport] = await db.select().from(sports).where(eq8(sports.id, analysis.sportId));
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
        analysis.requestedSessionType,
        metricsData?.configKey,
        analysis.detectedMovement,
        inputMetrics,
        metricsData?.scoreOutputs && typeof metricsData.scoreOutputs === "object" ? metricsData.scoreOutputs?.tactical?.components : null,
        metricsData?.overallScore,
        metricsData?.aiDiagnostics
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const rows = isAdmin ? await db.select().from(analysisShotAnnotations).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(1e3) : await db.select().from(analysisShotAnnotations).where(eq8(analysisShotAnnotations.userId, userId)).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(300);
      res.json(rows.map(normalizeMetricRangeRow));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/shot-annotation", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const whereClause = isAdmin ? eq8(analysisShotAnnotations.analysisId, req.params.id) : and4(
        eq8(analysisShotAnnotations.analysisId, req.params.id),
        eq8(analysisShotAnnotations.userId, userId)
      );
      const [annotation] = await db.select().from(analysisShotAnnotations).where(whereClause).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(1);
      if (!annotation) {
        return res.json(null);
      }
      res.json(annotation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/analyses/:id/shot-annotation", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      if (!Number.isFinite(totalShotsNum) || totalShotsNum < 0) {
        return res.status(400).json({ error: "totalShots must be a non-negative number" });
      }
      if (orderedShotLabels.length !== Math.trunc(totalShotsNum)) {
        return res.status(400).json({
          error: "orderedShotLabels length must match totalShots"
        });
      }
      const [existing] = await db.select().from(analysisShotAnnotations).where(
        and4(
          eq8(analysisShotAnnotations.analysisId, req.params.id),
          eq8(analysisShotAnnotations.userId, userId)
        )
      ).limit(1);
      if (existing) {
        await db.update(analysisShotAnnotations).set({
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes,
          ...buildUpdateAuditFields(userId)
        }).where(eq8(analysisShotAnnotations.id, existing.id));
      } else {
        await db.insert(analysisShotAnnotations).values({
          analysisId: req.params.id,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes,
          ...buildInsertAuditFields(userId)
        });
      }
      const [saved] = await db.select().from(analysisShotAnnotations).where(
        and4(
          eq8(analysisShotAnnotations.analysisId, req.params.id),
          eq8(analysisShotAnnotations.userId, userId)
        )
      ).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(1);
      const { sportName, movementName } = await resolveSportAndMovementNames(analysis);
      const dominantProfile = await resolveUserDominantProfile(analysis.userId);
      const manualLabels = (saved?.orderedShotLabels || orderedShotLabels).map(
        (label) => normalizeShotLabel(label)
      );
      const movementForManifest = String(
        analysis.detectedMovement || movementName || "unknown"
      ).trim().toLowerCase();
      try {
        const syncResult = await syncVideoForModelTuning({
          sourceVideoPath: analysis.videoPath,
          sourceVideoFilename: analysis.videoFilename,
          movementType: movementForManifest,
          enabled: true,
          videoId: analysis.evaluationVideoId || void 0,
          analysisId: analysis.id,
          annotatorUserId: userId,
          actorUserId: userId
        });
        if (syncResult.videoId !== analysis.evaluationVideoId) {
          await db.update(analyses).set({
            evaluationVideoId: syncResult.videoId,
            ...buildUpdateAuditFields(userId)
          }).where(eq8(analyses.id, analysis.id));
        }
      } catch (manifestError) {
        return res.status(500).json({
          error: manifestError?.message || "Failed to sync model training dataset state"
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
          confusionPairs: snapshot.confusionPairs,
          ...buildInsertAuditFields(userId)
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
            ...buildUpdateAuditFields(userId)
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
        discrepancySnapshotUpdated
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/shot-report", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
        const [sport] = await db.select().from(sports).where(eq8(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }
      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq8(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }
      const dominantProfile = await resolveUserDominantProfile(analysis.userId);
      const diagnostics = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => runPythonDiagnostics2(
          localPath,
          sportName,
          movementName,
          dominantProfile
        )
      );
      const diagnosticsDetected = String(diagnostics?.detectedMovement || "").trim();
      if (diagnosticsDetected && normalizeMovementToken(diagnosticsDetected) !== normalizeMovementToken(analysis.detectedMovement)) {
        await db.update(analyses).set({ detectedMovement: diagnosticsDetected, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(analyses.id, analysis.id));
      }
      const [manualAnnotation] = await db.select().from(analysisShotAnnotations).where(
        and4(
          eq8(analysisShotAnnotations.analysisId, req.params.id),
          eq8(analysisShotAnnotations.userId, userId)
        )
      ).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(1);
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      }).from(analyses).leftJoin(sports, eq8(analyses.sportId, sports.id)).leftJoin(sportMovements, eq8(analyses.movementId, sportMovements.id)).leftJoin(metrics, eq8(metrics.analysisId, analyses.id)) : await db.select({
        analysis: analyses,
        sportName: sports.name,
        movementName: sportMovements.name,
        metricValues: metrics.metricValues
      }).from(analyses).leftJoin(sports, eq8(analyses.sportId, sports.id)).leftJoin(sportMovements, eq8(analyses.movementId, sportMovements.id)).leftJoin(metrics, eq8(metrics.analysisId, analyses.id)).where(eq8(analyses.userId, userId));
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
        userName: sql6`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
        sportName: sports.name,
        movementName: sportMovements.name
      }).from(analysisShotAnnotations).innerJoin(analyses, eq8(analysisShotAnnotations.analysisId, analyses.id)).leftJoin(sports, eq8(analyses.sportId, sports.id)).leftJoin(sportMovements, eq8(analyses.movementId, sportMovements.id)).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(200) : await db.select({
        annotation: analysisShotAnnotations,
        analysis: analyses,
        userName: sql6`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
        sportName: sports.name,
        movementName: sportMovements.name
      }).from(analysisShotAnnotations).innerJoin(analyses, eq8(analysisShotAnnotations.analysisId, analyses.id)).leftJoin(sports, eq8(analyses.sportId, sports.id)).leftJoin(sportMovements, eq8(analyses.movementId, sportMovements.id)).where(eq8(analysisShotAnnotations.userId, userId)).orderBy(desc4(analysisShotAnnotations.updatedAt)).limit(30);
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
      const existingSnapshots = isAdmin ? await db.select().from(analysisShotDiscrepancies) : await db.select().from(analysisShotDiscrepancies).where(eq8(analysisShotDiscrepancies.userId, userId));
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
            and4(
              eq8(analysisShotDiscrepancies.analysisId, analysis.id),
              eq8(analysisShotDiscrepancies.userId, annotationOwnerId)
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }
      const forceRefresh = String(req.query.refresh || "") === "1";
      const [metricRow] = await db.select({ aiDiagnostics: metrics.aiDiagnostics }).from(metrics).where(eq8(metrics.analysisId, analysis.id)).limit(1);
      const persistedDiagnostics = metricRow?.aiDiagnostics && typeof metricRow.aiDiagnostics === "object" ? metricRow.aiDiagnostics : null;
      if (persistedDiagnostics && !forceRefresh) {
        return res.json(persistedDiagnostics);
      }
      if (!analysis.videoPath) {
        return res.status(404).json({ error: "Video file not found" });
      }
      let sportName = "tennis";
      let movementName = "auto-detect";
      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq8(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }
      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq8(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }
      const dominantProfile = await resolveUserDominantProfile(analysis.userId);
      const diagnostics = await withLocalMediaFile(
        analysis.videoPath,
        analysis.videoFilename,
        (localPath) => runPythonDiagnostics2(
          localPath,
          sportName,
          movementName,
          dominantProfile
        )
      );
      const refreshedDiagnostics = (() => {
        const pipelineTiming = extractPipelineTiming(persistedDiagnostics);
        const diagnosticsRecord = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
        const validationScreening = persistedDiagnostics && typeof persistedDiagnostics === "object" ? persistedDiagnostics.validationScreening : null;
        const diagnosticsWithValidation = validationScreening == null ? diagnosticsRecord : {
          ...diagnosticsRecord,
          validationScreening
        };
        if (!pipelineTiming) return diagnosticsWithValidation;
        return attachPipelineTiming(diagnosticsWithValidation, pipelineTiming);
      })();
      await db.update(metrics).set({ aiDiagnostics: refreshedDiagnostics }).where(eq8(metrics.analysisId, analysis.id));
      invalidateSkeletonCache(analysis.id);
      const diagnosticsDetected = String(diagnostics?.detectedMovement || "").trim();
      if (diagnosticsDetected && normalizeMovementToken(diagnosticsDetected) !== normalizeMovementToken(analysis.detectedMovement)) {
        await db.update(analyses).set({ detectedMovement: diagnosticsDetected, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(analyses.id, analysis.id));
      }
      res.json(refreshedDiagnostics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/skeleton/shot/:shotId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      const startFrame = req.query.startFrame != null ? Number(req.query.startFrame) : void 0;
      const endFrame = req.query.endFrame != null ? Number(req.query.endFrame) : void 0;
      const shotSkeleton = await getShotSkeleton(analysis.id, shotId, startFrame, endFrame);
      if (!shotSkeleton) {
        return res.status(404).json({ error: "Skeleton data not found for shot" });
      }
      return res.json(shotSkeleton);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch shot skeleton" });
    }
  });
  app2.get("/api/analyses/:id/skeleton/shot/:shotId/playback", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      const startFrame = req.query.startFrame != null ? Number(req.query.startFrame) : void 0;
      const endFrame = req.query.endFrame != null ? Number(req.query.endFrame) : void 0;
      const playbackData = await getShotSkeleton(analysis.id, shotId, startFrame, endFrame);
      if (!playbackData) {
        return res.status(404).json({ error: "Skeleton playback data not found" });
      }
      return res.json(playbackData);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch skeleton playback data" });
    }
  });
  app2.get("/api/analyses/:id/skeleton/shot/:shotId/frame/:frameNumber", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch frame skeleton" });
    }
  });
  app2.get("/api/analyses/:id/ghost-correction/:shotId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      const [metricsRow] = await db.select({
        metricValues: metrics.metricValues,
        configKey: metrics.configKey
      }).from(metrics).where(eq8(metrics.analysisId, analysis.id)).limit(1);
      if (!metricsRow) {
        return res.status(404).json({ error: "Metrics not found" });
      }
      const configKey = String(metricsRow.configKey || "").trim();
      const sportConfig = configKey ? getSportConfig(configKey) : void 0;
      if (!sportConfig) {
        return res.status(404).json({ error: "Sport config not found" });
      }
      const metricValues = metricsRow.metricValues && typeof metricsRow.metricValues === "object" ? metricsRow.metricValues : {};
      const metricsWithRanges = sportConfig.metrics.filter((m) => m.optimalRange);
      let bestMetricKey = null;
      let maxDeviation = 0;
      for (const def of metricsWithRanges) {
        const value = Number(metricValues[def.key]);
        if (!Number.isFinite(value) || !def.optimalRange) continue;
        const [lo2, hi2] = def.optimalRange;
        const rangeSpan = Math.max(hi2 - lo2, 1e-6);
        let deviation = 0;
        if (value < lo2) deviation = (lo2 - value) / rangeSpan;
        else if (value > hi2) deviation = (value - hi2) / rangeSpan;
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
          configKey
        });
      }
      const bestDef = sportConfig.metrics.find((m) => m.key === bestMetricKey);
      const playerValue = Number(metricValues[bestMetricKey]);
      const [lo, hi] = bestDef.optimalRange;
      return res.json({
        frames: shotSkeleton.frames,
        correction: {
          metricKey: bestMetricKey,
          label: bestDef.label,
          unit: bestDef.unit,
          playerValue,
          optimalRange: [lo, hi],
          deviation: maxDeviation,
          direction: playerValue < lo ? "increase" : "decrease"
        },
        metricValues,
        configKey
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch ghost correction data" });
    }
  });
  app2.get("/api/analyses/:id/video-metadata", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
        (localPath) => extractVideoMetadata(localPath)
      );
      return res.json(extractedMetadata || {});
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to extract video metadata" });
    }
  });
  app2.get("/api/analyses/:id/comparison", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
        eq8(analyses.userId, analysis.userId),
        eq8(analyses.status, "completed"),
        eq8(metrics.configKey, metricsData.configKey),
        sql6`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) <= ${baseDate}`
      ];
      if (analysis.sportId) {
        conditions.push(eq8(analyses.sportId, analysis.sportId));
      }
      if (periodDays !== null) {
        const startDate = new Date(baseDate.getTime() - periodDays * 24 * 60 * 60 * 1e3);
        conditions.push(sql6`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) >= ${startDate}`);
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
      }).from(analyses).innerJoin(metrics, eq8(analyses.id, metrics.analysisId)).where(and4(...conditions)).orderBy(sql6`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) asc`);
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      await markStaleProcessingAsFailed(isAdmin ? void 0 : userId);
      const rawAnalyses = isAdmin ? await storage.getAllAnalyses(null) : await storage.getAllAnalyses(userId);
      const storageMode = await getVideoStorageMode();
      const userAnalyses = rawAnalyses;
      const videoExts = /* @__PURE__ */ new Set([".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"]);
      const collectUploadVideoFiles = (root) => {
        const collected = [];
        const walk = (dir) => {
          let entries = [];
          try {
            entries = fs7.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            const fullPath = path4.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
              continue;
            }
            if (!entry.isFile()) {
              continue;
            }
            const ext = path4.extname(entry.name).toLowerCase();
            if (!videoExts.has(ext)) {
              continue;
            }
            try {
              const stats = fs7.statSync(fullPath);
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
        userAnalyses.filter((analysis) => analysis.videoPath && isStoredMediaLocallyAccessible(analysis.videoPath)).map((analysis) => path4.resolve(analysis.videoPath))
      );
      const unassignedUploadFiles = new Map(
        uploadFiles.filter((file) => !existingPaths.has(path4.resolve(file.fullPath))).map((file) => [path4.resolve(file.fullPath), file])
      );
      const runnableAnalyses = [];
      let autoRelinkedAnalyses = 0;
      const skippedDetails = [];
      for (const analysis of userAnalyses) {
        if (analysis.videoPath && (storageMode === "r2" || isStoredMediaLocallyAccessible(analysis.videoPath))) {
          runnableAnalyses.push(analysis);
          continue;
        }
        if (storageMode === "r2") {
          skippedDetails.push({
            id: analysis.id,
            reason: "Video reference is missing from configured storage",
            filename: path4.basename(analysis.videoFilename || "")
          });
          continue;
        }
        const currentFilename = path4.basename(analysis.videoFilename || "");
        const exactNameCandidate = currentFilename ? [...unassignedUploadFiles.values()].find((f) => f.filename === currentFilename) : void 0;
        if (exactNameCandidate && fs7.existsSync(exactNameCandidate.fullPath)) {
          await db.update(analyses).set({
            videoFilename: exactNameCandidate.filename,
            videoPath: exactNameCandidate.fullPath,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq8(analyses.id, analysis.id));
          runnableAnalyses.push({
            ...analysis,
            videoFilename: exactNameCandidate.filename,
            videoPath: exactNameCandidate.fullPath
          });
          unassignedUploadFiles.delete(path4.resolve(exactNameCandidate.fullPath));
          autoRelinkedAnalyses += 1;
          continue;
        }
        const originalExt = path4.extname(currentFilename).toLowerCase();
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
        }).where(eq8(analyses.id, analysis.id));
        unassignedUploadFiles.delete(path4.resolve(bestCandidate.fullPath));
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
      }).from(analysisShotAnnotations).where(inArray2(analysisShotAnnotations.analysisId, ids)) : [];
      const analysesWithAnnotationsQueued = new Set(
        annotationRows.map((row) => row.analysisId)
      ).size;
      void (async () => {
        for (const id of ids) {
          try {
            await processAnalysis(id, { forceFreshDiagnostics: true });
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
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only relink your own analyses" });
      }
      const safeFilename = path4.basename(filename);
      const relinkedPath = path4.join(uploadDir, safeFilename);
      if (!fs7.existsSync(relinkedPath)) {
        return res.status(404).json({ error: "File not found in uploads folder" });
      }
      await db.update(analyses).set({
        videoFilename: safeFilename,
        videoPath: relinkedPath,
        ...buildUpdateAuditFields(userId)
      }).where(eq8(analyses.id, analysisId));
      const relinkAnnotationRows = await db.select({
        analysisId: analysisShotAnnotations.analysisId,
        userId: analysisShotAnnotations.userId
      }).from(analysisShotAnnotations).where(eq8(analysisShotAnnotations.analysisId, analysisId));
      void (async () => {
        try {
          await processAnalysis(analysisId, { forceFreshDiagnostics: true });
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
  app2.post("/api/analyses/:id/retry", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const analysisId = req.params.id;
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      const [currentUser] = await db.select().from(users).where(eq8(users.id, userId));
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
              `Retry discrepancy refresh for ${analysisId}: refreshed=${snapshotResult.refreshed}, skipped=${snapshotResult.skipped}`
            );
          }
        } catch (err) {
          console.error(`Retry failed for ${analysisId}:`, err);
        }
      })();
      res.json({
        message: "Retry started",
        analysisId,
        status: "processing"
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/analyses/:id/feedback", requireAuth, async (req, res) => {
    try {
      const [feedback] = await db.select().from(analysisFeedback).where(
        and4(
          eq8(analysisFeedback.analysisId, req.params.id),
          eq8(analysisFeedback.userId, req.session.userId)
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
        and4(
          eq8(analysisFeedback.analysisId, req.params.id),
          eq8(analysisFeedback.userId, req.session.userId)
        )
      ).limit(1);
      if (existing.length > 0) {
        await db.update(analysisFeedback).set({
          rating,
          comment: comment || null,
          ...buildUpdateAuditFields(req.session.userId)
        }).where(eq8(analysisFeedback.id, existing[0].id));
      } else {
        await db.insert(analysisFeedback).values({
          analysisId: req.params.id,
          userId: req.session.userId,
          rating,
          comment: comment || null,
          ...buildInsertAuditFields(req.session.userId)
        });
      }
      const [feedback] = await db.select().from(analysisFeedback).where(
        and4(
          eq8(analysisFeedback.analysisId, req.params.id),
          eq8(analysisFeedback.userId, req.session.userId)
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
      await deleteStoredMedia(analysis.videoPath);
      await storage.deleteAnalysis(req.params.id);
      res.json({ message: "Analysis deleted" });
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
    enabled: true,
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
    enabled: false,
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
    enabled: false,
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
    enabled: false,
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
    enabled: false,
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
    enabled: false,
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
      enabled: sportData.enabled,
      isActive: sportData.enabled,
      sortOrder: sportData.sortOrder,
      ...buildInsertAuditFields()
    }).returning();
    for (const movement of sportData.movements) {
      await db.insert(sportMovements).values({
        sportId: sport.id,
        name: movement.name,
        description: movement.description,
        icon: movement.icon,
        sortOrder: movement.sortOrder,
        ...buildInsertAuditFields()
      });
    }
  }
  console.log("Sports and movements seeded successfully");
}

// server/index.ts
import * as fs8 from "fs";
import * as path5 from "path";
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
    const path6 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path6.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
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
    const appJsonPath = path5.resolve(PROJECT_ROOT, "app.json");
    const appJsonContent = fs8.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path5.resolve(
    PROJECT_ROOT,
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs8.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs8.readFileSync(manifestPath, "utf-8");
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
  const templatePath = path5.resolve(
    PROJECT_ROOT,
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs8.readFileSync(templatePath, "utf-8");
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
  app2.use("/assets", express.static(path5.resolve(PROJECT_ROOT, "assets")));
  app2.use("/uploads", express.static(path5.resolve(PROJECT_ROOT, "uploads")));
  app2.use(express.static(path5.resolve(PROJECT_ROOT, "static-build")));
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
  const server = await registerRoutes(app);
  await seedSports();
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  const isReplit = Boolean(process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS);
  const listenOptions = isReplit ? { port, host, reusePort: true } : { port, host };
  server.listen(listenOptions, () => {
    log(`express server serving on port ${port}`);
  });
})();
