import { execFile } from "child_process";
import fs from "fs";
import { normalizeRuntimeScoreToHundred } from "./score-scale";
import { PROJECT_ROOT, resolveProjectPath } from "./env";

export type TennisUploadGuardResult = {
  accepted: boolean;
  reason: string | null;
};

type SportValidationResult = {
  sport: string;
  valid: boolean;
  reason: string;
  confidence: number;
  bodyPresence?: {
    median_area_ratio?: number;
    p75_area_ratio?: number;
    max_area_ratio?: number;
    prominent_frame_ratio?: number;
  };
  background?: {
    green_ratio?: number;
    brown_ratio?: number;
    blue_ratio?: number;
    white_ratio?: number;
    brightness_mean?: number;
    brightness_variance?: number;
    court_lines_detected?: boolean;
    sufficient?: boolean;
  };
};

function resolvePythonExecutable(): string {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs.existsSync(envExecutable)) {
    return envExecutable;
  }

  const localCandidates = [
    resolveProjectPath(".venv", "bin", "python3"),
    resolveProjectPath(".venv", "bin", "python"),
  ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

function runPythonSportValidation(
  videoPath: string,
  sportName: string,
): Promise<SportValidationResult> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();

    execFile(
      pythonExecutable,
      [
        "-m",
        "python_analysis.run_sport_validation",
        videoPath,
        "--sport",
        sportName.toLowerCase(),
      ],
      {
        cwd: PROJECT_ROOT,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error("Python sport validation stderr:", stderr);
          reject(new Error(`Python sport validation failed: ${error.message}`));
          return;
        }

        try {
          const result = JSON.parse(String(stdout || "").trim()) as SportValidationResult & { error?: string };
          if (result?.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result);
        } catch {
          if (stderr) console.error("Python sport validation stderr:", stderr);
          reject(new Error("Failed to parse sport validation results"));
        }
      },
    );
  });
}

function runPythonTennisValidationAnalysis(
  videoPath: string,
  dominantProfile?: string | null,
): Promise<TennisUploadGuardResult> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    const args = [
      "-m",
      "python_analysis.run_analysis",
      videoPath,
      "--sport",
      "tennis",
      "--movement",
      "auto-detect",
    ];

    const dominant = String(dominantProfile || "").trim().toLowerCase();
    if (dominant === "right" || dominant === "left") {
      args.push("--dominant-profile", dominant);
    }

    execFile(
      pythonExecutable,
      args,
      {
        cwd: PROJECT_ROOT,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error("Python upload validation stderr:", stderr);
          reject(new Error(`Python upload validation failed: ${error.message}`));
          return;
        }

        try {
          const result = JSON.parse(String(stdout || "").trim()) as {
            error?: string;
            rejected?: boolean;
            rejectionReason?: string;
            detectedMovement?: string;
            shotCount?: number;
            overallScore?: number;
          };
          if (result?.error) {
            reject(new Error(String(result.error)));
            return;
          }

          if (result?.rejected) {
            resolve({
              accepted: false,
              reason:
                String(result.rejectionReason || "").trim()
                || "Only tennis videos are allowed. Upload a clear tennis rally or stroke clip.",
            });
            return;
          }

          const detectedMovement = String(result?.detectedMovement || "").trim().toLowerCase();
          const shotCount = Number(result?.shotCount || 0);
          const overallScore100 = normalizeRuntimeScoreToHundred(result?.overallScore);
          const allowedMovements = new Set(["forehand", "backhand", "serve", "volley", "game"]);

          if (!allowedMovements.has(detectedMovement)) {
            resolve({
              accepted: false,
              reason: "Only tennis videos are allowed. Upload a clear tennis forehand, backhand, serve, volley, or point-play clip.",
            });
            return;
          }

          if (!Number.isFinite(shotCount) || shotCount < 1) {
            resolve({
              accepted: false,
              reason: "No tennis stroke was detected in this clip. Upload a video that clearly shows a tennis stroke or rally.",
            });
            return;
          }

          if (overallScore100 == null || overallScore100 < 20) {
            resolve({
              accepted: false,
              reason: "This video does not look like a valid tennis analysis clip. Upload a clearer on-court tennis stroke or rally video.",
            });
            return;
          }

          resolve({ accepted: true, reason: null });
        } catch {
          if (stderr) console.error("Python upload validation stderr:", stderr);
          reject(new Error("Failed to parse upload validation results"));
        }
      },
    );
  });
}

export async function validateTennisVideoUpload(
  videoPath: string,
  dominantProfile?: string | null,
): Promise<TennisUploadGuardResult> {
  const tennisValidation = await runPythonSportValidation(videoPath, "tennis");
  if (!tennisValidation.valid) {
    return {
      accepted: false,
      reason:
        String(tennisValidation.reason || "").trim()
        || "Only tennis videos are allowed. Upload a clear tennis rally or stroke clip.",
    };
  }

  const tennisConfidence = Number(tennisValidation.confidence || 0);
  const tennisBodyPresence = tennisValidation.bodyPresence || {};
  const tennisBackground = tennisValidation.background || {};
  const prominentFrameRatio = Number(tennisBodyPresence.prominent_frame_ratio || 0);
  const courtLinesDetected = Boolean(tennisBackground.court_lines_detected);
  const whiteRatio = Number(tennisBackground.white_ratio || 0);
  const greenRatio = Number(tennisBackground.green_ratio || 0);
  const brownRatio = Number(tennisBackground.brown_ratio || 0);
  const blueRatio = Number(tennisBackground.blue_ratio || 0);
  const hasLineSupportedPalette = greenRatio >= 0.05 || blueRatio >= 0.05 || brownRatio >= 0.12;
  const hasStrongLineEvidence = courtLinesDetected && whiteRatio >= 0.008 && hasLineSupportedPalette;
  const hasHardCourtColors = (greenRatio >= 0.18 || blueRatio >= 0.18) && whiteRatio >= 0.008;
  const hasClayCourtColors = brownRatio >= 0.18 && hasStrongLineEvidence;
  const strongTennisCourtEvidence = hasStrongLineEvidence || hasHardCourtColors || hasClayCourtColors;
  const strongTennisEvidence = strongTennisCourtEvidence && prominentFrameRatio >= 0.2;

  if (tennisConfidence < 0.78) {
    return {
      accepted: false,
      reason: "This video is not confidently recognized as tennis. Upload a clearer on-court tennis video with the player fully visible.",
    };
  }

  if (strongTennisEvidence) {
    return runPythonTennisValidationAnalysis(videoPath, dominantProfile);
  }

  const competingSports = ["pickleball", "paddle", "tabletennis", "badminton", "golf"];
  for (const competingSport of competingSports) {
    const competitor = await runPythonSportValidation(videoPath, competingSport);
    if (!competitor.valid) continue;
    const competitorConfidence = Number(competitor.confidence || 0);
    if (competitorConfidence >= 0.9 && competitorConfidence >= tennisConfidence + 0.15) {
      return {
        accepted: false,
        reason: `This video may be ${competingSport} instead of tennis. Only tennis videos are allowed.`,
      };
    }
  }

  return runPythonTennisValidationAnalysis(videoPath, dominantProfile);
}