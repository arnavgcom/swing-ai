import { db } from "./db";
import {
  analyses,
  metrics,
  coachingInsights,
  analysisShotAnnotations,
  users,
  type Analysis,
  type Metric,
  type CoachingInsight,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { persistedScoreToApiHundred } from "./score-scale";
import { normalizeTacticalScoresToApi100 } from "./tactical-scores";

export type MetricWithCompatSubScores = Metric & {
  subScores: Record<string, number | null>;
};

export interface AnalysisMetadataInput {
  capturedAt?: Date | null;
  sourceApp?: string | null;
  videoDurationSec?: number | null;
  videoFps?: number | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  videoRotation?: number | null;
  videoCodec?: string | null;
  videoBitrateKbps?: number | null;
  fileSizeBytes?: number | null;
  containerFormat?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAltM?: number | null;
  gpsSpeedMps?: number | null;
  gpsHeadingDeg?: number | null;
  gpsAccuracyM?: number | null;
  gpsTimestamp?: Date | null;
  gpsSource?: string | null;
}

export interface IStorage {
  createAnalysis(
    videoFilename: string,
    videoPath: string,
    userId?: string | null,
    sportId?: string | null,
    movementId?: string | null,
    metadata?: AnalysisMetadataInput,
    sourceFilename?: string | null,
    evaluationVideoId?: string | null,
  ): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  getAllAnalyses(userId: string | null, sportId?: string): Promise<Analysis[]>;
  getMetrics(analysisId: string): Promise<MetricWithCompatSubScores | undefined>;
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
    metadata?: AnalysisMetadataInput,
    sourceFilename?: string | null,
    evaluationVideoId?: string | null,
  ): Promise<Analysis> {
    const [analysis] = await db
      .insert(analyses)
      .values({
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
        gpsSource: metadata?.gpsSource ?? null,
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
    userId: string | null,
    sportId?: string,
  ): Promise<(Analysis & { userName?: string })[]> {
    const conditions: any[] = [];
    if (userId) {
      conditions.push(eq(analyses.userId, userId));
    }
    if (sportId) {
      conditions.push(eq(analyses.sportId, sportId));
    }

    const rows = await db
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
        gpsLat: analyses.gpsLat,
        gpsLng: analyses.gpsLng,
        createdAt: analyses.createdAt,
        updatedAt: analyses.updatedAt,
        userName: users.name,
      })
      .from(analyses)
      .leftJoin(users, eq(analyses.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);

    return rows;
  }

  async getMetrics(analysisId: string): Promise<MetricWithCompatSubScores | undefined> {
    const [metric] = await db
      .select()
      .from(metrics)
      .where(eq(metrics.analysisId, analysisId));
    if (!metric) return undefined;

    return {
      ...metric,
      overallScore: persistedScoreToApiHundred(metric.overallScore),
      subScores: normalizeTacticalScoresToApi100(metric.scoreOutputs as Record<string, unknown> | null),
    };
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
    configKey?: string | null,
  ): Promise<{ averages: { metricValues: Record<string, number>; subScores: Record<string, number> } | null; count: number }> {
    const conditions = [
      sql`a.user_id = ${userId}`,
      sql`a.status = 'completed'`,
      sql`coalesce(a.captured_at, a.created_at) < ${beforeDate}`,
    ];

    if (periodDays !== null) {
      const startDate = new Date(beforeDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
      conditions.push(sql`coalesce(a.captured_at, a.created_at) >= ${startDate}`);
    }

    if (sportId) {
      conditions.push(sql`a.sport_id = ${sportId}`);
    }

    if (configKey) {
      conditions.push(sql`m.config_key = ${configKey}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const countResult = await db.execute(
      sql`SELECT COUNT(DISTINCT a.id) as cnt
          FROM analyses a
          JOIN metrics m ON m.analysis_id = a.id
          WHERE ${whereClause}`
    );

    const countRow = (countResult as any).rows?.[0] || (countResult as any)[0];
    const count = Number(countRow?.cnt || 0);
    if (count === 0) {
      return { averages: null, count: 0 };
    }

    const metricAvgResult = await db.execute(
      sql`SELECT kv.key, AVG(kv.value::numeric) as avg_val
          FROM analyses a
          JOIN metrics m ON m.analysis_id = a.id,
          LATERAL jsonb_each_text(m.metric_values) AS kv(key, value)
          WHERE ${whereClause}
          GROUP BY kv.key`
    );

    const subScoreAvgResult = await db.execute(
      sql`SELECT kv.key,
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

    const metricAvgs: Record<string, number> = {};
    const subScoreAvgs: Record<string, number> = {};

    const metricRows = (metricAvgResult as any).rows || metricAvgResult;
    if (Array.isArray(metricRows)) {
      for (const row of metricRows) {
        if (row.key && row.avg_val != null) {
          metricAvgs[row.key] = parseFloat(Number(row.avg_val).toFixed(2));
        }
      }
    }

    const subScoreRows = (subScoreAvgResult as any).rows || subScoreAvgResult;
    if (Array.isArray(subScoreRows)) {
      for (const row of subScoreRows) {
        if (row.key && row.avg_val != null) {
          subScoreAvgs[row.key] = parseFloat(Number(row.avg_val).toFixed(2));
        }
      }
    }

    return {
      averages: { metricValues: metricAvgs, subScores: subScoreAvgs },
      count,
    };
  }

  async deleteAnalysis(id: string): Promise<void> {
    await db
      .delete(coachingInsights)
      .where(eq(coachingInsights.analysisId, id));
    await db
      .delete(analysisShotAnnotations)
      .where(eq(analysisShotAnnotations.analysisId, id));
    await db.delete(metrics).where(eq(metrics.analysisId, id));
    await db.delete(analyses).where(eq(analyses.id, id));
  }
}

export const storage = new DatabaseStorage();
