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
  sportsInterests: text("sports_interests"),
  bio: text("bio"),
  role: text("role").default("player").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  videoPath: text("video_path").notNull(),
  status: text("status").notNull().default("pending"),
  detectedMovement: text("detected_movement"),
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
  configKey: varchar("config_key").notNull().default("tennis-forehand"),
  overallScore: real("overall_score"),
  subScores: jsonb("sub_scores").$type<Record<string, number>>(),
  metricValues: jsonb("metric_values").$type<Record<string, number>>(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type User = typeof users.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type SportMovement = typeof sportMovements.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type CoachingInsight = typeof coachingInsights.$inferSelect;
