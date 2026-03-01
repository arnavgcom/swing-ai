import { db } from "./db";
import {
  analyses,
  metrics,
  coachingInsights,
  type Analysis,
  type Metric,
  type CoachingInsight,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

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

  async deleteAnalysis(id: string): Promise<void> {
    await db
      .delete(coachingInsights)
      .where(eq(coachingInsights.analysisId, id));
    await db.delete(metrics).where(eq(metrics.analysisId, id));
    await db.delete(analyses).where(eq(analyses.id, id));
  }
}

export const storage = new DatabaseStorage();
