import { db } from "./db";
import {
  analyses,
  metrics,
  coachingInsights,
  type Analysis,
  type Metric,
  type CoachingInsight,
} from "@shared/schema";
import { eq, desc, and, lt, gte, sql } from "drizzle-orm";

export interface IStorage {
  createAnalysis(
    videoFilename: string,
    videoPath: string,
    userId?: string | null,
    sportId?: string | null,
    movementId?: string | null,
  ): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  getAllAnalyses(userId: string, sportId?: string): Promise<Analysis[]>;
  getMetrics(analysisId: string): Promise<Metric | undefined>;
  getCoachingInsights(analysisId: string): Promise<CoachingInsight | undefined>;
  deleteAnalysis(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createAnalysis(
    videoFilename: string,
    videoPath: string,
    userId?: string | null,
    sportId?: string | null,
    movementId?: string | null,
  ): Promise<Analysis> {
    const [analysis] = await db
      .insert(analyses)
      .values({
        videoFilename,
        videoPath,
        status: "pending",
        userId: userId || null,
        sportId: sportId || null,
        movementId: movementId || null,
      })
      .returning();
    return analysis;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, id));
    return analysis;
  }

  async getAllAnalyses(
    userId: string,
    sportId?: string,
  ): Promise<Analysis[]> {
    const conditions = [eq(analyses.userId, userId)];
    if (sportId) {
      conditions.push(eq(analyses.sportId, sportId));
    }

    return db
      .select()
      .from(analyses)
      .where(and(...conditions))
      .orderBy(desc(analyses.createdAt));
  }

  async getMetrics(analysisId: string): Promise<Metric | undefined> {
    const [metric] = await db
      .select()
      .from(metrics)
      .where(eq(metrics.analysisId, analysisId));
    return metric;
  }

  async getCoachingInsights(
    analysisId: string,
  ): Promise<CoachingInsight | undefined> {
    const [insight] = await db
      .select()
      .from(coachingInsights)
      .where(eq(coachingInsights.analysisId, analysisId));
    return insight;
  }

  async getHistoricalMetricAverages(
    userId: string,
    beforeDate: Date,
    periodDays: number | null,
    sportId?: string | null,
  ): Promise<{ averages: Record<string, number> | null; count: number }> {
    const metricFields = [
      "wrist_speed", "elbow_angle", "shoulder_rotation_velocity",
      "balance_stability_score", "forehand_performance_score",
      "shot_consistency_score", "ball_speed", "ball_trajectory_arc",
      "spin_estimation", "backswing_duration", "contact_timing",
      "follow_through_duration", "rhythm_consistency", "contact_height",
      "power_score", "stability_score", "timing_score", "follow_through_score",
    ];

    const camelFields = [
      "wristSpeed", "elbowAngle", "shoulderRotationVelocity",
      "balanceStabilityScore", "forehandPerformanceScore",
      "shotConsistencyScore", "ballSpeed", "ballTrajectoryArc",
      "spinEstimation", "backswingDuration", "contactTiming",
      "followThroughDuration", "rhythmConsistency", "contactHeight",
      "powerScore", "stabilityScore", "timingScore", "followThroughScore",
    ];

    const avgSelects = sql.raw(
      metricFields.map((f) => `AVG(m.${f}) as avg_${f}`).join(", ")
    );

    const conditions = [
      sql`a.user_id = ${userId}`,
      sql`a.status = 'completed'`,
      sql`a.created_at < ${beforeDate}`,
    ];

    if (periodDays !== null) {
      const startDate = new Date(beforeDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
      conditions.push(sql`a.created_at >= ${startDate}`);
    }

    if (sportId) {
      conditions.push(sql`a.sport_id = ${sportId}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const result = await db.execute(
      sql`SELECT COUNT(DISTINCT a.id) as cnt, ${avgSelects}
        FROM analyses a
        JOIN metrics m ON m.analysis_id = a.id
        WHERE ${whereClause}`
    );

    const row = (result as any).rows?.[0] || (result as any)[0];
    if (!row || Number(row.cnt) === 0) {
      return { averages: null, count: 0 };
    }

    const averages: Record<string, number> = {};
    metricFields.forEach((f, i) => {
      const val = row[`avg_${f}`];
      if (val !== null && val !== undefined) {
        averages[camelFields[i]] = parseFloat(Number(val).toFixed(2));
      }
    });

    return { averages, count: Number(row.cnt) };
  }

  async deleteAnalysis(id: string): Promise<void> {
    await db
      .delete(coachingInsights)
      .where(eq(coachingInsights.analysisId, id));
    await db.delete(metrics).where(eq(metrics.analysisId, id));
    await db.delete(analyses).where(eq(analyses.id, id));
  }
}

export const storage = new DatabaseStorage();
