import { fetch } from "expo/fetch";
import { getApiUrl } from "./query-client";

export interface AnalysisResponse {
  id: string;
  videoFilename: string;
  videoPath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsResponse {
  id: string;
  analysisId: string;
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
}

export async function fetchAnalyses(): Promise<AnalysisResponse[]> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/analyses`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch analyses");
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

export interface ComparisonResponse {
  averages: Record<string, number> | null;
  count: number;
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
): Promise<{ id: string }> {
  const baseUrl = getApiUrl();
  const formData = new FormData();

  const { File } = await import("expo-file-system");
  const file = new File(uri);

  formData.append("video", file as any, filename);
  if (sportId) formData.append("sportId", sportId);
  if (movementId) formData.append("movementId", movementId);

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
