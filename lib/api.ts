import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { getApiUrl } from "./query-client";

export interface AnalysisResponse {
  id: string;
  userId: string | null;
  userName?: string;
  videoFilename: string;
  videoPath: string;
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
  overallScore: number;
  subScores: Record<string, number>;
  metricValues: Record<string, number>;
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
    subScores: Record<string, number>;
  } | null;
  count: number;
}

export interface AnalysisDiagnosticsResponse {
  videoDurationSec: number;
  videoQuality: string;
  fps: number;
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
  excludedShots: {
    count: number;
    reasons: string[];
  };
  movementTypeCounts: Record<string, number>;
  aiConfidencePct: number;
  detectedMovement: string;
  classificationRationale: string;
  validation: {
    valid: boolean;
    confidence: number;
    reason: string;
  };
}

export interface VideoMetadataResponse {
  capturedAt?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAltM?: number | null;
  gpsSource?: string | null;
}

export interface AnalysisShotAnnotationResponse {
  id: string;
  analysisId: string;
  userId: string;
  totalShots: number;
  orderedShotLabels: string[];
  usedForScoringShotIndexes: number[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  subScores: Record<string, number> | null;
  configKey: string | null;
}

export async function fetchAnalysesSummary(): Promise<AnalysisSummary[]> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/summary`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analyses summary");
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

export async function saveAnalysisShotAnnotation(
  id: string,
  payload: {
    totalShots: number;
    orderedShotLabels: string[];
    usedForScoringShotIndexes: number[];
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

export async function deleteAnalysis(id: string): Promise<void> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete analysis");
}

export async function uploadVideo(
  uri: string,
  filename: string,
  sportId?: string | null,
  movementId?: string | null,
  targetUserId?: string | null,
): Promise<{ id: string }> {
  const baseUrl = getApiUrl();
  const formData = new FormData();

  const file = new File(uri);
  formData.append("video", file as any, filename);
  if (sportId) formData.append("sportId", sportId);
  if (movementId) formData.append("movementId", movementId);
  if (targetUserId) formData.append("targetUserId", targetUserId);

  const res = await fetch(`${baseUrl}api/upload`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }
  return res.json();
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
