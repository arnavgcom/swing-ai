import { fetch } from "expo/fetch";
import { getApiUrl } from "./query-client";

export interface AnalysisResponse {
  id: string;
  userId: string | null;
  userName?: string;
  videoFilename: string;
  videoPath: string;
  status: string;
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
