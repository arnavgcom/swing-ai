import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  real,
  integer,
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
  role: text("role").default("admin").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id"),
  updatedByUserId: varchar("updated_by_user_id"),
});

export const sports = pgTable("sports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const analyses = pgTable("analyses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const analysisRecalculationRuns = pgTable("analysis_recalculation_runs", {
  traceId: varchar("trace_id").primaryKey(),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id),
  scope: text("scope").notNull(),
  selectedModelVersion: varchar("selected_model_version"),
  selectedModelSource: text("selected_model_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisRecalculationRunItems = pgTable("analysis_recalculation_run_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  traceId: varchar("trace_id").notNull().references(() => analysisRecalculationRuns.traceId),
  analysisId: varchar("analysis_id").notNull().references(() => analyses.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
  includeInTraining: boolean("include_in_training").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelRegistryVersions = pgTable("model_registry_versions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  modelVersion: varchar("model_version").notNull().unique(),
  description: text("description").notNull().default(""),
  status: varchar("status").notNull().default("draft"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  activatedByUserId: varchar("activated_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelRegistryDatasets = pgTable("model_registry_datasets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  source: text("source").notNull().default("manual-annotation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelRegistryDatasetItems = pgTable("model_registry_dataset_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id")
    .notNull()
    .references(() => modelRegistryDatasets.id),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  annotatorUserId: varchar("annotator_user_id").references(() => users.id),
  expectedMovement: text("expected_movement").notNull(),
  evaluationVideoId: text("evaluation_video_id"),
  sourceFilename: text("source_filename"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelTrainingDatasets = pgTable("model_training_datasets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  modelFamily: text("model_family").notNull(),
  sportName: text("sport_name").notNull().default("tennis"),
  datasetName: text("dataset_name").notNull(),
  source: text("source").notNull().default("manual-annotation"),
  analysisCount: integer("analysis_count").notNull().default(0),
  rowCount: integer("row_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelTrainingDatasetRows = pgTable("model_training_dataset_rows", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id")
    .notNull()
    .references(() => modelTrainingDatasets.id),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  userId: varchar("user_id").references(() => users.id),
  videoFilename: text("video_filename").notNull(),
  shotIndex: integer("shot_index").notNull(),
  groupKey: text("group_key").notNull(),
  label: text("label").notNull(),
  heuristicLabel: text("heuristic_label"),
  heuristicConfidence: real("heuristic_confidence"),
  heuristicReasons: jsonb("heuristic_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  featureValues: jsonb("feature_values").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelTrainingJobs = pgTable("model_training_jobs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().unique(),
  modelFamily: text("model_family").notNull(),
  sportName: text("sport_name").notNull().default("tennis"),
  status: varchar("status").notNull(),
  datasetId: text("dataset_id"),
  eligibleAnalysisCount: integer("eligible_analysis_count").notNull().default(0),
  eligibleShotCount: integer("eligible_shot_count").notNull().default(0),
  exportRows: integer("export_rows"),
  trainRows: integer("train_rows"),
  testRows: integer("test_rows"),
  macroF1: real("macro_f1"),
  modelOutputPath: text("model_output_path"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  report: jsonb("report").$type<Record<string, unknown>>(),
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
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
});

export const modelTrainingState = pgTable("model_training_state", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  modelFamily: text("model_family").notNull(),
  sportName: text("sport_name").notNull().default("tennis"),
  currentJobId: varchar("current_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
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
export type ModelRegistryVersion = typeof modelRegistryVersions.$inferSelect;
export type ModelRegistryDataset = typeof modelRegistryDatasets.$inferSelect;
export type ModelRegistryDatasetItem = typeof modelRegistryDatasetItems.$inferSelect;
export type ModelTrainingDataset = typeof modelTrainingDatasets.$inferSelect;
export type ModelTrainingDatasetRow = typeof modelTrainingDatasetRows.$inferSelect;
export type TennisTrainingDataset = ModelTrainingDataset;
export type TennisTrainingDatasetRow = ModelTrainingDatasetRow;
export type ModelTrainingJob = typeof modelTrainingJobs.$inferSelect;
export type ModelTrainingState = typeof modelTrainingState.$inferSelect;
export type TennisModelTrainingRun = ModelTrainingJob;
