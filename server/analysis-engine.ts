import { db } from "./db";
import { analyses, metrics, coachingInsights } from "@shared/schema";
import { eq } from "drizzle-orm";
import { execFile } from "child_process";
import path from "path";

interface PythonMetrics {
  wristSpeed: number;
  elbowAngle: number;
  shoulderRotationVelocity: number;
  balanceStabilityScore: number;
  forehandPerformanceScore: number;
  shotConsistencyScore: number;
  ballSpeed: number;
  ballTrajectoryArc: number;
  spinEstimation: number;
  backswingDuration: number;
  contactTiming: number;
  followThroughDuration: number;
  rhythmConsistency: number;
  contactHeight: number;
  powerScore: number;
  stabilityScore: number;
  timingScore: number;
  followThroughScore: number;
  normalizedRacketSpeed: number;
  normalizedRotation: number;
  contactConsistency: number;
  followThroughQuality: number;
}

interface PythonCoaching {
  keyStrength: string;
  improvementArea: string;
  trainingSuggestion: string;
  simpleExplanation: string;
}

interface PythonResult {
  metrics: PythonMetrics;
  coaching: PythonCoaching;
  error?: string;
}

function runPythonAnalysis(videoPath: string): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(
      process.cwd(),
      "python_analysis",
      "run_analysis.py",
    );

    execFile(
      "python3",
      ["-m", "python_analysis.run_analysis", videoPath],
      {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
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
          resolve(result as PythonResult);
        } catch (parseError) {
          console.error("Failed to parse Python output:", stdout);
          if (stderr) console.error("Python stderr:", stderr);
          reject(new Error("Failed to parse analysis results"));
        }
      },
    );
  });
}

export async function processAnalysis(analysisId: string): Promise<void> {
  try {
    await db
      .update(analyses)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));

    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, analysisId));

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    console.log(`Starting Python OpenCV analysis for: ${analysis.videoPath}`);
    const result = await runPythonAnalysis(analysis.videoPath);
    console.log(
      `Python analysis complete. Performance score: ${result.metrics.forehandPerformanceScore}`,
    );

    await db.insert(metrics).values({
      analysisId,
      ...result.metrics,
    });

    await db.insert(coachingInsights).values({
      analysisId,
      ...result.coaching,
    });

    await db
      .update(analyses)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));

    console.log(`Analysis ${analysisId} completed successfully`);
  } catch (error) {
    console.error("Analysis processing error:", error);
    await db
      .update(analyses)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));
  }
}
