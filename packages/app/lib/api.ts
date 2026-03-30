import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import { getApiUrl } from "./query-client";
import type { PoseLandmarkerModel } from "@swing-ai/shared/pose-landmarker";
import type { PipelineTiming } from "@swing-ai/shared/pipeline-timing";
import type { ValidationScreeningSnapshot, VideoValidationMode } from "@swing-ai/shared/video-validation";

export interface AnalysisResponse {
  id: string;
  userId: string | null;
  userName?: string;
  requestedSessionType?: string | null;
  requestedFocusKey?: string | null;
  videoFilename: string;
  videoPath: string;
  videoUrl?: string | null;
  status: string;
  detectedMovement: string | null;
  rejectionReason: string | null;
  capturedAt?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsResponse {
  id: string;
  analysisId: string;
  configKey: string;
  modelVersion?: string;
  overallScore: number | null;
  subScores: Record<string, number | null>;
  metricValues: Record<string, number>;
  scoreInputs?: {
    technical: Record<string, { parameters: string[]; values: Record<string, number | null> }>;
    movement: Record<string, { parameters: string[]; values: Record<string, number | null> }>;
    tactical: Record<string, { parameters: string[]; values: Record<string, number | null> }>;
    metadata: { configKey: string; generatedAt: string };
  };
  scoreOutputs?: {
    technical: {
      overall: number | null;
      components: {
        balance: number | null;
        inertia: number | null;
        oppositeForce: number | null;
        momentum: number | null;
        elastic: number | null;
        contact: number | null;
      };
    };
    tactical: {
      overall: number | null;
      components: {
        power: number | null;
        control: number | null;
        timing: number | null;
        technique: number | null;
      };
    };
    movement: {
      overall: number | null;
      components: {
        ready: number | null;
        read: number | null;
        react: number | null;
        respond: number | null;
        recover: number | null;
      };
    };
    overall: number | null;
    metadata: { configKey: string; generatedAt: string; scale: "0-10" };
  };
  aiDiagnostics?: Record<string, unknown> | null;
}

export interface ScoreInputsResponse {
  analysisId: string;
  configKey: string | null;
  modelVersion: string | null;
  scoreInputs: MetricsResponse["scoreInputs"] | null;
}

export interface VideoStorageSettingsResponse {
  mode: "filesystem" | "r2";
  isAdmin: boolean;
}

export type AnalysisFpsStep = "step1" | "step2" | "step3";

export interface VideoValidationSettingsResponse {
  mode: VideoValidationMode;
  isAdmin: boolean;
}

export interface AnalysisFpsSettingsResponse {
  lowImpactStep: AnalysisFpsStep;
  highImpactStep: AnalysisFpsStep;
  tennisAutoDetectUsesHighImpact: boolean;
  tennisMatchPlayUsesHighImpact: boolean;
  isAdmin: boolean;
}

export interface PoseLandmarkerSettingsResponse {
  model: PoseLandmarkerModel;
  isAdmin: boolean;
}

export interface DriveMovementClassificationModelOptionResponse {
  key: string;
  label: string;
  description: string;
  badge?: string;
  modelVersion?: string | null;
}

export interface DriveMovementClassificationModelSettingsResponse {
  selectedModelKey: string;
  options: DriveMovementClassificationModelOptionResponse[];
  isAdmin: boolean;
}

export interface ClassificationModelOptionResponse extends DriveMovementClassificationModelOptionResponse {}

export interface ClassificationModelSettingsResponse extends DriveMovementClassificationModelSettingsResponse {}

export interface SportAvailabilityResponse {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  enabled: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ScoringModelDashboardResponse {
  modelVersion: string;
  modelVersionDescription: string;
  movementType: string;
  movementDetectionAccuracyPct: number;
  scoringAccuracyPct: number;
  totalVideosConsidered: number;
  datasetsUsed: string[];
  datasetMetrics: Array<{
    datasetName: string;
    movementType: string;
    movementDetectionAccuracyPct: number;
    scoringAccuracyPct: number;
  }>;
}

export interface TennisModelTrainingHistoryEntryResponse {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  requestedByUserId?: string | null;
  eligibleAnalysisCount: number;
  eligibleShotCount: number;
  exportRows?: number | null;
  trainRows?: number | null;
  testRows?: number | null;
  macroF1?: number | null;
  error?: string | null;
  savedModelVersion?: string | null;
  savedAt?: string | null;
  versionDescription?: string | null;
}

export interface TennisModelTrainingStatusResponse {
  sport: "tennis";
  eligibleAnalysisCount: number;
  eligibleShotCount: number;
  trainedModelAvailable: boolean;
  activeVersion: string;
  activeVersionDescription: string;
  draftVersion: string;
  latestTraining: {
    modelVersion: string;
    trainedAt: string;
    trainRows: number;
    testRows: number;
    datasetPath: string;
    macroF1?: number | null;
  } | null;
  currentJob: TennisModelTrainingHistoryEntryResponse | null;
  history: TennisModelTrainingHistoryEntryResponse[];
}

export type TennisModelTrainingRunResponse = TennisModelTrainingStatusResponse;

export type TennisModelVersionSaveResponse = TennisModelTrainingStatusResponse;

export interface TennisDatasetInsightsResponse {
  sport: "tennis";
  currentVersion: string;
  currentVersionDescription: string;
  filters: {
    playerId: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  currentDataset: {
    eligibleVideoCount: number;
    eligibleShotCount: number;
    videoDistribution: Array<{
      label: string;
      count: number;
      pct: number;
    }>;
    shotDistribution: Array<{
      label: string;
  modelTrend: Array<{
    modelVersion: string;
    trainedAt: string;
    savedAt: string | null;
    macroF1: number | null;
    accuracy: number | null;
    trainRows: number;
    testRows: number;
    isActiveModelVersion: boolean;
    versionStatus: string;
    versionDescription: string;
  }>;
      count: number;
      pct: number;
    }>;
    sessionTypeDistribution: Array<{
      label: "practice" | "match-play";
      count: number;
      pct: number;
    }>;
  };
  activeModel: null | {
    modelVersion: string;
    trainedAt: string;
    trainRows: number;
    testRows: number;
    datasetAnalysisCount: number;
    datasetShotCount: number;
    macroF1: number | null;
    accuracy: number | null;
    perLabel: Array<{
      label: string;
      precision: number | null;
      recall: number | null;
      f1: number | null;
      support: number;
    }>;
    confusionMatrix: {
      labels: string[];
      rows: Array<{
        actual: string;
        counts: Array<{
          predicted: string;
          count: number;
          pct: number;
        }>;
      }>;
    };
  };
  suggestions: string[];
}

export interface ManifestValidationResponse {
  valid: boolean;
  datasetCount: number;
  totalVideos: number;
  duplicateFilenames: string[];
  duplicateVideoIds?: string[];
  errors: string[];
  warnings: string[];
}

export interface ModelRegistryVersionResponse {
  id: string;
  modelVersion: string;
  description: string;
  status: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRegistryDatasetResponse {
  id: string;
  name: string;
  description: string;
  source: string;
  videoCount: number;
  movementTypes: string[];
  updatedAt: string;
}

export interface ModelRegistryConfigResponse {
  activeModelVersion: string;
  modelVersionChangeDescription: string;
  evaluationDatasetManifestPath: string;
  storage: "database";
  versions: ModelRegistryVersionResponse[];
  datasets: ModelRegistryDatasetResponse[];
  manifestValidation: ManifestValidationResponse;
}

export interface CoachingResponse {
  id: string;
  analysisId: string;
  keyStrength: string;
  improvementArea: string;
  trainingSuggestion: string;
  simpleExplanation: string;
}

export interface AnalysisDetail {
  analysis: AnalysisResponse;
  metrics: MetricsResponse | null;
  coaching: CoachingResponse | null;
  selectedMovementName: string | null;
}

export interface SportCategoryConfig {
  sportName: string;
  movementName: string;
  configKey: string;
  overallScoreLabel: string;
  metrics: Array<{
    key: string;
    label: string;
    unit: string;
    icon: string;
    category: string;
    color: string;
    description: string;
    optimalRange?: [number, number];
  }>;
  scores: Array<{
    key: string;
    label: string;
    weight: number;
  }>;
}

export interface ComparisonResponse {
  averages: {
    metricValues: Record<string, number>;
    subScores: Record<string, number | null>;
  } | null;
  count: number;
}

export interface AnalysisMetricTrendsResponse {
  period: string;
  points: Array<{
    analysisId: string;
    videoFilename?: string | null;
    sourceFilename?: string | null;
    videoContentHash?: string | null;
    capturedAt: string;
    overallScore: number | null;
    subScores: Record<string, number | null>;
    sectionScores?: {
      technical: number | null;
      tactical: number | null;
      movement: number | null;
    };
    scoreOutputs?: {
      technical?: {
        overall?: number | null;
        components?: Record<string, number | null>;
      } | null;
      tactical?: {
        overall?: number | null;
        components?: Record<string, number | null>;
      } | null;
      movement?: {
        overall?: number | null;
        components?: Record<string, number | null>;
      } | null;
      overall?: number | null;
      metadata?: Record<string, unknown>;
    } | null;
    metricValues: Record<string, number>;
  }>;
}

export interface AnalysisDiagnosticsResponse {
  videoDurationSec: number;
  videoQuality: string;
  fps: number;
  analysisFps?: {
    effectiveStep?: AnalysisFpsStep | null;
    sampleStep?: number | null;
    effectiveFps: number;
    sourceFps: number;
    lowImpactStep?: AnalysisFpsStep | null;
    highImpactStep?: AnalysisFpsStep | null;
    tennisAutoDetectUsesHighImpact?: boolean | null;
    tennisMatchPlayUsesHighImpact?: boolean | null;
    routingReason?: string | null;
  } | null;
  resolution: {
    width: number;
    height: number;
  };
  fileSizeBytes: number;
  bitrateKbps: number;
  totalFrames: number;
  framesUsedForMetrics: number;
  framesConsideredForScoring: number;
  activeTimeSec: number;
  idleTimeSec: number;
  activeTimePct: number;
  idleTimePct: number;
  poseCoveragePct: number;
  wristOcclusionPct: number;
  shoulderOcclusionPct: number;
  shotsDetected: number;
  shotsConsideredForScoring: number;
  shotSegments: Array<{
    index: number;
    startFrame: number;
    endFrame: number;
    label: string;
    frames: number;
    includedForScoring: boolean;
    classificationDebug?: {
      dominantSide?: string;
      isCrossBody?: boolean;
      isServe?: boolean;
      isCompactForward?: boolean;
      isOverhead?: boolean;
      isDownwardMotion?: boolean;
      maxWristSpeed?: number;
      rightWristSpeed?: number;
      leftWristSpeed?: number;
      swingArcRatio?: number;
      contactHeightRatio?: number;
    };
  }>;
  skeletonData?: {
    video_id: string;
    shots: Array<{
      shot_id: number;
      frames: Array<{
        frame_number: number;
        timestamp: number;
        landmarks: Array<{
          id: number;
          x: number;
          y: number;
          z: number;
          visibility: number;
        }>;
      }>;
    }>;
  };
  excludedShots: {
    count: number;
    reasons: string[];
  };
  movementTypeCounts: Record<string, number>;
  aiConfidencePct: number;
  detectedMovement: string;
  classificationRationale: string;
  pipelineTiming?: PipelineTiming | null;
  validationScreening?: ValidationScreeningSnapshot | null;
  validation: {
    valid: boolean;
    confidence: number;
    reason: string;
  };
}

export interface ShotSkeletonResponse {
  video_id: string;
  shot_id: number;
  frames: Array<{
    frame_number: number;
    timestamp: number;
    landmarks: Array<{
      id: number;
      x: number;
      y: number;
      z: number;
      visibility: number;
    }>;
  }>;
}

export interface FrameSkeletonResponse {
  video_id: string;
  shot_id: number;
  frame: {
    frame_number: number;
    timestamp: number;
    landmarks: Array<{
      id: number;
      x: number;
      y: number;
      z: number;
      visibility: number;
    }>;
  };
}

export interface VideoMetadataResponse {
  capturedAt?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAltM?: number | null;
  gpsSource?: string | null;
}

export interface CoachAskResponse {
  answer: string;
  confidence: "low" | "medium" | "high";
  dataWindowSessions: number;
  citations: {
    totalSessions: number;
    latestOverallScore?: number;
    overallDelta?: number | null;
    weakestMetrics?: string[];
  };
}

export interface AnalysisShotAnnotationResponse {
  id: string;
  analysisId: string;
  userId: string;
  totalShots: number;
  orderedShotLabels: string[];
  usedForScoringShotIndexes: number[];
  includeInTraining: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovedTennisScoreDetailResponse {
  key: string;
  label: string;
  score: number;
  explanation: string;
}

export interface ImprovedTennisReportResponse {
  sessionType: "practice" | "match-play";
  stroke: "forehand" | "backhand" | "serve" | "volley" | "match-play";
  biomechanics: ImprovedTennisScoreDetailResponse[];
  tactical: ImprovedTennisScoreDetailResponse[];
  movement: ImprovedTennisScoreDetailResponse[];
  strokeMix: Array<{
    stroke: "forehand" | "backhand" | "serve" | "volley";
    count: number;
    sharePct: number;
  }>;
  strengths: string[];
  improvementAreas: string[];
  coachingTips: string[];
  overallScore: number;
}

export interface ImprovedTennisAnalysisResponse {
  analysisId: string;
  sport: "tennis";
  report: ImprovedTennisReportResponse;
  inputMetrics: Record<string, number>;
  diagnosticsAvailable: boolean;
}

export async function fetchMyShotAnnotations(): Promise<AnalysisShotAnnotationResponse[]> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/shot-annotations`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch shot annotations");
  return res.json();
}

export interface ShotReportResponse {
  analysisId: string;
  totalShots: number;
  shots: AnalysisDiagnosticsResponse["shotSegments"];
  shotsUsedForScoring: AnalysisDiagnosticsResponse["shotSegments"];
  manualAnnotation: AnalysisShotAnnotationResponse | null;
}

export interface DiscrepancySummaryResponse {
  summary: {
    videosAnnotated: number;
    totalVideosConsidered?: number;
    videosWithDiscrepancy?: number;
    totalShots?: number;
    totalManualShots: number;
    totalMismatches: number;
    mismatchRatePct: number;
  };
  trend7d: Array<{
    day: string;
    mismatchRatePct: number;
  }>;
  topVideos: Array<{
    analysisId: string;
    videoName: string;
    userName?: string | null;
    createdAt: string;
    sportName: string;
    movementName: string;
    autoShots: number;
    manualShots: number;
    mismatches: number;
    mismatchRatePct: number;
    mismatchDeltaPct?: number;
    isNewVideo?: boolean;
  }>;
  labelConfusions: Array<{
    from: string;
    to: string;
    count: number;
  }>;
  debug?: {
    source: string;
    completedVideos?: number;
    annotationsFetched?: number;
    annotatedUsed?: number;
  };
}

function normalizeShotLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeMovementToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isAutoDetectMovement(value: unknown): boolean {
  const normalized = normalizeMovementToken(value);
  return normalized === "" || normalized === "auto" || normalized === "autodetect";
}

export async function fetchAnalyses(): Promise<AnalysisResponse[]> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analyses");
  return res.json();
}

export interface AnalysisSummary extends AnalysisResponse {
  overallScore: number | null;
  subScores: Record<string, number | null> | null;
  sportName?: string | null;
  movementName?: string | null;
  metricValues?: Record<string, number> | null;
  scoreOutputs?: {
    technical?: {
      overall?: number | null;
      components?: Record<string, number | null>;
    } | null;
    tactical?: {
      overall?: number | null;
      components?: Record<string, number | null>;
    } | null;
    movement?: {
      overall?: number | null;
      components?: Record<string, number | null>;
    } | null;
    overall?: number | null;
    metadata?: { configKey?: string; generatedAt?: string; scale?: string };
  } | null;
  sectionScores?: {
    technical: number | null;
    tactical: number | null;
    movement: number | null;
  } | null;
  configKey: string | null;
  modelVersion?: string | null;
}

export interface RecalculateAnalysesResponse {
  traceId: string;
  message: string;
  scope: "all" | "user";
  totalAnalyses: number;
  queuedAnalyses: number;
  queuedAnalysisIds: string[];
  autoRelinkedAnalyses: number;
  skippedAnalyses: number;
  skippedDetails: Array<{
    id: string;
    reason: string;
    filename: string;
  }>;
  willRefreshDiscrepancies: boolean;
  queuedDiscrepancySnapshots: number;
  analysesWithAnnotationsQueued: number;
  selectedModelVersion?: string;
  selectedModelSource?: "active" | "saved" | "draft";
}

export async function fetchAnalysesSummary(options?: { includeAll?: boolean; traceId?: string }): Promise<AnalysisSummary[]> {
  const baseUrl = getApiUrl();
  const params = new URLSearchParams();
  if (options?.includeAll) {
    params.set("includeAll", "true");
  }
  if (options?.traceId) {
    params.set("traceId", options.traceId);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${baseUrl}api/analyses/summary${query}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analyses summary");
  return res.json();
}

export async function startAnalysesRecalculation(payload?: {
  modelVersion?: string;
  useDraftModel?: boolean;
}): Promise<RecalculateAnalysesResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/recalculate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "Failed to start recalculation");
  }
  return res.json();
}

export async function fetchAnalysisDetail(
  id: string,
): Promise<AnalysisDetail> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export async function fetchSportConfig(
  configKey: string,
): Promise<SportCategoryConfig> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/sport-configs/${configKey}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch sport config");
  return res.json();
}

export async function fetchComparison(
  id: string,
  period: string,
): Promise<ComparisonResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/comparison?period=${period}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch comparison");
  return res.json();
}

export async function fetchAnalysisMetricTrends(
  id: string,
  period: string,
): Promise<AnalysisMetricTrendsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/metric-trends?period=${period}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch metric trends");
  return res.json();
}

export async function fetchAnalysisDiagnostics(
  id: string,
): Promise<AnalysisDiagnosticsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/diagnostics`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch diagnostics");
  return res.json();
}

export async function fetchShotSkeleton(
  id: string,
  shotId: number,
  options?: { startFrame?: number; endFrame?: number },
): Promise<ShotSkeletonResponse> {
  const baseUrl = getApiUrl();
  const params = new URLSearchParams();
  if (Number.isFinite(options?.startFrame)) params.set("startFrame", String(options?.startFrame));
  if (Number.isFinite(options?.endFrame)) params.set("endFrame", String(options?.endFrame));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${baseUrl}api/analyses/${id}/skeleton/shot/${shotId}${suffix}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch shot skeleton");
  return res.json();
}

export async function fetchSkeletonPlayback(
  id: string,
  shotId: number,
  options?: { startFrame?: number; endFrame?: number },
): Promise<ShotSkeletonResponse> {
  const baseUrl = getApiUrl();
  const params = new URLSearchParams();
  if (Number.isFinite(options?.startFrame)) params.set("startFrame", String(options?.startFrame));
  if (Number.isFinite(options?.endFrame)) params.set("endFrame", String(options?.endFrame));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${baseUrl}api/analyses/${id}/skeleton/shot/${shotId}/playback${suffix}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch skeleton playback data");
  return res.json();
}

export async function fetchFrameSkeleton(
  id: string,
  shotId: number,
  frameNumber: number,
): Promise<FrameSkeletonResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/skeleton/shot/${shotId}/frame/${frameNumber}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch frame skeleton");
  return res.json();
}

export interface GhostCorrectionResponse {
  frames: Array<{
    frame_number: number;
    timestamp: number;
    landmarks: Array<{
      id: number;
      x: number;
      y: number;
      z: number;
      visibility: number;
    }>;
  }>;
  correction: {
    metricKey: string;
    label: string;
    unit: string;
    playerValue: number;
    optimalRange: [number, number];
    deviation: number;
    direction: "increase" | "decrease";
  } | null;
  metricValues: Record<string, number>;
  configKey: string;
}

export async function fetchGhostCorrection(
  id: string,
  shotId: number,
): Promise<GhostCorrectionResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/ghost-correction/${shotId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch ghost correction data");
  return res.json();
}

export async function fetchAnalysisVideoMetadata(
  id: string,
): Promise<VideoMetadataResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/video-metadata`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch video metadata");
  return res.json();
}

export async function fetchAnalysisShotAnnotation(
  id: string,
): Promise<AnalysisShotAnnotationResponse | null> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/shot-annotation`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch shot annotation");
  return res.json();
}

export async function fetchImprovedTennisAnalysis(
  id: string,
): Promise<ImprovedTennisAnalysisResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/improved-tennis`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch improved tennis analysis");
  return res.json();
}

export async function fetchAnalysisScoreInputs(
  id: string,
): Promise<ScoreInputsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/score-inputs`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analysis score inputs");
  return res.json();
}

export async function saveAnalysisShotAnnotation(
  id: string,
  payload: {
    totalShots: number;
    orderedShotLabels: string[];
    usedForScoringShotIndexes: number[];
    includeInTraining?: boolean;
    notes?: string;
  },
): Promise<AnalysisShotAnnotationResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/shot-annotation`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = "Failed to save shot annotation";
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchShotReport(id: string): Promise<ShotReportResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/shot-report`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch shot report");
  return res.json();
}

export async function fetchVideoStorageSettings(): Promise<VideoStorageSettingsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/storage-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch video storage settings");
  return res.json();
}

export async function updateVideoStorageSettings(
  mode: "filesystem" | "r2",
): Promise<{ mode: "filesystem" | "r2" }> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/storage-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("Failed to update video storage settings");
  return res.json();
}

export async function fetchVideoValidationSettings(): Promise<VideoValidationSettingsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/validation-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch video validation settings");
  return res.json();
}

export async function updateVideoValidationSettings(
  mode: VideoValidationMode,
): Promise<{ mode: VideoValidationMode }> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/validation-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("Failed to update video validation settings");
  return res.json();
}

export async function fetchPoseLandmarkerSettings(): Promise<PoseLandmarkerSettingsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/pose-landmarker-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch pose landmarker settings");
  return res.json();
}

export async function fetchDriveMovementClassificationModelSettings(): Promise<DriveMovementClassificationModelSettingsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/drive-movement-classification-model-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch drive movement classification model settings");
  return res.json();
}

export async function updateDriveMovementClassificationModelSettings(
  modelKey: string,
): Promise<{ modelKey: string }> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/drive-movement-classification-model-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelKey }),
  });
  if (!res.ok) throw new Error("Failed to update drive movement classification model settings");
  return res.json();
}

export async function updateDriveMovementClassificationModelOptions(
  options: DriveMovementClassificationModelOptionResponse[],
): Promise<{ options: DriveMovementClassificationModelOptionResponse[] }> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/drive-movement-classification-model-settings/options`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options }),
  });
  if (!res.ok) throw new Error("Failed to update drive movement classification model options");
  return res.json();
}

export async function fetchClassificationModelSettings(): Promise<ClassificationModelSettingsResponse> {
  return fetchDriveMovementClassificationModelSettings();
}

export async function updateClassificationModelSettings(
  modelKey: string,
): Promise<{ modelKey: string }> {
  return updateDriveMovementClassificationModelSettings(modelKey);
}

export async function updateClassificationModelOptions(
  options: ClassificationModelOptionResponse[],
): Promise<{ options: ClassificationModelOptionResponse[] }> {
  return updateDriveMovementClassificationModelOptions(options);
}

export async function updatePoseLandmarkerSettings(
  model: PoseLandmarkerModel,
): Promise<{ model: PoseLandmarkerModel }> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/pose-landmarker-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error("Failed to update pose landmarker settings");
  return res.json();
}

export async function fetchAnalysisFpsSettings(): Promise<AnalysisFpsSettingsResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/analysis-fps-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analysis FPS settings");
  return res.json();
}

export async function updateAnalysisFpsSettings(
  lowImpactStep: AnalysisFpsStep,
  highImpactStep: AnalysisFpsStep,
  tennisAutoDetectUsesHighImpact: boolean,
  tennisMatchPlayUsesHighImpact: boolean,
): Promise<{
  lowImpactStep: AnalysisFpsStep;
  highImpactStep: AnalysisFpsStep;
  tennisAutoDetectUsesHighImpact: boolean;
  tennisMatchPlayUsesHighImpact: boolean;
}> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/analysis-fps-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lowImpactStep,
      highImpactStep,
      tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact,
    }),
  });
  if (!res.ok) throw new Error("Failed to update analysis FPS settings");
  return res.json();
}

// ── ML / LSTM Settings ────────────────────────────────────────

export type MlSettings = {
  lstmEnabled: boolean;
  lstmEnsembleWeight: number;
  lstmTrainingEnabled: boolean;
  lstmMinTrainingRows: number;
  lstmTrainingEpochs: number;
  lstmTrainingBatchSize: number;
  lstmLearningRate: number;
  modelConfidenceThreshold: number;
  modelMarginThreshold: number;
};

export async function fetchMlSettings(): Promise<MlSettings> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/ml-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch ML settings");
  return res.json();
}

export async function updateMlSettings(settings: Partial<MlSettings>): Promise<MlSettings> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/ml-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update ML settings");
  return res.json();
}

// ── R2 / Storage Settings ─────────────────────────────────────

export type R2Settings = {
  r2Endpoint: string;
  r2Region: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2PlayerVideoFolder: string;
  r2PlayerAvatarFolder: string;
  r2PlayerModelFolder: string;
  modelArtifactStorageMode: "filesystem" | "r2";
};

export async function fetchR2Settings(): Promise<R2Settings> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/r2-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch R2 settings");
  return res.json();
}

export async function updateR2Settings(settings: Partial<R2Settings>): Promise<R2Settings> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/r2-settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update R2 settings");
  return res.json();
}

export async function fetchSportsSettings(): Promise<{
  sports: SportAvailabilityResponse[];
  isAdmin: boolean;
}> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/sports-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch sports settings");
  return res.json();
}

export async function updateSportEnabled(
  sportId: string,
  enabled: boolean,
): Promise<SportAvailabilityResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/platform/sports-settings/${sportId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update sport availability");
  return res.json();
}

export async function fetchScoringModelDashboard(
  movementName?: string | null,
  playerId?: string,
): Promise<ScoringModelDashboardResponse> {
  const baseUrl = getApiUrl();
  const params = new URLSearchParams();
  if (!isAutoDetectMovement(movementName)) {
    params.set("movementName", String(movementName));
  }
  if (playerId && playerId.toLowerCase() !== "all") {
    params.set("playerId", playerId);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${baseUrl}api/scoring-model/dashboard${query}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch scoring model dashboard");
  return res.json();
}

export async function fetchTennisModelTrainingStatus(): Promise<TennisModelTrainingStatusResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/model-training/tennis`, {
    credentials: "include",
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "Failed to fetch tennis model training status");
  }
  return res.json();
}

export async function fetchTennisDatasetInsights(options?: {
  playerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<TennisDatasetInsightsResponse> {
  const baseUrl = getApiUrl();
  const params = new URLSearchParams();
  if (options?.playerId) {
    params.set("playerId", options.playerId);
  }
  if (options?.startDate) {
    params.set("startDate", options.startDate);
  }
  if (options?.endDate) {
    params.set("endDate", options.endDate);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${baseUrl}api/model-training/tennis/dataset-insights${query}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "Failed to fetch tennis dataset insights");
  }
  return res.json();
}

export async function triggerTennisModelTraining(): Promise<TennisModelTrainingRunResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/model-training/tennis/train`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "Failed to train tennis movement model");
  }
  return res.json();
}

export async function saveTennisModelVersion(payload?: {
  modelVersion?: string;
  description?: string;
}): Promise<TennisModelVersionSaveResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/model-training/tennis/save-version`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const payloadErr = await res.json().catch(() => null);
    throw new Error(payloadErr?.error || "Failed to save tennis model version");
  }
  return res.json();
}

export async function fetchModelRegistryConfig(): Promise<ModelRegistryConfigResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/model-registry/config`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch model registry config");
  return res.json();
}

export async function updateModelRegistryConfig(payload: {
  activeModelVersion: string;
  modelVersionChangeDescription: string;
  evaluationDatasetManifestPath: string;
}): Promise<ModelRegistryConfigResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/model-registry/config`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const payloadErr = await res.json().catch(() => null);
    throw new Error(payloadErr?.error || "Failed to update model registry config");
  }
  return res.json();
}

export async function validateModelRegistryManifest(): Promise<{
  config: {
    activeModelVersion: string;
    modelVersionChangeDescription: string;
    evaluationDatasetManifestPath: string;
  };
  validation: ManifestValidationResponse;
  datasets: ModelRegistryDatasetResponse[];
}> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/model-registry/validate-manifest`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to validate model registry manifest");
  return res.json();
}

export async function fetchDiscrepancySummary(
  sportName?: string,
  movementName?: string | null,
  playerId?: string,
): Promise<DiscrepancySummaryResponse> {
  const baseUrl = getApiUrl();
  const params = new URLSearchParams();
  const normalizedPlayerId = String(playerId || "").trim();
  const isAllPlayers = normalizedPlayerId.toLowerCase() === "all";
  if (sportName) {
    params.set("sportName", sportName);
  }
  if (!isAutoDetectMovement(movementName)) {
    params.set("movementName", String(movementName));
  }
  if (normalizedPlayerId && !isAllPlayers) {
    params.set("playerId", normalizedPlayerId);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const primary = await fetch(`${baseUrl}api/discrepancy-summary${query}`, {
    credentials: "include",
  });

  if (primary.ok) {
    const data = await primary.json();
    return {
      ...data,
      debug: {
        source: "server-primary",
        ...(data?.debug || {}),
      },
    };
  }

  const fallback = await fetch(`${baseUrl}api/analyses/discrepancy-summary${query}`, {
    credentials: "include",
  });

  if (fallback.ok) {
    const data = await fallback.json();
    return {
      ...data,
      debug: {
        source: "server-legacy",
        ...(data?.debug || {}),
      },
    };
  }

  const summaries = await fetchAnalysesSummary();
  const sportLower = String(sportName || "").trim().toLowerCase();
  const movementFilter = normalizeMovementToken(movementName);
  const applyMovementFilter = !isAutoDetectMovement(movementName);
  const filtered = summaries.filter((item) => {
    if (item.status !== "completed") return false;
    const key = String(item.configKey || "").toLowerCase();

    if (sportLower) {
      if (key && !key.startsWith(sportLower)) return false;
    }

    if (!applyMovementFilter) return true;

    const detected = normalizeMovementToken(item.detectedMovement);
    const configToken = normalizeMovementToken(item.configKey);
    return detected === movementFilter || configToken.includes(movementFilter);
  });

  const considered = filtered;
  let allAnnotations: AnalysisShotAnnotationResponse[] = [];
  try {
    allAnnotations = await fetchMyShotAnnotations();
  } catch {
    allAnnotations = [];
  }

  const annotationByAnalysisId = new Map(
    allAnnotations.map((item) => [item.analysisId, item]),
  );

  const shotCountByAnalysisId = new Map<string, number>();
  await Promise.all(
    considered.map(async (analysis) => {
      try {
        const detail = await fetchAnalysisDetail(analysis.id);
        const shotCountRaw = detail?.metrics?.metricValues?.shotCount;
        const shotCount = Number(shotCountRaw);
        if (Number.isFinite(shotCount) && shotCount > 0) {
          shotCountByAnalysisId.set(analysis.id, shotCount);
        }
      } catch {
        // Fallback mode best effort: skip if detail fetch fails.
      }
    }),
  );

  const annotations = considered.map((analysis) => ({
    analysis,
    annotation: annotationByAnalysisId.get(analysis.id) || null,
  }));

  const confusionMap = new Map<string, number>();
  const dayTotalShots = new Map<string, number>();
  const dayTotalMismatches = new Map<string, number>();
  const analysisHasMismatch = new Map<string, boolean>();
  const topVideos: DiscrepancySummaryResponse["topVideos"] = [];
  const annotationsFetched = annotations.filter((item) => !!item.annotation).length;
  let videosAnnotated = 0;
  let totalManualShots = 0;
  let totalMismatches = 0;

  for (const analysis of considered) {
    analysisHasMismatch.set(analysis.id, false);
    const dayKey = new Date(analysis.createdAt).toISOString().slice(0, 10);
    const shotCount = shotCountByAnalysisId.get(analysis.id) || 0;
    dayTotalShots.set(dayKey, (dayTotalShots.get(dayKey) || 0) + shotCount);
  }

  for (const { analysis, annotation } of annotations) {
    if (!annotation || !Array.isArray(annotation.orderedShotLabels) || annotation.orderedShotLabels.length === 0) {
      continue;
    }

    const manualLabels = annotation.orderedShotLabels.map((label) => normalizeShotLabel(label));
    const fallbackDetected = normalizeShotLabel(analysis.detectedMovement || "unknown");
    const autoLabels = Array.from({ length: manualLabels.length }, () => fallbackDetected);

    let mismatches = 0;
    for (let index = 0; index < manualLabels.length; index += 1) {
      if (manualLabels[index] !== autoLabels[index]) {
        mismatches += 1;
        const key = `${autoLabels[index]}=>${manualLabels[index]}`;
        confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
      }
    }

    const mismatchRatePct = Number(((mismatches / Math.max(manualLabels.length, 1)) * 100).toFixed(1));
    const movementName = analysis.detectedMovement || "Unknown";

    videosAnnotated += 1;
    totalManualShots += manualLabels.length;
    totalMismatches += mismatches;

    if (mismatches > 0 && !analysisHasMismatch.get(analysis.id)) {
      analysisHasMismatch.set(analysis.id, true);
    }

    const dayKey = new Date(analysis.createdAt).toISOString().slice(0, 10);
    dayTotalMismatches.set(dayKey, (dayTotalMismatches.get(dayKey) || 0) + mismatches);

    topVideos.push({
      analysisId: analysis.id,
      videoName: analysis.videoFilename,
      createdAt: analysis.createdAt,
      sportName: sportName || "All Sports",
      movementName,
      autoShots: autoLabels.length,
      manualShots: manualLabels.length,
      mismatches,
      mismatchRatePct,
    });
  }

  const rankedVideos = [...topVideos].sort((a, b) => {
    if (b.mismatchRatePct !== a.mismatchRatePct) {
      return b.mismatchRatePct - a.mismatchRatePct;
    }
    return b.mismatches - a.mismatches;
  });

  const trend7d: DiscrepancySummaryResponse["trend7d"] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const day = date.toISOString().slice(0, 10);
    const totalShotsForDay = dayTotalShots.get(day) || 0;
    const mismatchesForDay = dayTotalMismatches.get(day) || 0;
    const mismatchRatePct = totalShotsForDay
      ? Number(((mismatchesForDay / Math.max(totalShotsForDay, 1)) * 100).toFixed(1))
      : 0;
    trend7d.push({ day, mismatchRatePct });
  }

  const totalVideosConsidered = considered.length;
  const videosWithDiscrepancy = Array.from(analysisHasMismatch.values()).filter(Boolean).length;
  const totalShots = Array.from(shotCountByAnalysisId.values()).reduce((sum, value) => sum + value, 0);

  const labelConfusions = Array.from(confusionMap.entries())
    .map(([pair, count]) => {
      const [from, to] = pair.split("=>");
      return { from, to, count };
    })
    .filter((item) => {
      if (!applyMovementFilter) return true;
      return (
        normalizeMovementToken(item.from) === movementFilter ||
        normalizeMovementToken(item.to) === movementFilter
      );
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    summary: {
      videosAnnotated,
      totalVideosConsidered,
      videosWithDiscrepancy,
      totalShots,
      totalManualShots,
      totalMismatches,
      mismatchRatePct: Number(((totalMismatches / Math.max(totalShots, 1)) * 100).toFixed(1)),
    },
    trend7d,
    topVideos: rankedVideos,
    labelConfusions,
    debug: {
      source: "client-fallback",
      completedVideos: considered.length,
      annotationsFetched,
      annotatedUsed: videosAnnotated,
    },
  };
}

export async function askCoachQuestion(payload: {
  question: string;
  sportName?: string;
  movementName?: string | null;
  playerId?: string;
}): Promise<CoachAskResponse> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/coach/ask`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to get coach answer");
  }

  return res.json();
}

export async function deleteAnalysis(id: string): Promise<void> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete analysis");
}

type UploadVideoOptions = {
  onProgress?: (progress: {
    loaded: number;
    total: number | null;
    percent: number | null;
  }) => void;
};

function guessVideoMimeType(filename: string): string {
  const normalized = String(filename || "").trim().toLowerCase();
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".webm")) return "video/webm";
  if (normalized.endsWith(".avi")) return "video/x-msvideo";
  if (normalized.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

function parseApiErrorMessage(text: string): string {
  let message = text?.trim() || "";

  if (message) {
    try {
      const parsed = JSON.parse(message) as { error?: unknown };
      if (typeof parsed?.error === "string" && parsed.error.trim()) {
        message = parsed.error.trim();
      }
    } catch {
      // Keep plain-text message as-is when response is not JSON.
    }
  }

  return message;
}

export async function retryAnalysis(id: string): Promise<{ message: string; analysisId: string; status: string }> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}/retry`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to retry analysis");
  }

  return res.json();
}

export async function uploadVideo(
  uri: string,
  filename: string,
  sportId?: string | null,
  movementId?: string | null,
  targetUserId?: string | null,
  recordedAt?: Date | null,
  requestedSessionType?: string | null,
  requestedFocusKey?: string | null,
  options?: UploadVideoOptions,
): Promise<{ id: string }> {
  const baseUrl = getApiUrl();
  const formData = new FormData();
  const mimeType = guessVideoMimeType(filename);

  if (Platform.OS === "web") {
    const response = await globalThis.fetch(uri);
    if (!response.ok) {
      throw new Error("Failed to read the selected video in the browser before upload");
    }
    const blob = await response.blob();
    const browserFile = new globalThis.File([blob], filename, {
      type: blob.type || mimeType,
    });
    formData.append("video", browserFile);
  } else {
    formData.append("video", {
      uri,
      name: filename,
      type: mimeType,
    } as any);
  }
  if (sportId) formData.append("sportId", sportId);
  if (movementId) formData.append("movementId", movementId);
  if (targetUserId) formData.append("targetUserId", targetUserId);
  if (recordedAt) formData.append("recordedAt", recordedAt.toISOString());
  if (requestedSessionType) formData.append("requestedSessionType", requestedSessionType);
  if (requestedFocusKey) formData.append("requestedFocusKey", requestedFocusKey);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}api/upload`);
    xhr.withCredentials = true;
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (!options?.onProgress) return;
      const total = Number.isFinite(event.total) && event.total > 0 ? event.total : null;
      const percent = total != null
        ? Math.max(0, Math.min(100, Math.round((event.loaded / total) * 100)))
        : null;
      options.onProgress({
        loaded: event.loaded,
        total,
        percent,
      });
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onabort = () => {
      reject(new Error("Upload cancelled"));
    };

    xhr.onload = () => {
      const responseText = String(xhr.responseText || "");
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = parseApiErrorMessage(responseText);
        reject(new Error(message || "Upload failed"));
        return;
      }

      try {
        resolve(JSON.parse(responseText) as { id: string });
      } catch {
        reject(new Error("Upload failed"));
      }
    };

    xhr.send(formData);
  });
}

export interface FeedbackResponse {
  id: string;
  analysisId: string;
  userId: string;
  rating: "up" | "down";
  comment: string | null;
  createdAt: string;
}

export async function fetchFeedback(analysisId: string): Promise<FeedbackResponse | null> {
  const base = getApiUrl();
  const res = await fetch(`${base}api/analyses/${analysisId}/feedback`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch feedback");
  return res.json();
}

export async function submitFeedback(
  analysisId: string,
  rating: "up" | "down",
  comment?: string,
): Promise<FeedbackResponse> {
  const base = getApiUrl();
  const res = await fetch(`${base}api/analyses/${analysisId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ rating, comment }),
  });
  if (!res.ok) throw new Error("Failed to submit feedback");
  return res.json();
}
