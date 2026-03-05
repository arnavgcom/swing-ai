import { db } from "./db";
import { analyses, metrics, coachingInsights, sportMovements, sports, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { execFile } from "child_process";
import { getConfigKey } from "@shared/sport-configs";
import fs from "fs";
import path from "path";

interface PythonResult {
  configKey: string;
  overallScore: number;
  subScores: Record<string, number>;
  metricValues: Record<string, number>;
  shotCount?: number;
  coaching: {
    keyStrength: string;
    improvementArea: string;
    trainingSuggestion: string;
    simpleExplanation: string;
  };
  detectedMovement?: string;
  movementOverridden?: boolean;
  userSelectedMovement?: string;
  rejected?: boolean;
  rejectionReason?: string;
  error?: string;
}

function resolvePythonExecutable(): string {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs.existsSync(envExecutable)) {
    return envExecutable;
  }

  const localCandidates = [
    path.resolve(process.cwd(), ".venv", "bin", "python3"),
    path.resolve(process.cwd(), ".venv", "bin", "python"),
  ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

function runPythonAnalysis(
  videoPath: string,
  sportName: string,
  movementName: string,
  dominantProfile?: string | null,
): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();

    const args = [
      "-m",
      "python_analysis.run_analysis",
      videoPath,
      "--sport",
      sportName.toLowerCase(),
      "--movement",
      movementName.toLowerCase().replace(/\s+/g, "-"),
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
          if (result.rejected) {
            resolve(result as PythonResult);
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
      .set({ status: "processing", rejectionReason: null, updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));

    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, analysisId));

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    let sportName = "tennis";
    let movementName = "auto-detect";

    if (analysis.movementId) {
      const [movement] = await db
        .select()
        .from(sportMovements)
        .where(eq(sportMovements.id, analysis.movementId));
      if (movement) {
        movementName = movement.name;
      }
    }

    if (analysis.sportId) {
      const [sport] = await db
        .select()
        .from(sports)
        .where(eq(sports.id, analysis.sportId));
      if (sport) {
        sportName = sport.name;
      }
    }

    let dominantProfile: string | null = null;
    if (analysis.userId) {
      const [profile] = await db
        .select({ dominantProfile: users.dominantProfile })
        .from(users)
        .where(eq(users.id, analysis.userId))
        .limit(1);
      dominantProfile = profile?.dominantProfile ?? null;
    }

    const configKey = getConfigKey(sportName, movementName);

    console.log(
      `Starting Python analysis for: ${analysis.videoPath} (${sportName}/${movementName}, config: ${configKey})`,
    );
    const result = await runPythonAnalysis(
      analysis.videoPath,
      sportName,
      movementName,
      dominantProfile,
    );

    if (result.rejected) {
      console.log(
        `Analysis ${analysisId} rejected: ${result.rejectionReason}`,
      );
      await db
        .update(analyses)
        .set({
          status: "rejected",
          rejectionReason: result.rejectionReason || "Video content does not match the selected sport.",
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));
      return;
    }

    const actualMovement = result.detectedMovement || movementName;
    const wasOverridden = result.movementOverridden || false;

    if (wasOverridden) {
      console.log(
        `Movement override: user selected "${movementName}" but detected "${actualMovement}". Score: ${result.overallScore}`,
      );
    } else {
      console.log(
        `Python analysis complete. Overall score: ${result.overallScore}`,
      );
    }

    if (result.overallScore != null && result.overallScore < 15) {
      const sportLabel = sportName.charAt(0).toUpperCase() + sportName.slice(1);
      console.log(
        `Analysis ${analysisId} auto-rejected: score ${result.overallScore} below minimum threshold`,
      );
      await db
        .update(analyses)
        .set({
          status: "rejected",
          rejectionReason: `The video content could not be reliably analyzed as a ${sportLabel} movement. Please upload a clearer video of your ${sportLabel} technique.`,
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));
      return;
    }

    const metricValues = { ...result.metricValues };
    if (result.shotCount != null) {
      metricValues.shotCount = result.shotCount;
    }

    await db.transaction(async (tx) => {
      await tx.delete(coachingInsights).where(eq(coachingInsights.analysisId, analysisId));
      await tx.delete(metrics).where(eq(metrics.analysisId, analysisId));

      await tx.insert(metrics).values({
        analysisId,
        configKey: result.configKey || configKey,
        overallScore: result.overallScore,
        subScores: result.subScores,
        metricValues,
      });

      await tx.insert(coachingInsights).values({
        analysisId,
        ...result.coaching,
      });
    });

    await db
      .update(analyses)
      .set({
        status: "completed",
        detectedMovement: actualMovement,
        rejectionReason: null,
        updatedAt: new Date(),
      })
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
