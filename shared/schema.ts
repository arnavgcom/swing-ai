import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const analyses = pgTable("analyses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  videoFilename: text("video_filename").notNull(),
  videoPath: text("video_path").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const metrics = pgTable("metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id")
    .notNull()
    .references(() => analyses.id),
  wristSpeed: real("wrist_speed"),
  elbowAngle: real("elbow_angle"),
  shoulderRotationVelocity: real("shoulder_rotation_velocity"),
  balanceStabilityScore: real("balance_stability_score"),
  forehandPerformanceScore: real("forehand_performance_score"),
  shotConsistencyScore: real("shot_consistency_score"),
  ballSpeed: real("ball_speed"),
  ballTrajectoryArc: real("ball_trajectory_arc"),
  spinEstimation: real("spin_estimation"),
  backswingDuration: real("backswing_duration"),
  contactTiming: real("contact_timing"),
  followThroughDuration: real("follow_through_duration"),
  rhythmConsistency: real("rhythm_consistency"),
  contactHeight: real("contact_height"),
  powerScore: real("power_score"),
  stabilityScore: real("stability_score"),
  timingScore: real("timing_score"),
  followThroughScore: real("follow_through_score"),
  normalizedRacketSpeed: real("normalized_racket_speed"),
  normalizedRotation: real("normalized_rotation"),
  contactConsistency: real("contact_consistency"),
  followThroughQuality: real("follow_through_quality"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).pick({
  videoFilename: true,
  videoPath: true,
  status: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type CoachingInsight = typeof coachingInsights.$inferSelect;
