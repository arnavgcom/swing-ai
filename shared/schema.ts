import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  real,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type ScoreInputDetail = {
  parameters: string[];
  values: Record<string, number | null>;
};

export type ScoreInputsPayload = {
  technical: Record<string, ScoreInputDetail>;
  movement: Record<string, ScoreInputDetail>;
  tactical: Record<string, ScoreInputDetail>;
  metadata: {
    configKey: string;
    generatedAt: string;
  };
};

export type ScoreOutputsPayload = {
  technical: {
    overall: number | null;
    components: {
      balance: number | null;
      inertia: number | null;
      oppositeForce: number | null;
      momentum: number | null;
      elastic: number | null;
      contact: number | null;
    };
  };
  tactical: {
    overall: number | null;
    components: {
      power: number | null;
      control: number | null;
      timing: number | null;
      technique: number | null;
    };
  };
  movement: {
    overall: number | null;
    components: {
      ready: number | null;
      read: number | null;
      react: number | null;
      respond: number | null;
      recover: number | null;
    };
  };
  overall: number | null;
  metadata: {
    configKey: string;
    generatedAt: string;
    scale: "0-10";
  };
};

export type AiDiagnosticsPayload = Record<string, unknown>;

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  address: text("address"),
  country: text("country"),
  dominantProfile: text("dominant_profile"),
  selectedScoreSections: jsonb("selected_score_sections").$type<string[]>().default(sql`'[]'::jsonb`),
  selectedMetricKeys: jsonb("selected_metric_keys").$type<string[]>().default(sql`'[]'::jsonb`),
  selectedScoreSectionsBySport: jsonb("selected_score_sections_by_sport")
    .$type<Record<string, string[]>>()
    .default(sql`'{}'::jsonb`),
  selectedMetricKeysBySport: jsonb("selected_metric_keys_by_sport")
    .$type<Record<string, string[]>>()
    .default(sql`'{}'::jsonb`),
  sportsInterests: text("sports_interests"),
  bio: text("bio"),
  role: text("role").default("player").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sports = pgTable("sports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: real("sort_order").default(0).notNull(),
});

export const sportMovements = pgTable("sport_movements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sportId: varchar("sport_id")
    .notNull()
    .references(() => sports.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  sortOrder: real("sort_order").default(0).notNull(),
});

export const analyses = pgTable("analyses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const metrics = pgTable("metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  configKey: varchar("config_key").notNull().default("tennis-forehand"),
  modelVersion: varchar("model_version").notNull().default("0.1"),
  overallScore: real("overall_score"),
  metricValues: jsonb("metric_values").$type<Record<string, number>>(),
  scoreInputs: jsonb("score_inputs").$type<ScoreInputsPayload>(),
  scoreOutputs: jsonb("score_outputs").$type<ScoreOutputsPayload>(),
  aiDiagnostics: jsonb("ai_diagnostics").$type<AiDiagnosticsPayload>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const coachingInsights = pgTable("coaching_insights", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  keyStrength: text("key_strength").notNull(),
  improvementArea: text("improvement_area").notNull(),
  trainingSuggestion: text("training_suggestion").notNull(),
  simpleExplanation: text("simple_explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisFeedback = pgTable("analysis_feedback", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  rating: text("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisShotAnnotations = pgTable("analysis_shot_annotations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  totalShots: real("total_shots").notNull(),
  orderedShotLabels: jsonb("ordered_shot_labels").$type<string[]>().notNull(),
  usedForScoringShotIndexes: jsonb("used_for_scoring_shot_indexes").$type<number[]>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisShotDiscrepancies = pgTable("analysis_shot_discrepancies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
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
  confusionPairs: jsonb("confusion_pairs")
    .$type<Array<{ from: string; to: string; count: number }>>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scoringModelRegistryEntries = pgTable("scoring_model_registry_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  modelVersion: varchar("model_version").notNull(),
  modelVersionDescription: text("model_version_description").notNull(),
  movementType: text("movement_type").notNull(),
  movementDetectionAccuracyPct: real("movement_detection_accuracy_pct").notNull(),
  scoringAccuracyPct: real("scoring_accuracy_pct").notNull(),
  datasetsUsed: jsonb("datasets_used").$type<string[]>().notNull(),
  manifestModelVersion: varchar("manifest_model_version").notNull().default("0.1"),
  manifestDatasets: jsonb("manifest_datasets")
    .$type<Array<{ name: string; videos: Array<{ videoId: string; filename: string; movementType: string }> }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scoringModelRegistryDatasetMetrics = pgTable("scoring_model_registry_dataset_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  registryEntryId: varchar("registry_entry_id")
    .notNull()
    .references(() => scoringModelRegistryEntries.id),
  datasetName: text("dataset_name").notNull(),
  movementType: text("movement_type").notNull(),
  movementDetectionAccuracyPct: real("movement_detection_accuracy_pct").notNull(),
  scoringAccuracyPct: real("scoring_accuracy_pct").notNull(),
});

export const sportCategoryMetricRanges = pgTable("sport_category_metric_ranges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  passwordHash: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).pick({
  videoFilename: true,
  videoPath: true,
  status: true,
  userId: true,
  sportId: true,
  movementId: true,
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "User ID or email is required"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type User = typeof users.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type SportMovement = typeof sportMovements.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type SportCategoryMetricRange = typeof sportCategoryMetricRanges.$inferSelect;
export type CoachingInsight = typeof coachingInsights.$inferSelect;
export type AnalysisShotAnnotation = typeof analysisShotAnnotations.$inferSelect;
export type AnalysisShotDiscrepancy = typeof analysisShotDiscrepancies.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type ScoringModelRegistryEntry = typeof scoringModelRegistryEntries.$inferSelect;
export type ScoringModelRegistryDatasetMetric = typeof scoringModelRegistryDatasetMetrics.$inferSelect;
