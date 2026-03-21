import { execFile } from "child_process";
import fs from "fs";
import { PROJECT_ROOT, resolveProjectPath } from "./env";

const PYTHON_VALIDATION_TIMEOUT_MS = Number(process.env.PYTHON_VALIDATION_TIMEOUT_MS || 300000);
const PYTHON_VALIDATION_MAX_BUFFER = 10 * 1024 * 1024;

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

type PythonErrorPayload = {
  error?: string;
  traceback?: string;
};

function parsePythonErrorPayload(raw: string): PythonErrorPayload | null {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index];
    if (!candidate.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(candidate) as PythonErrorPayload;
      if (parsed && (typeof parsed.error === "string" || typeof parsed.traceback === "string")) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function summarizePythonFailure(context: string, error: any, stderr: string): Error {
  const parsedPayload = parsePythonErrorPayload(stderr);
  if (parsedPayload?.error) {
    return new Error(`${context}: ${parsedPayload.error}`);
  }

  if (error?.killed && error?.signal === "SIGTERM") {
    return new Error(
      `${context}: validation timed out after ${Math.round(PYTHON_VALIDATION_TIMEOUT_MS / 1000)}s on the current runtime`,
    );
  }

  const stderrLines = String(stderr || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) => !/^INFO: Created TensorFlow Lite XNNPACK delegate for CPU\.?$/i.test(line),
    )
    .filter(
      (line) => !/Feedback manager requires a model with a single signature inference/i.test(line),
    )
    .filter(
      (line) => !/Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI/i.test(line),
    );

  if (stderrLines.length > 0) {
    return new Error(`${context}: ${stderrLines[stderrLines.length - 1]}`);
  }

  return new Error(`${context}: ${error?.message || "command failed"}`);
}

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
        timeout: PYTHON_VALIDATION_TIMEOUT_MS,
        maxBuffer: PYTHON_VALIDATION_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error("Python sport validation stderr:", stderr);
          reject(summarizePythonFailure("Python sport validation failed", error, stderr));
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

export async function validateTennisVideoUpload(
  videoPath: string,
  _dominantProfile?: string | null,
): Promise<TennisUploadGuardResult> {
  void videoPath;
  return { accepted: true, reason: null };
}