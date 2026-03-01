import { db } from "./db";
import { analyses, metrics, coachingInsights, sportMovements, sports } from "@shared/schema";
import { eq } from "drizzle-orm";
import { execFile } from "child_process";
import { getConfigKey } from "@shared/sport-configs";

interface PythonResult {
  configKey: string;
  overallScore: number;
  subScores: Record<string, number>;
  metricValues: Record<string, number>;
  coaching: {
    keyStrength: string;
    improvementArea: string;
    trainingSuggestion: string;
    simpleExplanation: string;
  };
  detectedMovement?: string;
  movementOverridden?: boolean;
  userSelectedMovement?: string;
  error?: string;
}

function runPythonAnalysis(
  videoPath: string,
  sportName: string,
  movementName: string,
): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "python3",
      [
        "-m",
        "python_analysis.run_analysis",
        videoPath,
        "--sport",
        sportName.toLowerCase(),
        "--movement",
        movementName.toLowerCase().replace(/\s+/g, "-"),
      ],
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

    let sportName = "tennis";
    let movementName = "forehand";

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

    const configKey = getConfigKey(sportName, movementName);

    console.log(
      `Starting Python analysis for: ${analysis.videoPath} (${sportName}/${movementName}, config: ${configKey})`,
    );
    const result = await runPythonAnalysis(
      analysis.videoPath,
      sportName,
      movementName,
    );
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

    await db.insert(metrics).values({
      analysisId,
      configKey: result.configKey || configKey,
      overallScore: result.overallScore,
      subScores: result.subScores,
      metricValues: result.metricValues,
    });

    await db.insert(coachingInsights).values({
      analysisId,
      ...result.coaching,
    });

    await db
      .update(analyses)
      .set({
        status: "completed",
        detectedMovement: actualMovement,
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
