import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";

export interface ModelRegistryConfig {
  activeModelVersion: string;
  modelVersionChangeDescription: string;
  evaluationDatasetManifestPath: string;
}

export interface EvaluationDatasetVideo {
  videoId: string;
  filename: string;
  movementType: string;
}

export interface EvaluationDataset {
  name: string;
  videos: EvaluationDatasetVideo[];
}

export interface EvaluationDatasetManifest {
  activeModelVersion?: string;
  versionHistory?: Array<{
    modelVersion: string;
    savedAt: string;
    datasets: EvaluationDataset[];
  }>;
  datasets: EvaluationDataset[];
}

export interface ManifestValidationResult {
  valid: boolean;
  datasetCount: number;
  totalVideos: number;
  duplicateFilenames: string[];
  duplicateVideoIds: string[];
  errors: string[];
  warnings: string[];
}

const configPath = path.resolve(process.cwd(), "config", "model-registry.config.json");
const evaluationDatasetFolder = path.resolve(process.cwd(), "model_evaluation_datasets", "dataset");
const evaluationDatasetFolderPrefix = "model_evaluation_datasets/dataset";
const manualTuningDatasetName = "manual-annotations";

const defaultConfig: ModelRegistryConfig = {
  activeModelVersion: "0.1",
  modelVersionChangeDescription: "Initial baseline scoring model release.",
  evaluationDatasetManifestPath: "model_evaluation_datasets/manifest.json",
};

function getConfigPath(): string {
  return configPath;
}

function ensureConfigDirExists() {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeToken(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function toLegacyVideoId(filename: string): string {
  const normalized = String(filename || "").trim().toLowerCase();
  const digest = createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  return `legacy-${digest}`;
}

function resolveVideoId(video: Partial<EvaluationDatasetVideo>): string {
  const parsed = String((video as { videoId?: unknown })?.videoId || "").trim();
  if (parsed) return parsed;
  return toLegacyVideoId(String(video.filename || ""));
}

export function readModelRegistryConfig(): ModelRegistryConfig {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ModelRegistryConfig>;
    return {
      activeModelVersion: String(parsed.activeModelVersion || defaultConfig.activeModelVersion),
      modelVersionChangeDescription: String(
        parsed.modelVersionChangeDescription || defaultConfig.modelVersionChangeDescription,
      ),
      evaluationDatasetManifestPath: String(
        parsed.evaluationDatasetManifestPath || defaultConfig.evaluationDatasetManifestPath,
      ),
    };
  } catch {
    return defaultConfig;
  }
}

export function writeModelRegistryConfig(nextConfig: ModelRegistryConfig): ModelRegistryConfig {
  const sanitized: ModelRegistryConfig = {
    activeModelVersion: String(nextConfig.activeModelVersion || "").trim() || defaultConfig.activeModelVersion,
    modelVersionChangeDescription: String(nextConfig.modelVersionChangeDescription || "").trim(),
    evaluationDatasetManifestPath: String(nextConfig.evaluationDatasetManifestPath || "").trim() || defaultConfig.evaluationDatasetManifestPath,
  };

  ensureConfigDirExists();
  fs.writeFileSync(getConfigPath(), `${JSON.stringify(sanitized, null, 2)}\n`, "utf-8");
  return sanitized;
}

export function readEvaluationDatasetManifest(config?: ModelRegistryConfig): EvaluationDatasetManifest {
  const cfg = config || readModelRegistryConfig();
  const manifestPath = path.resolve(process.cwd(), cfg.evaluationDatasetManifestPath);
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<EvaluationDatasetManifest>;
    const datasets = Array.isArray(parsed.datasets)
      ? parsed.datasets
          .map((dataset) => ({
            name: String(dataset?.name || "unnamed-dataset"),
            videos: Array.isArray(dataset?.videos)
              ? dataset.videos
                  .map((video) => ({
                    videoId: resolveVideoId(video || {}),
                    filename: String(video?.filename || "").trim(),
                    movementType: String(video?.movementType || "").trim(),
                  }))
                  .filter((video) => video.filename)
              : [],
          }))
      : [];

    const versionHistory = Array.isArray(parsed.versionHistory)
      ? parsed.versionHistory
          .map((item) => ({
            modelVersion: String(item?.modelVersion || "").trim(),
            savedAt: String(item?.savedAt || "").trim(),
            datasets: Array.isArray(item?.datasets)
              ? item.datasets.map((dataset) => ({
                  name: String(dataset?.name || "unnamed-dataset"),
                  videos: Array.isArray(dataset?.videos)
                    ? dataset.videos
                        .map((video) => ({
                          videoId: resolveVideoId(video || {}),
                          filename: String(video?.filename || "").trim(),
                          movementType: String(video?.movementType || "").trim(),
                        }))
                        .filter((video) => video.filename)
                    : [],
                }))
              : [],
          }))
          .filter((item) => item.modelVersion)
      : [];

    return {
      activeModelVersion: String(parsed.activeModelVersion || "").trim() || undefined,
      versionHistory,
      datasets,
    };
  } catch {
    return { datasets: [] };
  }
}

export function getEvaluationDatasetVideoMap(config?: ModelRegistryConfig): Map<string, { videoId: string; datasetName: string; movementType: string }> {
  const manifest = readEvaluationDatasetManifest(config);
  const map = new Map<string, { videoId: string; datasetName: string; movementType: string }>();

  for (const dataset of manifest.datasets) {
    for (const video of dataset.videos) {
      const entry = {
        videoId: video.videoId,
        datasetName: dataset.name,
        movementType: video.movementType,
      };

      if (video.videoId) {
        map.set(video.videoId, entry);
      }

      const fullName = String(video.filename || "").trim();
      if (!fullName) continue;
      map.set(fullName, entry);

      // Support manifest entries that store relative folder paths while app rows store base filenames.
      const basename = path.basename(fullName);
      if (basename && basename !== fullName) {
        map.set(basename, entry);
      }
    }
  }

  return map;
}

function ensureEvaluationDatasetDir(): void {
  if (!fs.existsSync(evaluationDatasetFolder)) {
    fs.mkdirSync(evaluationDatasetFolder, { recursive: true });
  }
}

function getManifestPath(config: ModelRegistryConfig): string {
  return path.resolve(process.cwd(), config.evaluationDatasetManifestPath);
}

function writeEvaluationDatasetManifest(config: ModelRegistryConfig, manifest: EvaluationDatasetManifest): void {
  const manifestPath = getManifestPath(config);
  const manifestDir = path.dirname(manifestPath);
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

function buildEvaluationDatasetEntryPath(filename: string): string {
  return `${evaluationDatasetFolderPrefix}/${filename}`;
}

function removeVideoFromAllDatasets(
  manifest: EvaluationDatasetManifest,
  filename: string,
  videoId?: string,
): EvaluationDatasetManifest {
  const filenameTrimmed = String(filename || "").trim();
  const targetPath = buildEvaluationDatasetEntryPath(filenameTrimmed);
  const legacyVideoId = toLegacyVideoId(targetPath);
  const nextVideoId = String(videoId || "").trim();

  return {
    ...manifest,
    datasets: (manifest.datasets || [])
      .map((dataset) => ({
        ...dataset,
        videos: (dataset.videos || []).filter((video) => {
          const candidate = String(video.filename || "").trim();
          const videoId = String(video.videoId || "").trim();
          if (!candidate) return false;
          return (
            candidate !== filenameTrimmed &&
            candidate !== targetPath &&
            path.basename(candidate) !== filenameTrimmed &&
            videoId !== legacyVideoId &&
            (!nextVideoId || videoId !== nextVideoId)
          );
        }),
      })),
  };
}

export function incrementModelVersion(currentVersion: string): string {
  const raw = String(currentVersion || "").trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return "0.1";

  let major = Number(match[1] || 0);
  let minor = Number(match[2] || 0);

  minor += 1;
  if (minor >= 10) {
    major += 1;
    minor = 0;
  }

  return `${major}.${minor}`;
}

export function updateManifestActiveModelVersion(
  activeModelVersion: string,
  config?: ModelRegistryConfig,
): EvaluationDatasetManifest {
  const cfg = config || readModelRegistryConfig();
  const manifest = readEvaluationDatasetManifest(cfg);
  const nextManifest: EvaluationDatasetManifest = {
    ...manifest,
    activeModelVersion: String(activeModelVersion || "").trim() || undefined,
  };
  writeEvaluationDatasetManifest(cfg, nextManifest);
  return nextManifest;
}

export function syncVideoForModelTuning(params: {
  sourceVideoPath: string;
  sourceVideoFilename: string;
  movementType: string;
  enabled: boolean;
  datasetName?: string;
  videoId?: string;
  config?: ModelRegistryConfig;
}): { enabled: boolean; manifestFilename: string; videoId: string } {
  const config = params.config || readModelRegistryConfig();
  const filename = path.basename(String(params.sourceVideoFilename || "").trim());
  if (!filename) {
    throw new Error("Invalid sourceVideoFilename");
  }

  const nextMovementType = String(params.movementType || "").trim() || "unknown";
  const manifestFilename = buildEvaluationDatasetEntryPath(filename);
  const datasetName = String(params.datasetName || "").trim() || manualTuningDatasetName;
  const nextVideoId = String(params.videoId || "").trim() || randomUUID();

  let manifest = readEvaluationDatasetManifest(config);
  manifest = removeVideoFromAllDatasets(manifest, filename, nextVideoId);

  if (params.enabled) {
    ensureEvaluationDatasetDir();

    const sourcePath = path.resolve(String(params.sourceVideoPath || ""));
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error("Source video not found for model tuning copy");
    }

    const targetPath = path.join(evaluationDatasetFolder, filename);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }

    const datasets = [...(manifest.datasets || [])];
    const datasetIndex = datasets.findIndex((item) => String(item.name || "").trim() === datasetName);
    if (datasetIndex >= 0) {
      datasets[datasetIndex] = {
        ...datasets[datasetIndex],
        videos: [
          ...(datasets[datasetIndex].videos || []),
          { videoId: nextVideoId, filename: manifestFilename, movementType: nextMovementType },
        ],
      };
    } else {
      datasets.push({
        name: datasetName,
        videos: [{ videoId: nextVideoId, filename: manifestFilename, movementType: nextMovementType }],
      });
    }

    manifest = { datasets };
  }

  writeEvaluationDatasetManifest(config, manifest);
  return {
    enabled: params.enabled,
    manifestFilename,
    videoId: nextVideoId,
  };
}

export function isMovementMatch(expectedMovement: string, detectedMovement: string): boolean {
  const expected = normalizeToken(expectedMovement);
  const detected = normalizeToken(detectedMovement);
  if (!expected || !detected) return false;
  return expected === detected;
}

export function validateEvaluationDatasetManifest(config?: ModelRegistryConfig): ManifestValidationResult {
  const cfg = config || readModelRegistryConfig();
  const manifest = readEvaluationDatasetManifest(cfg);
  const errors: string[] = [];
  const warnings: string[] = [];
  const filenameCounts = new Map<string, number>();
  const videoIdCounts = new Map<string, number>();

  if (!manifest.datasets.length) {
    warnings.push("No datasets configured in evaluation manifest.");
  }

  for (const dataset of manifest.datasets) {
    if (!String(dataset.name || "").trim()) {
      errors.push("Dataset with empty name found.");
    }

    if (!Array.isArray(dataset.videos) || dataset.videos.length === 0) {
      warnings.push(`Dataset '${dataset.name}' has no videos.`);
      continue;
    }

    for (const video of dataset.videos) {
      const filename = String(video.filename || "").trim();
      const videoId = String(video.videoId || "").trim();
      const movementType = String(video.movementType || "").trim();

      if (!filename) {
        errors.push(`Dataset '${dataset.name}' contains a video entry with empty filename.`);
        continue;
      }

      if (!videoId) {
        warnings.push(`Video '${filename}' in dataset '${dataset.name}' is missing videoId; a legacy fallback id will be used.`);
      }

      if (videoId) {
        videoIdCounts.set(videoId, (videoIdCounts.get(videoId) || 0) + 1);
      }

      filenameCounts.set(filename, (filenameCounts.get(filename) || 0) + 1);

      if (!movementType) {
        errors.push(`Video '${filename}' in dataset '${dataset.name}' is missing movementType.`);
      }
    }
  }

  const duplicateFilenames = Array.from(filenameCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([filename]) => filename)
    .sort();

  const duplicateVideoIds = Array.from(videoIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([videoId]) => videoId)
    .sort();

  if (duplicateFilenames.length > 0) {
    errors.push(`Found duplicate filenames in manifest: ${duplicateFilenames.join(", ")}.`);
  }

  if (duplicateVideoIds.length > 0) {
    errors.push(`Found duplicate videoIds in manifest: ${duplicateVideoIds.join(", ")}.`);
  }

  const totalVideos = Array.from(filenameCounts.values()).reduce((sum, count) => sum + count, 0);

  return {
    valid: errors.length === 0,
    datasetCount: manifest.datasets.length,
    totalVideos,
    duplicateFilenames,
    duplicateVideoIds,
    errors,
    warnings,
  };
}
