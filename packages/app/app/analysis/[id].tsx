import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Pressable,
  Platform,
  TextInput,
  Modal,
  Dimensions,
  Alert,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import { extractPipelineTiming } from "@swing-ai/shared/pipeline-timing";
import {
  getAnalysisRefreshIntervalMs,
  getCompletedAnalysisEnrichmentMessage,
} from "@/utils/analysis-refresh";
import Colors, { sportColors } from "@/constants/colors";
import {
  fetchAnalysisDetail,
  type AnalysisDetail,
  type AnalysisSummary,
  fetchAnalysisDiagnostics,
  fetchAnalysisVideoMetadata,
  fetchAnalysisShotAnnotation,
  fetchImprovedTennisAnalysis,
  fetchAnalysisMetricTrends,
  fetchSportConfig,
  fetchFeedback,
  fetchSkeletonPlayback,
  saveAnalysisShotAnnotation,
  submitFeedback,
  fetchGhostCorrection,
  retryAnalysis,
  type GhostCorrectionResponse,
  type MetricsResponse,
} from "@/services/api";
import { resolveClientMediaUrl } from "@/utils/media";
import { GlassCard } from "@/components/ui/GlassCard";
import { ScoreGauge } from "@/components/scoring/ScoreGauge";
import { MetricCard } from "@/components/cards/MetricCard";
import { CoachingCard } from "@/components/cards/CoachingCard";
import { PipelineTimingPanel } from "@/components/analysis/PipelineTimingPanel";
import { SwingAnimationTabs } from "@/components/ghost-animation/SwingAnimationTabs";
import { detectAllCorrections, detectPriorityCorrection } from "@/features/ghost-correction";
import { useAuth } from "@/contexts/auth-context";
import { formatDateTimeInTimeZone, parseApiDate, resolveUserTimeZone } from "@/utils/timezone";
import {
  buildMetricOptionsWithCatalog,
  normalizeMetricSelectionKey,
} from "@/utils/metrics-catalog";

const MPH_TO_KMPH = 1.60934;
const TECHNICAL_COMPACT_COUNT = 2;
type PerformanceSectionKey = "technical" | "tactical" | "movement";
const PERFORMANCE_SECTION_ORDER: PerformanceSectionKey[] = ["technical", "tactical", "movement"];
const BACKGROUND_NOTICE_KEY = "swingai_background_processing_notice";
const BACKGROUND_HANDOFF_MS = 5000;
const BACKGROUND_REDIRECT_DELAY_MS = 250;

function isInFlightAnalysisStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "processing";
}

function buildMetricsFromSummary(summary: AnalysisSummary): MetricsResponse | null {
  const configKey = String(summary.configKey || "").trim();
  const metricValues = summary.metricValues && typeof summary.metricValues === "object"
    ? summary.metricValues
    : null;
  const scoreOutputs = summary.scoreOutputs && typeof summary.scoreOutputs === "object"
    ? summary.scoreOutputs
    : null;

  if (!configKey || (!metricValues && !scoreOutputs && summary.overallScore == null)) {
    return null;
  }

  return {
    id: `summary-${summary.id}`,
    analysisId: summary.id,
    configKey,
    modelVersion: summary.modelVersion || undefined,
    overallScore: summary.overallScore,
    subScores: summary.subScores || {},
    metricValues: metricValues || {},
    scoreOutputs: (scoreOutputs as MetricsResponse["scoreOutputs"]) || undefined,
    aiDiagnostics: null,
  };
}

function isMphUnit(unit?: string): boolean {
  return String(unit || "").trim().toLowerCase() === "mph";
}

function toDisplaySpeed(value: number): number {
  return value * MPH_TO_KMPH;
}

const FEEDBACK_DISCREPANCY_TAGS = [
  "Wrong Detection",
  "Scores high/low",
  "Other",
] as const;

const STANDARDIZED_TACTICAL_SCORES: Array<{ key: string; label: string; weight: number }> = [
  { key: "power", label: "Power", weight: 0.30 },
  { key: "control", label: "Control", weight: 0.25 },
  { key: "timing", label: "Timing", weight: 0.25 },
  { key: "technique", label: "Technique", weight: 0.20 },
];

const SPORT_MOVEMENT_OPTIONS: Record<string, string[]> = {
  tennis: ["forehand", "backhand", "serve", "volley", "game"],
  golf: ["drive", "iron", "chip", "putt", "full-swing"],
  pickleball: ["dink", "drive", "serve", "volley", "third-shot-drop"],
  paddle: ["forehand", "backhand", "serve", "smash", "bandeja"],
  badminton: ["clear", "smash", "drop", "net-shot", "serve"],
  tabletennis: ["forehand", "backhand", "serve", "loop", "chop"],
};

function normalizeSelection(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function formatRequestedSessionTypeLabel(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "practice") return "Practise / Drill";
  if (normalized === "match-play") return "Match Play";
  return null;
}

function formatRequestedFocusLabel(
  value: string | null | undefined,
  sessionType?: string | null,
): string | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
  if (!normalized) return null;
  if (normalized === "game") {
    return String(sessionType || "").trim().toLowerCase() === "match-play" ? null : "Game";
  }
  if (normalized === "auto-detect" || normalized === "autodetect") return null;
  return normalized
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toSportPreferenceKey(sportName?: string | null): string {
  return String(sportName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-/g, "");
}

const METRICS_SCALE10_KEYS = new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency",
]);

function normalizeMetricDisplayScale(key: string, value: number): number {
  if (!Number.isFinite(value)) return value;
  if (!METRICS_SCALE10_KEYS.has(key)) return value;
  return value > 10 ? value / 10 : value;
}

function computePercentDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (Math.abs(previous) < 1e-6) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Number(pct.toFixed(1));
  return rounded === 0 ? null : rounded;
}

function deltaColor(deltaPct: number | null): string {
  if (deltaPct == null) return "#636366";
  if (Math.abs(deltaPct) < 1e-6) return "#8E8E93";
  return deltaPct >= 0 ? "#30D158" : "#FF453A";
}

function formatDeltaPercent(deltaPct: number | null, suffix = ""): string | null {
  if (deltaPct == null) return null;
  if (Math.abs(deltaPct) < 1e-6) return `-${suffix}`;
  return `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%${suffix}`;
}

function deltaTrendIcon(deltaPct: number | null): "caret-up" | "caret-down" | "remove" {
  if (deltaPct == null || Math.abs(deltaPct) < 1e-6) return "remove";
  return deltaPct > 0 ? "caret-up" : "caret-down";
}

function metricHealthScore(
  value: number,
  optimalRange?: [number, number],
): number | null {
  if (!Number.isFinite(value) || !optimalRange) return null;
  const [min, max] = optimalRange;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  if (value >= min && value <= max) return 100;

  const span = max - min;
  const gap = value < min ? min - value : value - max;
  return Math.max(0, 100 - (gap / span) * 100);
}

function scoreColor(score: number): string {
  if (score >= 8) return "#30D158";
  if (score >= 6) return "#0A84FF";
  return "#FFD60A";
}

function strokeMixColor(stroke: string): string {
  if (stroke === "serve") return "#0A84FF";
  if (stroke === "backhand") return "#FFD60A";
  if (stroke === "volley") return "#BF5AF2";
  return "#30D158";
}

function TenPointBar({
  item,
  compact = false,
}: {
  item: { key: string; label: string; score: number | null; explanation: string };
  compact?: boolean;
}) {
  const hasScore = Number.isFinite(item.score);
  const score = hasScore ? Number(item.score) : null;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score * 10));
  const color = score == null ? "#636366" : scoreColor(score);

  return (
    <View style={[styles.tenRow, compact && styles.tenRowCompact]}>
      <View style={styles.tenHeader}>
        <Text style={[styles.tenLabel, compact && styles.tenLabelCompact]}>{item.label}</Text>
        <Text style={[styles.tenScore, { color }]}>{score == null ? "N/A" : `${score}/10`}</Text>
      </View>
      <View style={[styles.tenTrack, compact && styles.tenTrackCompact]}>
        <View style={[styles.tenFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.tenExplanationRow}>
        <Text style={[styles.tenExplanation, compact && styles.tenExplanationCompact]}>
          {item.explanation}
        </Text>
      </View>
    </View>
  );
}

type TacticalScoreDetail = {
  key: string;
  label: string;
  score: number | null;
  explanation: string;
};

function formatScoreOutOfTen(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function computeWeightedTacticalScore(
  scoreConfigs: Array<{ key: string; weight: number }> | undefined,
  source: Record<string, number> | null | undefined,
): number | null {
  if (!scoreConfigs?.length || !source) return null;

  const weighted = scoreConfigs
    .map((scoreConfig) => ({
      score: Number(source?.[scoreConfig.key]),
      weight: Number(scoreConfig.weight || 0),
    }))
    .filter((row) => Number.isFinite(row.score) && row.weight > 0);

  if (!weighted.length) return null;

  const totalWeight = weighted.reduce((acc, row) => acc + row.weight, 0);
  if (totalWeight <= 0) return null;
  return weighted.reduce((acc, row) => acc + row.score * row.weight, 0) / totalWeight;
}

function computeAverageSectionScore10(items: Array<{ score: number }> | undefined): number | null {
  if (!items?.length) return null;
  const avg = items.reduce((acc, item) => acc + Number(item.score || 0), 0) / items.length;
  return Number.isFinite(avg) ? avg : null;
}

function tacticalExplanation(key: string, label: string, score: number): string {
  const normalizedKey = String(key || "").toLowerCase();
  const normalizedScore = Number.isFinite(score) ? score : 0;
  const band = normalizedScore >= 8 ? "high" : normalizedScore >= 6 ? "mid" : "low";

  if (normalizedKey === "power") {
    if (band === "high") return "Power is being used effectively to create pressure without losing tactical control.";
    if (band === "mid") return "Power is present, but selective acceleration can improve point pressure.";
    return "Power output is limiting tactical pressure; load and intent need to rise in key moments.";
  }

  if (normalizedKey === "control") {
    if (band === "high") return "Control is strong, supporting reliable depth and directional accuracy under pace.";
    if (band === "mid") return "Control is serviceable, but depth and targeting drift on tougher balls.";
    return "Control is inconsistent; simplify targets and stabilize contact for better placement.";
  }

  if (normalizedKey === "timing") {
    if (band === "high") return "Timing is sharp, allowing clean setup and efficient strike windows.";
    if (band === "mid") return "Timing is workable, but earlier preparation would improve shot quality.";
    return "Timing is late or rushed, reducing tactical options and shot consistency.";
  }

  if (normalizedKey === "technique") {
    if (band === "high") return "Technique execution is stable and supports repeatable tactical outcomes.";
    if (band === "mid") return "Technique is mostly functional, with occasional breakdowns under pressure.";
    return "Technique inconsistencies are affecting tactical reliability; prioritize repeatable mechanics.";
  }

  return `${label} is ${band === "high" ? "strong" : band === "mid" ? "developing" : "currently limiting"} tactical execution.`;
}

function technicalExplanation(key: string, label: string, score: number): string {
  const normalizedKey = String(key || "").toLowerCase();
  const normalizedScore = Number.isFinite(score) ? score : 0;
  const band = normalizedScore >= 8 ? "high" : normalizedScore >= 6 ? "mid" : "low";

  if (normalizedKey === "balance") {
    if (band === "high") return "Base is stable and supports reliable transfer under pace.";
    if (band === "mid") return "Base is mostly stable; occasional drift appears under speed.";
    return "Base stability is inconsistent, reducing clean force transfer into contact.";
  }

  if (normalizedKey === "inertia") {
    if (band === "high") return "Stance and body alignment preserve efficient directional energy.";
    if (band === "mid") return "Alignment is workable, but setup consistency can improve.";
    return "Stance alignment is inconsistent and limits clean energy direction.";
  }

  if (normalizedKey === "oppositeForce") {
    if (band === "high") return "Ground reaction and bracing are synchronized through contact.";
    if (band === "mid") return "Force exchange is present but fades in faster sequences.";
    return "Opposing force timing is weak, reducing stability at strike.";
  }

  if (normalizedKey === "momentum") {
    if (band === "high") return "Momentum flows efficiently from setup through release.";
    if (band === "mid") return "Momentum transfer is acceptable with intermittent leaks.";
    return "Momentum transfer breaks down before or through contact.";
  }

  if (normalizedKey === "elastic") {
    if (band === "high") return "Elastic loading and release support repeatable acceleration.";
    if (band === "mid") return "Elastic sequencing appears but is not fully repeatable.";
    return "Stretch-shortening timing is limited, reducing racket-head speed potential.";
  }

  if (normalizedKey === "contact") {
    if (band === "high") return "Contact quality is stable with strong timing and spacing.";
    if (band === "mid") return "Contact is mostly clean, with occasional timing drift.";
    return "Contact consistency is low; timing and spacing break down under pressure.";
  }

  return `${label} is ${band === "high" ? "strong" : band === "mid" ? "developing" : "currently limiting"} technical execution.`;
}

function movementExplanation(key: string, label: string, score: number): string {
  const normalizedKey = String(key || "").toLowerCase();
  const normalizedScore = Number.isFinite(score) ? score : 0;
  const band = normalizedScore >= 8 ? "high" : normalizedScore >= 6 ? "mid" : "low";

  if (normalizedKey === "ready") {
    if (band === "high") return "Split-step timing, knee flex, and base setup prepare efficient lower-body movement.";
    if (band === "mid") return "Preparation is generally on time with occasional late setup.";
    return "Preparation is often late, limiting first-step efficiency.";
  }

  if (normalizedKey === "read") {
    if (band === "high") return "Early read supports efficient footwork choices and balanced body positioning.";
    if (band === "mid") return "Ball and opponent cues are read adequately but sometimes delayed.";
    return "Read timing is delayed, creating rushed positioning decisions.";
  }

  if (normalizedKey === "react") {
    if (band === "high") return "Reaction speed supports quick directional change without losing posture.";
    if (band === "mid") return "Reaction is acceptable but slows on sharper tempo changes.";
    return "Reaction lag reduces time available for efficient setup.";
  }

  if (normalizedKey === "respond") {
    if (band === "high") return "Response quality stays composed across changing rally demands.";
    if (band === "mid") return "Response quality is serviceable with occasional recovery delays.";
    return "Response consistency is low, reducing control in transition moments.";
  }

  if (normalizedKey === "recover") {
    if (band === "high") return "Recovery steps are efficient, restoring neutral position quickly.";
    if (band === "mid") return "Recovery is generally timely but drifts after wide contacts.";
    return "Recovery speed and spacing are limiting transition readiness.";
  }

  return `${label} is ${band === "high" ? "strong" : band === "mid" ? "developing" : "currently limiting"} movement quality.`;
}

function TacticalBar({
  item,
  compact = false,
}: {
  item: TacticalScoreDetail;
  compact?: boolean;
}) {
  const scoreOutOfTen = Number.isFinite(item.score) ? Math.max(0, Math.min(10, Number(item.score))) : null;
  const pct = scoreOutOfTen == null ? 0 : scoreOutOfTen * 10;
  const color =
    scoreOutOfTen == null
      ? "#636366"
      : pct >= 80
        ? "#30D158"
        : pct >= 60
          ? "#0A84FF"
          : pct >= 40
            ? "#FFD60A"
            : "#FF453A";
  const roundedScore = scoreOutOfTen == null ? null : Math.round(scoreOutOfTen * 10) / 10;
  const displayScore =
    roundedScore == null
      ? "N/A"
      : Number.isInteger(roundedScore)
        ? String(roundedScore)
        : roundedScore.toFixed(1);
  return (
    <View style={[styles.tenRow, compact && styles.tenRowCompact]}>
      <View style={styles.tenHeader}>
        <Text style={[styles.tenLabel, compact && styles.tenLabelCompact]}>{item.label}</Text>
        <Text style={[styles.tenScore, { color }]}>{displayScore}/10</Text>
      </View>
      <View style={[styles.tenTrack, compact && styles.tenTrackCompact]}>
        <View style={[styles.tenFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.tenExplanationRow}>
        <Text style={[styles.tenExplanation, compact && styles.tenExplanationCompact]}>
          {item.explanation}
        </Text>
      </View>
    </View>
  );
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDateWithTimezone(
  value: string | null | undefined,
  timeZone?: string,
): string {
  if (!value) return "-";
  const date = parseApiDate(value);
  if (!date) return "-";
  return formatDateTimeInTimeZone(date, timeZone, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatHeaderDateTime(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "Unknown date";
  const date = parseApiDate(value);
  if (!date) return "Unknown date";
  const day = date.toLocaleString("en-GB", { day: "2-digit", timeZone });
  const month = date.toLocaleString("en-GB", { month: "short", timeZone });
  const year = date.toLocaleString("en-GB", { year: "numeric", timeZone });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });

  const compactTime = time.replace(/\s?(AM|PM)$/i, "$1");

  return `${day} ${month} ${year} ${compactTime}`;
}

function derivePlayerNameFromVideoName(filename: string | null | undefined): string | null {
  const base = String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .trim();
  if (!base) return null;

  const sportTokens = new Set(["tennis", "golf", "pickleball", "paddle", "badminton", "table", "tabletennis"]);
  const stopTokens = new Set(["autodetect", "automodel", "model", "analysis", "upload"]);

  let parts = base.split(/[-_]/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  if (sportTokens.has(parts[0].toLowerCase())) {
    parts = parts.slice(1);
  }

  const nameParts: string[] = [];
  for (const part of parts) {
    const cleaned = part.replace(/[^a-zA-Z\s]/g, "").trim();
    if (!cleaned) continue;
    const flat = cleaned.toLowerCase().replace(/\s+/g, "");
    if (stopTokens.has(flat)) break;
    if (/^\d+$/.test(cleaned)) break;
    nameParts.push(cleaned);
    if (nameParts.length >= 2) break;
  }

  if (!nameParts.length) return null;
  return nameParts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCamelCaseLabel(value: string): string {
  const parts = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "unknown";

  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");
}

export default function AnalysisDetailScreen() {
  const { id, backgroundOnSlow } = useLocalSearchParams<{ id: string; backgroundOnSlow?: string }>();
  const colors = Colors.dark;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [fullscreen, setFullscreen] = useState(false);
  const [feedbackSheetVisible, setFeedbackSheetVisible] = useState(false);
  const [pendingRating, setPendingRating] = useState<"up" | "down" | null>(null);
  const [selectedDiscrepancies, setSelectedDiscrepancies] = useState<string[]>([]);
  const [discrepancyText, setDiscrepancyText] = useState("");
  const [manualShotLabels, setManualShotLabels] = useState<string[]>([]);
  const [manualIncludeInTraining, setManualIncludeInTraining] = useState(true);
  const [manualFormInitialized, setManualFormInitialized] = useState(false);
  const [activeShotDropdownIndex, setActiveShotDropdownIndex] = useState<number | null>(null);
  const [manualSavedVisible, setManualSavedVisible] = useState(false);
  const [manualSaveMessage, setManualSaveMessage] = useState("Saved");
  const [manualAnnotationDone, setManualAnnotationDone] = useState(false);
  const [showAllTechnical, setShowAllTechnical] = useState(false);
  const [showAllTactical, setShowAllTactical] = useState(false);
  const [showAllMovement, setShowAllMovement] = useState(false);
  const [showBackgroundHandoffToast, setShowBackgroundHandoffToast] = useState(false);
  const [pipelineTimingModalVisible, setPipelineTimingModalVisible] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundRedirectStartedRef = useRef(false);
  const enrichmentPendingRef = useRef(false);
  const [sectionOffsets, setSectionOffsets] = useState<Partial<Record<PerformanceSectionKey, number>>>({});
  const [activePerformanceSection, setActivePerformanceSection] = useState<PerformanceSectionKey>("technical");

  useEffect(() => {
    if (!id) return;
    AsyncStorage.setItem("swingai_last_worked_analysis_id", id).catch(() => {});
  }, [id]);

  const { data, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      return getAnalysisRefreshIntervalMs(
        query.state.data?.analysis?.status,
        query.state.data?.metrics?.aiDiagnostics,
      );
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryAnalysis,
    onSuccess: async (result) => {
      await AsyncStorage.setItem(BACKGROUND_NOTICE_KEY, "Retry started. Processing will continue in the background.").catch(() => {});
      await AsyncStorage.setItem("swingai_last_worked_analysis_id", result.analysisId).catch(() => {});

      queryClient.setQueryData<AnalysisDetail | undefined>(["analysis", id], (current) => {
        if (!current) return current;
        return {
          ...current,
          analysis: {
            ...current.analysis,
            status: "processing",
            rejectionReason: null,
            updatedAt: new Date().toISOString(),
          },
        };
      });

      queryClient.invalidateQueries({ queryKey: ["analysis", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Retry Failed", error.message || "Could not restart analysis.");
    },
  });

  const cachedSummary = useMemo(() => {
    if (!id) return null;
    const summaryRows = queryClient.getQueryData<AnalysisSummary[]>(["analyses-summary"]);
    if (!Array.isArray(summaryRows)) return null;
    return summaryRows.find((item) => item.id === id) || null;
  }, [id, queryClient]);

  const summaryMetrics = useMemo(
    () => (cachedSummary ? buildMetricsFromSummary(cachedSummary) : null),
    [cachedSummary],
  );

  const analysis = useMemo(() => {
    if (!data?.analysis) return data?.analysis;
    if (!cachedSummary) return data.analysis;
    if (!isInFlightAnalysisStatus(data.analysis.status) || isInFlightAnalysisStatus(cachedSummary.status)) {
      return data.analysis;
    }

    return {
      ...data.analysis,
      status: cachedSummary.status,
      detectedMovement: cachedSummary.detectedMovement || data.analysis.detectedMovement,
      rejectionReason: cachedSummary.rejectionReason || data.analysis.rejectionReason,
      requestedSessionType: cachedSummary.requestedSessionType ?? data.analysis.requestedSessionType,
      requestedFocusKey: cachedSummary.requestedFocusKey ?? data.analysis.requestedFocusKey,
      updatedAt: cachedSummary.updatedAt || data.analysis.updatedAt,
    };
  }, [cachedSummary, data?.analysis]);

  const m = useMemo(() => {
    if (data?.metrics) return data.metrics;
    if (!data?.analysis || !cachedSummary || !summaryMetrics) return data?.metrics;
    if (!isInFlightAnalysisStatus(data.analysis.status) || isInFlightAnalysisStatus(cachedSummary.status)) {
      return data.metrics;
    }
    return summaryMetrics;
  }, [cachedSummary, data?.analysis, data?.metrics, summaryMetrics]);

  const coaching = data?.coaching;
  const configKey = m?.configKey;
  const pipelineTiming = useMemo(
    () => extractPipelineTiming(data?.metrics?.aiDiagnostics),
    [data?.metrics?.aiDiagnostics],
  );
  const enrichmentMessage = useMemo(
    () => getCompletedAnalysisEnrichmentMessage(data?.analysis?.status, data?.metrics?.aiDiagnostics),
    [data?.analysis?.status, data?.metrics?.aiDiagnostics],
  );
  const enrichmentRefreshInterval = useMemo(
    () => getAnalysisRefreshIntervalMs(data?.analysis?.status, data?.metrics?.aiDiagnostics),
    [data?.analysis?.status, data?.metrics?.aiDiagnostics],
  );

  const { data: sportConfig } = useQuery({
    queryKey: ["sport-config", configKey],
    queryFn: () => fetchSportConfig(configKey!),
    enabled: !!configKey,
  });

  const { data: trendData } = useQuery({
    queryKey: ["analysis", id, "metric-trends", "all-sessions"],
    queryFn: () => fetchAnalysisMetricTrends(id!, "all"),
    enabled: !!id && data?.analysis?.status === "completed",
    refetchInterval: enrichmentRefreshInterval,
  });

  const { data: improvedData, isLoading: improvedLoading } = useQuery({
    queryKey: ["analysis", id, "improved-tennis"],
    queryFn: () => fetchImprovedTennisAnalysis(id!),
    enabled: !!id && data?.analysis?.status === "completed",
    staleTime: 5 * 60 * 1000,
    refetchInterval: enrichmentRefreshInterval,
  });

  const { data: diagnostics, isLoading: diagnosticsLoading } = useQuery({
    queryKey: ["analysis", id, "diagnostics"],
    queryFn: () => fetchAnalysisDiagnostics(id!),
    enabled: !!id && data?.analysis?.status === "completed",
    refetchInterval: (query) => getAnalysisRefreshIntervalMs(
      data?.analysis?.status,
      query.state.data?.pipelineTiming ?? data?.metrics?.aiDiagnostics,
    ),
  });

  const { data: videoMetadata, isLoading: videoMetadataLoading } = useQuery({
    queryKey: ["analysis", id, "video-metadata"],
    queryFn: () => fetchAnalysisVideoMetadata(id!),
    enabled: !!id && data?.analysis?.status === "completed",
  });

  const { data: feedback } = useQuery({
    queryKey: ["analysis", id, "feedback"],
    queryFn: () => fetchFeedback(id!),
    enabled: !!id && data?.analysis?.status === "completed",
  });

  const { data: shotAnnotation } = useQuery({
    queryKey: ["analysis", id, "shot-annotation"],
    queryFn: () => fetchAnalysisShotAnnotation(id!),
    enabled: !!id && data?.analysis?.status === "completed",
  });

  const primaryShotId = useMemo(() => {
    if (!diagnostics?.shotSegments?.length) return null;
    const scoring = diagnostics.shotSegments.find((s: any) => s.includedForScoring);
    return scoring ? scoring.index : diagnostics.shotSegments[0].index;
  }, [diagnostics?.shotSegments]);

  const scoringShotIds = useMemo(() => {
    const fromDiagnostics = (diagnostics?.shotSegments || [])
      .filter((segment: any) => segment.includedForScoring)
      .map((segment: any) => Number(segment.index))
      .filter((index: number) => Number.isInteger(index) && index > 0);

    if (fromDiagnostics.length > 0) {
      return Array.from(new Set(fromDiagnostics));
    }

    return primaryShotId != null ? [primaryShotId] : [];
  }, [diagnostics?.shotSegments, primaryShotId]);

  const { data: ghostData, isLoading: ghostDataLoading, isFetching: ghostDataFetching } = useQuery({
    queryKey: ["analysis", id, "ghost-correction", primaryShotId],
    queryFn: () => fetchGhostCorrection(id!, primaryShotId!),
    enabled: !!id && primaryShotId != null && data?.analysis?.status === "completed",
    refetchInterval: enrichmentRefreshInterval,
  });

  useEffect(() => {
    const enrichmentPending = Boolean(enrichmentMessage);
    const shouldRefreshDependents = enrichmentPendingRef.current && !enrichmentPending && !!id;

    if (shouldRefreshDependents) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "metric-trends", "all-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "improved-tennis"] }),
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "diagnostics"] }),
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "ghost-correction"] }),
      ]);
    }

    enrichmentPendingRef.current = enrichmentPending;
  }, [enrichmentMessage, id, queryClient]);

  const {
    data: scoringShotSkeletons,
    isLoading: scoringShotSkeletonsLoading,
    isFetching: scoringShotSkeletonsFetching,
  } = useQuery({
    queryKey: ["analysis", id, "skeleton-playback-scoring-shots", scoringShotIds.join(",")],
    queryFn: () => Promise.all(scoringShotIds.map((shotId) => fetchSkeletonPlayback(id!, shotId))),
    enabled: !!id && data?.analysis?.status === "completed" && scoringShotIds.length > 0,
    staleTime: 60 * 1000,
  });

  const ghostMetricValues = useMemo(() => {
    const source = ghostData?.metricValues ?? m?.metricValues;
    if (!source || typeof source !== "object") return {} as Record<string, number>;
    return source as Record<string, number>;
  }, [ghostData?.metricValues, m?.metricValues]);

  const ghostCorrection = useMemo(() => {
    if (!sportConfig?.metrics) return null;

    const metricDefinitions = sportConfig.metrics as Parameters<typeof detectPriorityCorrection>[1];

    const fallback = detectPriorityCorrection(ghostMetricValues, metricDefinitions);

    if (!ghostData?.correction) {
      return fallback;
    }

    const serverMetricKey = String(ghostData.correction.metricKey || "").trim();
    if (!serverMetricKey) {
      return fallback;
    }

    const metricDef = metricDefinitions.find((metric) => metric.key === serverMetricKey);
    if (!metricDef?.optimalRange) {
      return fallback;
    }

    const serverPlayerValue = Number(ghostData.correction.playerValue);
    if (!Number.isFinite(serverPlayerValue)) {
      return fallback;
    }

    const synthesized = detectPriorityCorrection(
      { [metricDef.key]: serverPlayerValue },
      [metricDef],
    );

    if (!synthesized) {
      return fallback;
    }

    return {
      ...synthesized,
      label: String(ghostData.correction.label || synthesized.label),
      unit: String(ghostData.correction.unit || synthesized.unit || ""),
      playerValue: serverPlayerValue,
      optimalRange: [
        Number(ghostData.correction.optimalRange?.[0] ?? synthesized.optimalRange[0]),
        Number(ghostData.correction.optimalRange?.[1] ?? synthesized.optimalRange[1]),
      ] as [number, number],
      deviation: Number.isFinite(Number(ghostData.correction.deviation))
        ? Number(ghostData.correction.deviation)
        : synthesized.deviation,
      direction:
        ghostData.correction.direction === "increase" || ghostData.correction.direction === "decrease"
          ? ghostData.correction.direction
          : synthesized.direction,
    };
  }, [ghostData?.correction, ghostMetricValues, sportConfig?.metrics]);

  const ghostCorrections = useMemo(() => {
    if (!sportConfig?.metrics) return [];

    const metricDefinitions = sportConfig.metrics as Parameters<typeof detectAllCorrections>[1];
    const all = detectAllCorrections(ghostMetricValues, metricDefinitions);
    if (!ghostData?.correction || all.length <= 1) {
      return all;
    }

    const serverMetricKey = String(ghostData.correction.metricKey || "").trim();
    if (!serverMetricKey) {
      return all;
    }

    const serverPlayerValue = Number(ghostData.correction.playerValue);
    const serverCorrectionIndex = all.findIndex((item) => item.metricKey === serverMetricKey);
    if (serverCorrectionIndex < 0) {
      return all;
    }

    const normalizedRange = [
      Number(ghostData.correction.optimalRange?.[0] ?? all[serverCorrectionIndex].optimalRange[0]),
      Number(ghostData.correction.optimalRange?.[1] ?? all[serverCorrectionIndex].optimalRange[1]),
    ] as [number, number];

    const patchedServer = {
      ...all[serverCorrectionIndex],
      label: String(ghostData.correction.label || all[serverCorrectionIndex].label),
      unit: String(ghostData.correction.unit || all[serverCorrectionIndex].unit),
      playerValue: Number.isFinite(serverPlayerValue)
        ? serverPlayerValue
        : all[serverCorrectionIndex].playerValue,
      optimalRange: normalizedRange,
      deviation: Number.isFinite(Number(ghostData.correction.deviation))
        ? Number(ghostData.correction.deviation)
        : all[serverCorrectionIndex].deviation,
      direction:
        ghostData.correction.direction === "increase" || ghostData.correction.direction === "decrease"
          ? ghostData.correction.direction
          : all[serverCorrectionIndex].direction,
    };

    return [
      patchedServer,
      ...all.filter((_, index) => index !== serverCorrectionIndex),
    ];
  }, [ghostData?.correction, ghostMetricValues, sportConfig?.metrics]);

  const ghostPlayerFrames = useMemo(() => {
    const mergedScoringFrames = (scoringShotSkeletons || [])
      .flatMap((shot) => (Array.isArray(shot?.frames) ? shot.frames : []))
      .filter((frame) => Number.isFinite(Number(frame?.frame_number)));

    if (mergedScoringFrames.length > 0) {
      return [...mergedScoringFrames].sort(
        (left, right) => Number(left.frame_number) - Number(right.frame_number),
      );
    }

    if (!ghostData?.frames?.length) return [];
    return ghostData.frames;
  }, [scoringShotSkeletons, ghostData?.frames]);

  const isGhostAnimationLoading =
    analysis?.status === "completed"
    && ghostPlayerFrames.length === 0
    && (
      diagnosticsLoading
      || (primaryShotId != null && (ghostDataLoading || ghostDataFetching || scoringShotSkeletonsLoading || scoringShotSkeletonsFetching))
    );

  const feedbackMutation = useMutation({
    mutationFn: (vars: { rating: "up" | "down"; comment?: string }) =>
      submitFeedback(id!, vars.rating, vars.comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", id, "feedback"] });
    },
  });

  const shotAnnotationMutation = useMutation({
    mutationFn: (payload: {
      totalShots: number;
      orderedShotLabels: string[];
      usedForScoringShotIndexes: number[];
      includeInTraining?: boolean;
      notes?: string;
    }) => saveAnalysisShotAnnotation(id!, payload),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "shot-annotation"] }),
        queryClient.invalidateQueries({ queryKey: ["discrepancy-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["scoring-model-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["tennis-model-training-status"] }),
      ]);
      queryClient.setQueryData(["analysis", id, "shot-annotation"], saved);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setManualAnnotationDone(true);
      setActiveShotDropdownIndex(null);
      setManualSaveMessage("Save Successful");
      setManualSavedVisible(true);
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setManualSaveMessage("Save Failed");
      setManualSavedVisible(true);
      Alert.alert("Save failed", error.message || "Could not save manual annotation.");
    },
  });

  const handleThumbSelection = useCallback((rating: "up" | "down") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pendingRating === rating) {
      setPendingRating(null);
      setSelectedDiscrepancies([]);
      setDiscrepancyText("");
      setFeedbackSheetVisible(false);
      return;
    }
    setPendingRating(rating);
    setFeedbackSheetVisible(true);
  }, [pendingRating]);

  const toggleDiscrepancy = useCallback((tag: string) => {
    setSelectedDiscrepancies((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }, []);

  const closeFeedbackSheet = useCallback(() => {
    setFeedbackSheetVisible(false);
  }, []);

  useEffect(() => {
    setManualFormInitialized(false);
    setManualShotLabels([]);
    setManualIncludeInTraining(true);
    setActiveShotDropdownIndex(null);
    setManualAnnotationDone(false);
  }, [id]);

  useEffect(() => {
    const savedLabels = (shotAnnotation?.orderedShotLabels || [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (savedLabels.length > 0) {
      setManualAnnotationDone(true);
    }

  }, [shotAnnotation]);

  useEffect(() => {
    if (manualFormInitialized) return;
    if (!diagnostics && !shotAnnotation) return;

    const savedLabels = (shotAnnotation?.orderedShotLabels || [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);

    setManualIncludeInTraining(shotAnnotation?.includeInTraining ?? true);

    if (savedLabels.length > 0) {
      setManualShotLabels(savedLabels);
      setManualFormInitialized(true);
      return;
    }

    if (diagnostics) {
      const labels = (diagnostics.shotSegments || []).map((segment) => segment.label || "unknown");

      setManualShotLabels(labels.map((item) => String(item || "").toLowerCase()));
      setManualFormInitialized(true);
    }
  }, [diagnostics, manualFormInitialized, shotAnnotation]);

  useEffect(() => {
    if (!manualSavedVisible) return;
    if (manualSaveMessage === "Saving...") return;
    const timeout = setTimeout(() => {
      setManualSavedVisible(false);
    }, 1800);

    return () => clearTimeout(timeout);
  }, [manualSavedVisible, manualSaveMessage]);

  const movementTypeOptions = useMemo(() => {
    const sportKey = String(sportConfig?.sportName || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    const sportOptions = SPORT_MOVEMENT_OPTIONS[sportKey];
    if (sportOptions && sportOptions.length > 0) {
      return sportOptions;
    }

    const values = new Set<string>();
    (manualShotLabels || []).forEach((item) => {
      const label = String(item || "").trim().toLowerCase();
      if (label) values.add(label);
    });

    (diagnostics?.shotSegments || []).forEach((segment) => {
      const label = String(segment.label || "").trim().toLowerCase();
      if (label) values.add(label);
    });

    Object.keys(diagnostics?.movementTypeCounts || {}).forEach((label) => {
      const normalized = String(label || "").trim().toLowerCase();
      if (normalized) values.add(normalized);
    });

    if (values.size === 0) {
      values.add("forehand");
      values.add("backhand");
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [diagnostics, manualShotLabels, sportConfig?.sportName]);

  const handleSubmitFeedbackSheet = useCallback(() => {
    if (!pendingRating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const parts: string[] = [];
    if (selectedDiscrepancies.length > 0) {
      parts.push(`Discrepancies: ${selectedDiscrepancies.join(", ")}`);
    }
    if (discrepancyText.trim()) {
      parts.push(`Notes: ${discrepancyText.trim()}`);
    }
    const composedComment = parts.join("\n");

    feedbackMutation.mutate(
      { rating: pendingRating, comment: composedComment || undefined },
      {
        onSuccess: () => {
          setFeedbackSheetVisible(false);
          setSelectedDiscrepancies([]);
          setDiscrepancyText("");
          setPendingRating(null);
        },
      },
    );
  }, [pendingRating, selectedDiscrepancies, discrepancyText, feedbackMutation]);

  const handleSaveManualAnnotation = useCallback(() => {
    const fromForm = (manualShotLabels || [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);

    const fromSaved = (shotAnnotation?.orderedShotLabels || [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);

    const fromDiagnostics = (diagnostics?.shotSegments || [])
      .map((segment) => String(segment.label || "").trim().toLowerCase())
      .filter(Boolean);

    const orderedShotLabels =
      fromForm.length > 0
        ? fromForm
        : fromSaved.length > 0
          ? fromSaved
          : fromDiagnostics;

    const totalShots = orderedShotLabels.length;

    if (totalShots === 0) {
      Alert.alert(
        "Invalid input",
        "Add at least one shot label before saving.",
      );
      return;
    }

    setActiveShotDropdownIndex(null);
    setManualSaveMessage("Saving...");
    setManualSavedVisible(true);

    shotAnnotationMutation.mutate({
      totalShots,
      orderedShotLabels,
      usedForScoringShotIndexes: Array.from(
        { length: totalShots },
        (_value, index) => index + 1,
      ),
      includeInTraining: manualIncludeInTraining,
    });
  }, [
    diagnostics?.shotSegments,
    manualIncludeInTraining,
    manualShotLabels,
    shotAnnotation?.orderedShotLabels,
    shotAnnotationMutation,
  ]);

  const handleAddManualShot = useCallback(() => {
    setManualShotLabels((prev) => [...prev, "forehand"]);
  }, []);

  const handleRemoveManualShot = useCallback(() => {
    setManualShotLabels((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const improvedReport = improvedData?.report;
  const isMatchPlayImproved = improvedReport?.sessionType === "match-play";
  const improvedStrokeMixItems = useMemo(() => improvedReport?.strokeMix || [], [improvedReport?.strokeMix]);

  const selectedScoreSections = useMemo(() => {
    const sportKey = toSportPreferenceKey(sportConfig?.sportName);
    const bySport =
      user?.selectedScoreSectionsBySport
      && typeof user.selectedScoreSectionsBySport === "object"
        ? user.selectedScoreSectionsBySport
        : {};
    const scoped = sportKey && Array.isArray(bySport[sportKey]) ? bySport[sportKey] : null;
    const fallback = Array.isArray(user?.selectedScoreSections) ? user.selectedScoreSections : [];
    const saved = scoped || fallback;
    return new Set(saved.map(normalizeSelection));
  }, [sportConfig?.sportName, user?.selectedScoreSections, user?.selectedScoreSectionsBySport]);

  const selectedMetricKeys = useMemo(() => {
    const sportKey = toSportPreferenceKey(sportConfig?.sportName);
    const bySport =
      user?.selectedMetricKeysBySport
      && typeof user.selectedMetricKeysBySport === "object"
        ? user.selectedMetricKeysBySport
        : {};
    const scoped = sportKey && Array.isArray(bySport[sportKey]) ? bySport[sportKey] : null;
    const fallback = Array.isArray(user?.selectedMetricKeys) ? user.selectedMetricKeys : [];
    const saved = scoped || fallback;
    return new Set(
      saved
        .map((item) => normalizeMetricSelectionKey(String(item || "")))
        .filter((item) => item.length > 0),
    );
  }, [sportConfig?.sportName, user?.selectedMetricKeys, user?.selectedMetricKeysBySport]);

  const availableMetricDefinitions = useMemo(
    () => buildMetricOptionsWithCatalog(sportConfig?.metrics || []),
    [sportConfig?.metrics],
  );

  const availableMetricByKey = useMemo(() => {
    const map = new Map<string, (typeof availableMetricDefinitions)[number]>();
    for (const metric of availableMetricDefinitions) {
      map.set(metric.key, metric);
    }
    return map;
  }, [availableMetricDefinitions]);

  const hasSectionSelection = selectedScoreSections.size > 0;
  const hasMetricSelection = selectedMetricKeys.size > 0;
  const showBreakdown =
    !hasSectionSelection || selectedScoreSections.has("tactical") || selectedScoreSections.has("performance breakdown");
  const showBiomechanics =
    !hasSectionSelection || selectedScoreSections.has("technical (biomec)") || selectedScoreSections.has("biomechanics");
  const showMovement =
    !hasSectionSelection || selectedScoreSections.has("movement");

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const displayVideoName = useMemo(() => {
    if (analysis?.videoPath) {
      const fromPath = analysis.videoPath.split(/[\\/]/).pop();
      if (fromPath) return fromPath;
    }
    return analysis?.videoFilename || "Analysis";
  }, [analysis?.videoPath, analysis?.videoFilename]);

  const displayedMetrics = useMemo(() => {
    if (!hasMetricSelection) {
      if (!sportConfig) return [];
      return availableMetricDefinitions.filter((metric) =>
        (sportConfig.metrics || []).some((configMetric) => configMetric.key === metric.key),
      );
    }

    return Array.from(selectedMetricKeys)
      .map((key) => availableMetricByKey.get(key))
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" }));
  }, [
    availableMetricByKey,
    availableMetricDefinitions,
    hasMetricSelection,
    selectedMetricKeys,
    sportConfig,
  ]);

  const benchmarkMetrics = useMemo(() => sportConfig?.metrics || [], [sportConfig?.metrics]);

  const tacticalScores = useMemo(
    () => STANDARDIZED_TACTICAL_SCORES,
    [],
  );

  const tacticalItems = useMemo(() => {
    if (isMatchPlayImproved && improvedReport?.tactical?.length) {
      return improvedReport.tactical.map((item) => ({
        key: item.key,
        label: item.label,
        score: item.score,
        explanation: item.explanation,
      }));
    }

    const components = m?.scoreOutputs?.tactical?.components;
    if (!components) return [] as TacticalScoreDetail[];
    return tacticalScores.map((score) => {
      const raw = Number((components as Record<string, unknown>)[score.key]);
      const value = Number.isFinite(raw) ? raw : null;
      return {
        key: score.key,
        label: score.label,
        score: value,
        explanation:
          value == null
            ? "Insufficient data to score this tactical component."
            : tacticalExplanation(score.key, score.label, value),
      };
    });
  }, [improvedReport?.tactical, isMatchPlayImproved, m?.scoreOutputs?.tactical?.components, tacticalScores]);

  const technicalBiomecItems = useMemo(() => {
    if (isMatchPlayImproved && improvedReport?.biomechanics?.length) {
      return improvedReport.biomechanics.map((item) => ({
        key: item.key,
        label: item.label,
        score: item.score,
        explanation: item.explanation,
      }));
    }

    const components = m?.scoreOutputs?.technical?.components;
    if (!components) return [] as Array<{ key: string; label: string; score: number | null; explanation: string }>;

    const specs = [
      { key: "balance", label: "Balance" },
      { key: "inertia", label: "Inertia / Stance Alignment" },
      { key: "oppositeForce", label: "Opposite Force" },
      { key: "momentum", label: "Momentum" },
      { key: "elastic", label: "Elastic" },
      { key: "contact", label: "Contact" },
    ] as const;

    return specs
      .map((spec) => {
        const score = Number((components as Record<string, unknown>)[spec.key]);
        return {
          key: spec.key,
          label: spec.label,
          score: Number.isFinite(score) ? score : null,
          explanation:
            Number.isFinite(score)
              ? technicalExplanation(spec.key, spec.label, score)
              : "Insufficient data to score this technical component.",
        };
      })
            .filter((item) => !String(item.label || "").toLowerCase().includes("follow"));
  }, [improvedReport?.biomechanics, isMatchPlayImproved, m?.scoreOutputs?.technical?.components]);

  const hasMoreTechnicalItems = technicalBiomecItems.length > TECHNICAL_COMPACT_COUNT;
  const hasMoreTacticalItems = tacticalItems.length > TECHNICAL_COMPACT_COUNT;
  const movementItems = useMemo(() => {
    if (isMatchPlayImproved && improvedReport?.movement?.length) {
      return improvedReport.movement.map((item) => ({
        key: item.key,
        label: item.label,
        score: item.score,
        explanation: item.explanation,
      }));
    }

    const components = m?.scoreOutputs?.movement?.components;
    if (!components) return [] as Array<{ key: string; label: string; score: number | null; explanation: string }>;

    const specs = [
      { key: "ready", label: "Ready" },
      { key: "read", label: "Read" },
      { key: "react", label: "React" },
      { key: "respond", label: "Respond" },
      { key: "recover", label: "Recover" },
    ] as const;

    return specs.map((spec) => {
      const score = Number((components as Record<string, unknown>)[spec.key]);
      const normalized = Number.isFinite(score) ? score : null;
      return {
        key: spec.key,
        label: spec.label,
        score: normalized,
        explanation:
          normalized == null
            ? "Insufficient data to score this movement component."
            : movementExplanation(spec.key, spec.label, normalized),
      };
    });
  }, [improvedReport?.movement, isMatchPlayImproved, m?.scoreOutputs?.movement?.components]);
  const hasMoreMovementItems = movementItems.length > TECHNICAL_COMPACT_COUNT;

  const visibleTechnicalItems = useMemo(
    () => (showAllTechnical ? technicalBiomecItems : technicalBiomecItems.slice(0, TECHNICAL_COMPACT_COUNT)),
    [showAllTechnical, technicalBiomecItems],
  );
  const visibleTacticalItems = useMemo(
    () => (showAllTactical ? tacticalItems : tacticalItems.slice(0, TECHNICAL_COMPACT_COUNT)),
    [showAllTactical, tacticalItems],
  );
  const visibleMovementItems = useMemo(
    () => (showAllMovement ? movementItems : movementItems.slice(0, TECHNICAL_COMPACT_COUNT)),
    [movementItems, showAllMovement],
  );

  useEffect(() => {
    setShowAllTechnical(false);
  }, [id, technicalBiomecItems.length]);
  useEffect(() => {
    setShowAllTactical(false);
  }, [id, tacticalItems.length]);
  useEffect(() => {
    setShowAllMovement(false);
  }, [id, movementItems.length]);

  const currentTechnicalScore10 = useMemo(() => {
    if (isMatchPlayImproved) {
      return computeAverageSectionScore10(
        technicalBiomecItems.filter(
          (item): item is { key: string; label: string; score: number; explanation: string } => item.score != null,
        ),
      );
    }
    const value = Number(m?.scoreOutputs?.technical?.overall);
    return Number.isFinite(value) ? value : null;
  }, [isMatchPlayImproved, m?.scoreOutputs?.technical?.overall, technicalBiomecItems]);

  const currentMovementScore10 = useMemo(() => {
    if (isMatchPlayImproved) {
      return computeAverageSectionScore10(
        movementItems.filter(
          (item): item is { key: string; label: string; score: number; explanation: string } => item.score != null,
        ),
      );
    }
    const value = Number(m?.scoreOutputs?.movement?.overall);
    return Number.isFinite(value) ? value : null;
  }, [isMatchPlayImproved, m?.scoreOutputs?.movement?.overall, movementItems]);

  const currentTacticalScore10 = useMemo(() => {
    if (isMatchPlayImproved) {
      return computeAverageSectionScore10(
        tacticalItems.filter(
          (item): item is { key: string; label: string; score: number; explanation: string } => item.score != null,
        ),
      );
    }
    const value = Number(m?.scoreOutputs?.tactical?.overall);
    return Number.isFinite(value) ? value : null;
  }, [isMatchPlayImproved, m?.scoreOutputs?.tactical?.overall, tacticalItems]);

  const derivedOverallScore10 = useMemo(() => {
    const value = Number(m?.scoreOutputs?.overall);
    return Number.isFinite(value) ? value : null;
  }, [m?.scoreOutputs?.overall]);

  const effectiveOverallScore = useMemo(() => {
    if (isMatchPlayImproved && Number.isFinite(Number(improvedReport?.overallScore))) {
      return Math.round(Math.max(0, Math.min(100, Number(improvedReport?.overallScore))));
    }
    if (derivedOverallScore10 != null) {
      return Math.round(Math.max(0, Math.min(100, derivedOverallScore10 * 10)));
    }
    return null;
  }, [
    derivedOverallScore10,
    improvedReport?.overallScore,
    isMatchPlayImproved,
  ]);

  const displayOverallScore: number | null = effectiveOverallScore;
  const showMatchPlaySummaryCard = isMatchPlayImproved;

  const matchPlaySummaryStats = useMemo(() => {
    if (!showMatchPlaySummaryCard) {
      return [] as Array<{ key: string; label: string; value: string; rawValue: number | null }>;
    }

    const metricValues = (m?.metricValues || {}) as Record<string, unknown>;
    const readMetric = (keys: string[]): number | null => {
      for (const key of keys) {
        const value = Number(metricValues[key]);
        if (Number.isFinite(value)) return value;
      }
      return null;
    };

    const shotVariety = readMetric(["shotVariety", "shot_variety"]);
    const rallyLength = readMetric(["rallyLength", "rally_length"]);
    const courtCoverage = readMetric(["courtCoverage", "court_coverage"]);
    const recoverySpeed = readMetric(["recoverySpeed", "recovery_speed"]);

    return [
      {
        key: "shot-variety",
        label: "Shot Variety",
        value: shotVariety == null ? "--" : `${Math.round(shotVariety)}/100`,
        rawValue: shotVariety,
      },
      {
        key: "rally-length",
        label: "Rally Length",
        value: rallyLength == null ? "--" : `${rallyLength.toFixed(1)} shots`,
        rawValue: rallyLength,
      },
      {
        key: "court-coverage",
        label: "Court Coverage",
        value: courtCoverage == null ? "--" : `${Math.round(courtCoverage)}/100`,
        rawValue: courtCoverage,
      },
      {
        key: "recovery-speed",
        label: "Recovery Speed",
        value: recoverySpeed == null ? "--" : `${recoverySpeed.toFixed(1)} m/s`,
        rawValue: recoverySpeed,
      },
    ];
  }, [m?.metricValues, showMatchPlaySummaryCard]);

  const primaryMatchStroke = useMemo(() => {
    if (!improvedStrokeMixItems.length) return null;
    return improvedStrokeMixItems[0] || null;
  }, [improvedStrokeMixItems]);

  const stickyHeaderIndices = useMemo(() => {
    let performanceJumpIndex = 2;
    if (enrichmentMessage) performanceJumpIndex += 1;
    if (showMatchPlaySummaryCard) performanceJumpIndex += 1;
    return [performanceJumpIndex];
  }, [enrichmentMessage, showMatchPlaySummaryCard]);

  const previousTrendPoint = useMemo(() => {
    const points = trendData?.points || [];
    if (!points.length) return null;
    const currentIdx = points.findIndex((point) => point.analysisId === analysis?.id);
    if (currentIdx > 0) return points[currentIdx - 1] || null;
    if (currentIdx === -1 && points.length > 1) return points[points.length - 2] || null;
    return null;
  }, [analysis?.id, trendData?.points]);

  const overallDeltaPct = useMemo(() => {
    const current = displayOverallScore != null ? displayOverallScore / 10 : null;
    const previousRaw = Number(previousTrendPoint?.overallScore);
    const previous = Number.isFinite(previousRaw) ? previousRaw / 10 : null;
    return computePercentDelta(current, previous);
  }, [displayOverallScore, previousTrendPoint?.overallScore]);

  const sectionDeltaPct = useMemo(() => {
    const prevTechnicalRaw = Number(previousTrendPoint?.sectionScores?.technical);
    const prevTacticalRaw = Number(previousTrendPoint?.sectionScores?.tactical);
    const prevMovementRaw = Number(previousTrendPoint?.sectionScores?.movement);

    const prevTechnical = Number.isFinite(prevTechnicalRaw) ? prevTechnicalRaw : null;
    const prevTactical = Number.isFinite(prevTacticalRaw) ? prevTacticalRaw : null;
    const prevMovement = Number.isFinite(prevMovementRaw) ? prevMovementRaw : null;

    return {
      technical: computePercentDelta(currentTechnicalScore10, prevTechnical),
      tactical: computePercentDelta(currentTacticalScore10, prevTactical),
      movement: computePercentDelta(currentMovementScore10, prevMovement),
    };
  }, [
    currentMovementScore10,
    currentTacticalScore10,
    currentTechnicalScore10,
    previousTrendPoint?.sectionScores?.movement,
    previousTrendPoint?.sectionScores?.tactical,
    previousTrendPoint?.sectionScores?.technical,
  ]);

  const matchPlaySummaryStatsWithDelta = useMemo(() => {
    if (!showMatchPlaySummaryCard) {
      return [] as Array<{
        key: string;
        label: string;
        value: string;
        rawValue: number | null;
        deltaPct: number | null;
      }>;
    }

    const previousMetricValues = previousTrendPoint?.metricValues || {};
    const previousValueMap: Record<string, number | null> = {
      "shot-variety": Number.isFinite(Number(previousMetricValues.shotVariety))
        ? Number(previousMetricValues.shotVariety)
        : Number.isFinite(Number(previousMetricValues.shot_variety))
          ? Number(previousMetricValues.shot_variety)
          : null,
      "rally-length": Number.isFinite(Number(previousMetricValues.rallyLength))
        ? Number(previousMetricValues.rallyLength)
        : Number.isFinite(Number(previousMetricValues.rally_length))
          ? Number(previousMetricValues.rally_length)
          : null,
      "court-coverage": Number.isFinite(Number(previousMetricValues.courtCoverage))
        ? Number(previousMetricValues.courtCoverage)
        : Number.isFinite(Number(previousMetricValues.court_coverage))
          ? Number(previousMetricValues.court_coverage)
          : null,
      "recovery-speed": Number.isFinite(Number(previousMetricValues.recoverySpeed))
        ? Number(previousMetricValues.recoverySpeed)
        : Number.isFinite(Number(previousMetricValues.recovery_speed))
          ? Number(previousMetricValues.recovery_speed)
          : null,
    };

    return matchPlaySummaryStats.map((item) => ({
      ...item,
      deltaPct: computePercentDelta(item.rawValue, previousValueMap[item.key] ?? null),
    }));
  }, [matchPlaySummaryStats, previousTrendPoint?.metricValues, showMatchPlaySummaryCard]);

  const effectiveCoaching = useMemo(() => {
    if (!m) return coaching ?? null;

    type CoachingCandidate = {
      label: string;
      domain: "Tactical" | "Technical" | "Movement" | "Metric";
      score10: number;
      note: string;
    };

    const candidates: CoachingCandidate[] = [];

    for (const item of tacticalItems) {
      if (item.score == null) continue;
      candidates.push({
        label: item.label,
        domain: "Tactical",
        score10: Number(item.score),
        note: item.explanation,
      });
    }

    for (const item of technicalBiomecItems) {
      if (item.score == null) continue;
      candidates.push({
        label: item.label,
        domain: "Technical",
        score10: Number(item.score),
        note: String(item.explanation || ""),
      });
    }

    if (movementItems.length) {
      for (const item of movementItems) {
        if (item.score == null) continue;
        candidates.push({
          label: item.label,
          domain: "Movement",
          score10: Number(item.score),
          note: String(item.explanation || ""),
        });
      }
    }

    for (const metric of benchmarkMetrics) {
      const value = Number(m.metricValues?.[metric.key]);
      const health = Number.isFinite(value) ? metricHealthScore(value, metric.optimalRange) : null;
      if (health == null) continue;

      let note = "Within expected quality range.";
      if (metric.optimalRange) {
        const [min, max] = metric.optimalRange;
        if (value < min) note = "Below target range; increase this output for stronger execution.";
        else if (value > max) note = "Above target range; tighten control to stay efficient.";
      }

      candidates.push({
        label: metric.label,
        domain: "Metric",
        score10: Math.max(0, Math.min(10, health / 10)),
        note,
      });
    }

    if (!candidates.length) {
      return coaching ?? {
        keyStrength: "null",
        improvementArea: "null",
        trainingSuggestion: "null",
        simpleExplanation: "null",
      };
    }

    const strongestRaw = candidates.reduce((best, item) => (item.score10 > best.score10 ? item : best), candidates[0]);
    const weakestRaw = candidates.reduce((worst, item) => (item.score10 < worst.score10 ? item : worst), candidates[0]);

    const technicalBalanceCandidate = candidates.find((item) =>
      item.domain === "Technical" && String(item.label || "").toLowerCase().includes("balance"),
    );

    const alignBalanceToTechnical = (item: CoachingCandidate): CoachingCandidate => {
      const labelLower = String(item.label || "").toLowerCase();
      const refersToBalance = labelLower.includes("balance");
      if (!refersToBalance || item.domain === "Technical") return item;
      return technicalBalanceCandidate || item;
    };

    const strongest = alignBalanceToTechnical(strongestRaw);
    const weakest = alignBalanceToTechnical(weakestRaw);

    const practicalAction = (item: CoachingCandidate, type: "strength" | "improve"): string => {
      const label = String(item.label || "").toLowerCase();
      const domain = item.domain;

      if (label.includes("balance")) {
        return type === "strength"
          ? "Keep 10-15 reps focused on the same stable base through contact and finish."
          : "Do 3 x 8 controlled reps: split-step, load, and hold posture through contact before recovering.";
      }

      if (label.includes("react") || label.includes("read") || label.includes("recover") || label.includes("ready")) {
        return type === "strength"
          ? "Maintain with short reactive footwork sets (2 x 30 seconds) before each hitting block."
          : "Run 3 x 30-second first-step + recovery footwork sets, then re-check score in the next session.";
      }

      if (domain === "Technical") {
        return type === "strength"
          ? "Keep this mechanic in your warm-up with 2 x 10 clean, slow-to-fast reps."
          : "Use 3 x 8 slow-to-fast technical reps focused only on this mechanic before full-speed rallies.";
      }

      if (domain === "Tactical") {
        return type === "strength"
          ? "Keep using this pattern in point-play drills with clear targets."
          : "Spend one drill block on this decision pattern with target zones and scoring constraints.";
      }

      if (domain === "Movement") {
        return type === "strength"
          ? "Keep movement quality with repeatable split-step timing and immediate recovery habits."
          : "Prioritize movement-only rounds first, then transfer to live-ball reps.";
      }

      return type === "strength"
        ? "Keep this quality stable across your next hitting block."
        : "Make this the first focus block in your next session.";
    };

    const sectionsUsed: string[] = [];
  if (technicalBiomecItems.length > 0) sectionsUsed.push("technical");
  if (tacticalItems.length > 0) sectionsUsed.push("tactical");
  if (movementItems.length > 0) sectionsUsed.push("movement");
  if (benchmarkMetrics.length > 0) sectionsUsed.push("metrics");

    const formatMetricValue = (value: number) => {
      const rounded = Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(1);
    };

    const metricInsightLine = (
      matcher: (metric: (typeof benchmarkMetrics)[number]) => boolean,
      fallbackLabel: string,
    ): string | null => {
      const metric = benchmarkMetrics.find(matcher);
      if (!metric) return null;
      const rawValue = Number(m.metricValues?.[metric.key]);
      if (!Number.isFinite(rawValue)) return null;

      const health = metricHealthScore(rawValue, metric.optimalRange);
      const label = metric.label || fallbackLabel;
      const unit = String(metric.unit || "").trim();
      const valuePart = `${formatMetricValue(rawValue)}${unit ? ` ${unit}` : ""}`;

      if (!metric.optimalRange || health == null) {
        return `${label}: current ${valuePart}; keep this consistent in training reps.`;
      }

      const [min, max] = metric.optimalRange;
      const healthRounded = Math.round(health);
      if (rawValue < min) {
        return `${label}: current ${valuePart} (below target ${formatMetricValue(min)}-${formatMetricValue(max)}${unit ? ` ${unit}` : ""}); focus on increasing this output (${healthRounded}/100).`;
      }
      if (rawValue > max) {
        return `${label}: current ${valuePart} (above target ${formatMetricValue(min)}-${formatMetricValue(max)}${unit ? ` ${unit}` : ""}); focus on controlled reduction for efficiency (${healthRounded}/100).`;
      }
      return `${label}: current ${valuePart} is in target range (${healthRounded}/100); maintain under pressure.`;
    };

    const wristLine = metricInsightLine(
      (metric) => {
        const key = String(metric.key || "").toLowerCase();
        const label = String(metric.label || "").toLowerCase();
        return key.includes("wrist") || label.includes("wrist");
      },
      "Wrist Speed",
    );

    const shoulderLine = metricInsightLine(
      (metric) => {
        const key = String(metric.key || "").toLowerCase();
        const label = String(metric.label || "").toLowerCase();
        return (key.includes("shoulder") && key.includes("rotation"))
          || (label.includes("shoulder") && label.includes("rotation"));
      },
      "Shoulder Rotation",
    );

    const targetedMetricLines = [wristLine, shoulderLine].filter((line): line is string => Boolean(line));

    const trainingSuggestionBase =
      `Next block: center practice on ${weakest.label} with ${weakest.domain.toLowerCase()}-focused reps, then validate progress in Historical Performance.`;
    const trainingSuggestion = targetedMetricLines.length
      ? `${trainingSuggestionBase}\n${targetedMetricLines.map((line) => `- ${line}`).join("\n")}`
      : trainingSuggestionBase;

    return {
      keyStrength: `${strongest.label} (${formatScoreOutOfTen(strongest.score10)}/10, ${strongest.domain}) is performing well. ${strongest.note} ${practicalAction(strongest, "strength")}`,
      improvementArea: `${weakest.label} (${formatScoreOutOfTen(weakest.score10)}/10, ${weakest.domain}) is your highest-impact fix right now. ${weakest.note} ${practicalAction(weakest, "improve")}`,
      trainingSuggestion,
      simpleExplanation:
        displayOverallScore != null
          ? `Insights are based on current ${sectionsUsed.join(", ")} values shown on this screen.`
          : "null",
    };
  }, [
    benchmarkMetrics,
    coaching,
    displayOverallScore,
    movementItems,
    m?.metricValues,
    m,
    tacticalItems,
    technicalBiomecItems,
  ]);

  const videoUrl = useMemo(
    () => resolveClientMediaUrl(analysis?.videoUrl),
    [analysis?.videoUrl],
  );

  const player = useVideoPlayer(videoUrl ?? "about:blank", (p) => {
    p.loop = false;
  });

  const handleCopyVideoName = useCallback(async () => {
    const textToCopy = displayVideoName?.trim();
    if (!textToCopy) return;

    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        await Clipboard.setStringAsync(textToCopy);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Video name copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Unable to copy video name.");
    }
  }, [displayVideoName]);

  const isProcessing =
    analysis?.status === "pending" || analysis?.status === "processing";
  const shouldBackgroundOnSlow = backgroundOnSlow === "1";

  useEffect(() => {
    return () => {
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
      }
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldBackgroundOnSlow || !id || backgroundRedirectStartedRef.current) {
      return;
    }

    if (!isProcessing) {
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
      return;
    }

    if (handoffTimerRef.current) {
      return;
    }

    handoffTimerRef.current = setTimeout(async () => {
      handoffTimerRef.current = null;

      if (backgroundRedirectStartedRef.current) {
        return;
      }

      backgroundRedirectStartedRef.current = true;
      setShowBackgroundHandoffToast(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await AsyncStorage.setItem(
        BACKGROUND_NOTICE_KEY,
        "Processing is taking longer than expected. It will keep running in the background.",
      ).catch(() => {});

      redirectTimerRef.current = setTimeout(() => {
        router.replace("/(tabs)/history");
      }, BACKGROUND_REDIRECT_DELAY_MS);
    }, BACKGROUND_HANDOFF_MS);

    return () => {
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, [id, isProcessing, shouldBackgroundOnSlow]);

  const isTennisAnalysis =
    String(sportConfig?.sportName || "").trim().toLowerCase() === "tennis"
    || String(configKey || "").trim().toLowerCase().startsWith("tennis-");

  const isImprovedPending =
    analysis?.status === "completed"
    && !!m
    && isTennisAnalysis
    && !improvedReport
    && improvedLoading;

  const performanceSectionAvailability = useMemo(
    () => ({
      technical: technicalBiomecItems.length > 0 || isImprovedPending,
      tactical: Boolean(sportConfig && tacticalItems.length > 0),
      movement: movementItems.length > 0 || isImprovedPending,
    }),
    [isImprovedPending, movementItems.length, sportConfig, tacticalItems.length, technicalBiomecItems.length],
  );

  const registerSectionOffset = useCallback((section: PerformanceSectionKey, y: number) => {
    setSectionOffsets((prev) => {
      if (prev[section] === y) return prev;
      return { ...prev, [section]: y };
    });
  }, []);

  const scrollToPerformanceSection = useCallback((section: PerformanceSectionKey) => {
    const targetOffset = sectionOffsets[section];
    if (typeof targetOffset !== "number") return;

    setActivePerformanceSection(section);
    scrollRef.current?.scrollTo({
      y: Math.max(0, targetOffset - 88),
      animated: true,
    });
  }, [sectionOffsets]);

  const handlePerformanceScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + 96;
    const availableSections = PERFORMANCE_SECTION_ORDER.filter(
      (section) => performanceSectionAvailability[section] && typeof sectionOffsets[section] === "number",
    );

    if (!availableSections.length) return;

    let focusedSection = availableSections[0];
    for (const section of availableSections) {
      const offset = sectionOffsets[section];
      if (typeof offset === "number" && y >= offset - 4) {
        focusedSection = section;
      }
    }

    if (focusedSection !== activePerformanceSection) {
      setActivePerformanceSection(focusedSection);
    }
  }, [activePerformanceSection, performanceSectionAvailability, sectionOffsets]);

  useEffect(() => {
    const firstAvailable = PERFORMANCE_SECTION_ORDER.find((section) => performanceSectionAvailability[section]);
    if (!firstAvailable) return;
    if (!performanceSectionAvailability[activePerformanceSection]) {
      setActivePerformanceSection(firstAvailable);
    }
  }, [activePerformanceSection, performanceSectionAvailability]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient
          colors={["#000000", "#1C1C1E", "#000000"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient
          colors={["#000000", "#1C1C1E", "#000000"]}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="alert-circle-outline" size={48} color="#FF453A" />
        <Text style={[styles.errorText, { color: "#FFFFFF" }]}>
          Analysis not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: "#0A84FF" }]}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const movementLabel =
    analysis.detectedMovement || sportConfig?.movementName || "Movement";

  const sportThemeColor =
    (sportConfig?.sportName && sportColors[sportConfig.sportName]?.primary) ||
    "#A29BFE";

  const selectedMovement = data?.selectedMovementName;
  const detectedMovement = analysis.detectedMovement;
  const requestedSessionLabel = formatRequestedSessionTypeLabel(analysis.requestedSessionType);
  const requestedFocusLabel = formatRequestedFocusLabel(
    analysis.requestedFocusKey,
    analysis.requestedSessionType,
  );
  const displayMovementLabel =
    (detectedMovement || sportConfig?.movementName || "").charAt(0).toUpperCase()
    + (detectedMovement || sportConfig?.movementName || "").slice(1).replace(/-/g, " ");
  const showRequestedFocusBadge = Boolean(
    requestedFocusLabel
    && normalizeSelection(requestedFocusLabel).replace(/[-\s]+/g, "")
      !== normalizeSelection(displayMovementLabel).replace(/[-\s]+/g, ""),
  );
  const profileTimeZone = resolveUserTimeZone(user);
  const filenamePlayerName = derivePlayerNameFromVideoName(displayVideoName);
  const headerPlayerNameResolved =
    String(analysis.userName || "").trim()
    || String(user?.name || "").trim()
    || filenamePlayerName
    || "Player";
  const headerDateTime = formatHeaderDateTime(
    analysis.capturedAt || analysis.createdAt,
    profileTimeZone,
  );
  const topHeaderTitle = `${headerPlayerNameResolved} • Session ${headerDateTime}`;
  const handleRetryAnalysis = () => {
    if (retryMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Retry Analysis", `Retry processing for "${analysis.videoFilename}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Retry",
        onPress: () => retryMutation.mutate(analysis.id),
      },
    ]);
  };
  const wasOverridden =
    selectedMovement &&
    detectedMovement &&
    selectedMovement.toLowerCase().replace(/\s+/g, "-") !==
      detectedMovement.toLowerCase().replace(/\s+/g, "-");

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#000000", "#1C1C1E", "#000000"]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 8 + webTopInset },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [
            styles.navButton,
            { backgroundColor: "#1C1C1E", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={handleCopyVideoName}
          style={({ pressed }) => [
            styles.topTitlePressable,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text
            style={[styles.topTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {topHeaderTitle}
          </Text>
        </Pressable>
        <View style={styles.navButton} />
      </View>

      {isProcessing ? (
        <View style={[styles.container, styles.center]}>
          <View style={styles.processingCard}>
            <View style={styles.processingCardHeader}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPipelineTimingModalVisible(true);
                }}
                style={({ pressed }) => [
                  styles.processingInfoButton,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Ionicons name="information-circle-outline" size={18} color="#AEAEB2" />
              </Pressable>
            </View>
            <ActivityIndicator size="large" color={sportThemeColor} />
            <Text style={styles.processingTitle}>
              Analyzing Your {movementLabel}
            </Text>
            <Text style={styles.processingSubtitle}>
              Processing video with pose detection, ball tracking, and motion
              analysis...
            </Text>
            <View style={styles.processingSteps}>
              {[
                "Extracting video frames",
                "Detecting body pose",
                "Tracking ball trajectory",
                "Computing technical (Biomec)",
                "Generating insights",
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Ionicons
                    name={
                      analysis.status === "processing" && i < 3
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={16}
                    color={
                      analysis.status === "processing" && i < 3
                        ? sportThemeColor
                        : "#48484A"
                    }
                  />
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color:
                          analysis.status === "processing" && i < 3
                            ? colors.text
                            : "#48484A",
                      },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {showBackgroundHandoffToast ? (
            <View style={styles.processingToast}>
              <Ionicons name="time-outline" size={16} color="#DBEAFE" />
              <Text style={styles.processingToastText}>
                Processing is taking longer than expected. It will continue in background.
              </Text>
            </View>
          ) : null}
          <Modal
            visible={pipelineTimingModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setPipelineTimingModalVisible(false)}
          >
            <View style={styles.pipelineModalBackdrop}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setPipelineTimingModalVisible(false)}
              />
              <View style={styles.pipelineModalCard}>
                <View style={styles.pipelineModalHeader}>
                  <View style={styles.pipelineModalTitleWrap}>
                    <Text style={styles.pipelineModalTitle}>Pipeline Timing</Text>
                    <Text style={styles.pipelineModalSubtitle}>Live processing stages for this analysis</Text>
                  </View>
                  <Pressable
                    onPress={() => setPipelineTimingModalVisible(false)}
                    style={({ pressed }) => [styles.pipelineModalCloseButton, { opacity: pressed ? 0.75 : 1 }]}
                  >
                    <Ionicons name="close" size={18} color="#C7C7CC" />
                  </Pressable>
                </View>
                <PipelineTimingPanel
                  timing={pipelineTiming}
                  compact
                  emptyText="Pipeline timing will appear as soon as processing stages start reporting."
                />
              </View>
            </View>
          </Modal>
        </View>
      ) : analysis.status === "rejected" ? (
        <View style={styles.rejectedStateWrap}>
          <View style={styles.rejectedIconWrap}>
            <Ionicons name="close-circle" size={52} color="#EF4444" />
          </View>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Video Rejected
          </Text>
          <Text style={[styles.rejectionReason, { color: "#8E8E93" }]}>
            This video could not be validated for tennis analysis. Please upload a clear tennis video and try again.
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/upload")}
            style={({ pressed }) => [
              styles.tryAgainButton,
              styles.rejectedTryAgainButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.tryAgainText}>Try Again</Text>
          </Pressable>
        </View>
      ) : analysis.status === "failed" && !m ? (
        <View style={[styles.container, styles.center]}>
          <Ionicons name="alert-circle" size={48} color={colors.red} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Analysis failed
          </Text>
          <Text style={[styles.errorSub, { color: "#8E8E93" }]}>
            {analysis.rejectionReason || "Please try uploading the video again"}
          </Text>
          <Pressable
            onPress={handleRetryAnalysis}
            disabled={retryMutation.isPending}
            style={({ pressed }) => [
              styles.tryAgainButton,
              { backgroundColor: sportThemeColor },
              retryMutation.isPending && styles.tryAgainButtonDisabled,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {retryMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="refresh" size={18} color="#FFF" />
            )}
            <Text style={styles.tryAgainText}>{retryMutation.isPending ? "Retrying..." : "Retry Processing"}</Text>
          </Pressable>
        </View>
      ) : m ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 34 },
          ]}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyHeaderIndices}
          onScroll={handlePerformanceScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.topMetaRow}>
            <View style={styles.aiEntryColumn}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/analysis/[id]/diagnostics", params: { id: analysis.id } });
                }}
                style={({ pressed }) => [
                  styles.diagnosticsEntryButton,
                  {
                    borderColor: `${sportThemeColor}40`,
                    backgroundColor: `${sportThemeColor}12`,
                  },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="sparkles-outline" size={14} color={sportThemeColor} />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.diagnosticsEntryButtonText, { color: sportThemeColor }]}
                >
                  AI-Powered Analysis
                </Text>
              </Pressable>
            </View>
            <View style={styles.badgesGroup}>
              {requestedSessionLabel ? (
                <View style={styles.requestedSessionBadge}>
                  <Ionicons name="albums-outline" size={12} color="#64D2FF" />
                  <Text style={styles.requestedSessionBadgeText}>{requestedSessionLabel}</Text>
                </View>
              ) : null}
              {showRequestedFocusBadge ? (
                <View style={styles.requestedFocusBadge}>
                  <Ionicons name="locate-outline" size={12} color="#C4B5FD" />
                  <Text style={styles.requestedFocusBadgeText}>{requestedFocusLabel}</Text>
                </View>
              ) : null}
              {(detectedMovement || sportConfig?.movementName) && (
                <View style={styles.categoryBadge}>
                  <Ionicons name="flash-outline" size={12} color="#30D158" />
                  <Text style={styles.categoryBadgeText}>
                    {displayMovementLabel}
                  </Text>
                </View>
              )}
              {data?.metrics?.metricValues?.shotCount != null && data.metrics.metricValues.shotCount > 1 && (
                <View
                  style={[
                    styles.shotCountBadge,
                    {
                      backgroundColor: `${sportThemeColor}12`,
                      borderColor: `${sportThemeColor}30`,
                    },
                  ]}
                >
                  <Ionicons name="videocam-outline" size={12} color={sportThemeColor} />
                  <Text
                    numberOfLines={1}
                    style={[styles.shotCountBadgeText, { color: sportThemeColor }]}
                  >
                    {data.metrics.metricValues.shotCount} shots
                  </Text>
                </View>
              )}
            </View>
          </View>

          {enrichmentMessage ? (
            <View style={styles.enrichmentNotice}>
              <ActivityIndicator size="small" color="#64D2FF" />
              <Text style={styles.enrichmentNoticeText}>{enrichmentMessage}</Text>
            </View>
          ) : null}

          <View style={styles.scoreStickyWrap}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/analysis/[id]/trends",
                  params: {
                    id: analysis.id,
                    focusSection: "overall",
                  },
                });
              }}
              style={({ pressed }) => [styles.scoreSection, { opacity: pressed ? 0.9 : 1 }]}
            >
              {displayOverallScore != null ? (
                <>
                  <ScoreGauge
                    score={displayOverallScore / 10}
                    maxScore={10}
                    size={160}
                    label="Score"
                  />
                  {overallDeltaPct != null ? (
                    <View style={styles.overallDeltaWrap}>
                      <Ionicons
                        name={deltaTrendIcon(overallDeltaPct)}
                        size={13}
                        color={deltaColor(overallDeltaPct)}
                      />
                      <Text style={[styles.overallDeltaText, { color: deltaColor(overallDeltaPct) }]}> 
                        {formatDeltaPercent(overallDeltaPct)}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.scoreUnavailableWrap}>
                  <Text style={styles.scoreUnavailableValue}>N/A</Text>
                  <Text style={styles.scoreFilteredHint}>Insufficient score data</Text>
                </View>
              )}
            </Pressable>
          </View>

          {showMatchPlaySummaryCard ? (
            <View style={styles.matchPlaySummaryCard}>
              <View style={styles.matchPlaySummaryHeader}>
                <View>
                  <Text style={styles.matchPlaySummaryEyebrow}>Match Play Summary</Text>
                  <Text style={styles.matchPlaySummaryTitle}>Live-play snapshot for this session</Text>
                </View>
                {primaryMatchStroke ? (
                  <View style={styles.matchPlayPrimaryStrokeBadge}>
                    <View
                      style={[
                        styles.matchPlayPrimaryStrokeDot,
                        { backgroundColor: strokeMixColor(primaryMatchStroke.stroke) },
                      ]}
                    />
                    <Text style={styles.matchPlayPrimaryStrokeText}>
                      Primary: {primaryMatchStroke.stroke.charAt(0).toUpperCase() + primaryMatchStroke.stroke.slice(1)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.matchPlaySummaryGrid}>
                {matchPlaySummaryStatsWithDelta.map((item) => (
                  <View key={item.key} style={styles.matchPlaySummaryStatCard}>
                    <Text style={styles.matchPlaySummaryStatLabel}>{item.label}</Text>
                    <Text style={styles.matchPlaySummaryStatValue}>{item.value}</Text>
                    {item.deltaPct != null ? (
                      <View style={styles.matchPlaySummaryDeltaWrap}>
                        <Ionicons
                          name={deltaTrendIcon(item.deltaPct)}
                          size={11}
                          color={deltaColor(item.deltaPct)}
                        />
                        <Text
                          style={[
                            styles.matchPlaySummaryDeltaText,
                            { color: deltaColor(item.deltaPct) },
                          ]}
                        >
                          {formatDeltaPercent(item.deltaPct)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.performanceJumpStickyWrap}>
            <View style={styles.performanceJumpRow}>
              {PERFORMANCE_SECTION_ORDER.map((section) => {
                const isActive = section === activePerformanceSection;
                const isEnabled = performanceSectionAvailability[section];
                const label = section.charAt(0).toUpperCase() + section.slice(1);

                return (
                  <Pressable
                    key={section}
                    disabled={!isEnabled}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      scrollToPerformanceSection(section);
                    }}
                    style={({ pressed }) => [
                      styles.performanceJumpPill,
                      isActive && styles.performanceJumpPillActive,
                      !isEnabled && styles.performanceJumpPillDisabled,
                      { opacity: pressed && isEnabled ? 0.82 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.performanceJumpText,
                        isActive && styles.performanceJumpTextActive,
                        !isEnabled && styles.performanceJumpTextDisabled,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {wasOverridden && (
            <View style={styles.overrideBanner}>
              <Ionicons name="information-circle" size={18} color="#0A84FF" />
              <Text style={styles.overrideBannerText}>
                We detected this as a{" "}
                <Text style={styles.overrideHighlight}>
                  {detectedMovement!.charAt(0).toUpperCase() +
                    detectedMovement!.slice(1).replace(/-/g, " ")}
                </Text>{" "}
                — results adjusted accordingly
              </Text>
            </View>
          )}

          {technicalBiomecItems.length > 0 || isImprovedPending ? (
            <View
              style={styles.technicalSectionWrap}
              onLayout={(event) => registerSectionOffset("technical", event.nativeEvent.layout.y)}
            >
              <View style={styles.sectionScoreHeader}>
                <Text style={styles.sectionTitle}>{isMatchPlayImproved ? "Technical" : "Technical (Biomec)"}</Text>
                {currentTechnicalScore10 != null ? (
                  <View style={[styles.sectionScoreBadge, styles.sectionScoreBadgeTechnical]}>
                    {sectionDeltaPct.technical != null ? (
                      <View style={styles.sectionDeltaWrap}>
                        <Ionicons
                          name={deltaTrendIcon(sectionDeltaPct.technical)}
                          size={11}
                          color={deltaColor(sectionDeltaPct.technical)}
                        />
                        <Text style={[styles.sectionDeltaText, { color: deltaColor(sectionDeltaPct.technical) }]}>
                          {formatDeltaPercent(sectionDeltaPct.technical)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.sectionScoreText, { color: scoreColor(currentTechnicalScore10) }]}>
                      {formatScoreOutOfTen(currentTechnicalScore10)}/10
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.sectionCompactTechnical}>
              {technicalBiomecItems.length > 0 ? (
                <View style={styles.tenGroup}>
                  {visibleTechnicalItems.map((item) => (
                    <TenPointBar key={`bio-${item.key}`} item={item} compact />
                  ))}

                  {hasMoreTechnicalItems ? (
                    <Pressable
                      onPress={() => setShowAllTechnical((prev) => !prev)}
                      style={({ pressed }) => [styles.inlineMoreButton, { opacity: pressed ? 0.75 : 1 }]}
                    >
                      <Text style={styles.inlineMoreButtonText}>
                        {showAllTechnical
                          ? "less"
                          : `${technicalBiomecItems.length - visibleTechnicalItems.length} more..`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={styles.inlineSectionLoading}>
                  <ActivityIndicator size="small" color={sportThemeColor} />
                  <Text style={styles.inlineSectionLoadingText}>Loading technical insights...</Text>
                </View>
              )}
              </View>
            </View>
          ) : null}

          {sportConfig && tacticalItems.length > 0 && (
            <View
              style={styles.technicalSectionWrap}
              onLayout={(event) => registerSectionOffset("tactical", event.nativeEvent.layout.y)}
            >
              <View style={styles.sectionScoreHeader}>
                <Text style={styles.sectionTitle}>Tactical</Text>
                {currentTacticalScore10 != null ? (
                  <View style={styles.sectionScoreBadge}>
                    {sectionDeltaPct.tactical != null ? (
                      <View style={styles.sectionDeltaWrap}>
                        <Ionicons
                          name={deltaTrendIcon(sectionDeltaPct.tactical)}
                          size={11}
                          color={deltaColor(sectionDeltaPct.tactical)}
                        />
                        <Text style={[styles.sectionDeltaText, { color: deltaColor(sectionDeltaPct.tactical) }]}>
                          {formatDeltaPercent(sectionDeltaPct.tactical)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.sectionScoreText, { color: scoreColor(currentTacticalScore10) }]}>
                      {formatScoreOutOfTen(currentTacticalScore10)}/10
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.sectionCompactTechnical}>
                <View style={styles.tenGroup}>
                  {visibleTacticalItems.map((item) => (
                    <TacticalBar key={`tac-${item.key}`} item={item} compact />
                  ))}

                  {hasMoreTacticalItems ? (
                    <Pressable
                      onPress={() => setShowAllTactical((prev) => !prev)}
                      style={({ pressed }) => [styles.inlineMoreButton, { opacity: pressed ? 0.75 : 1 }]}
                    >
                      <Text style={styles.inlineMoreButtonText}>
                        {showAllTactical
                          ? "less"
                          : `${tacticalItems.length - visibleTacticalItems.length} more..`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {(movementItems.length || 0) > 0 || isImprovedPending ? (
            <View
              style={styles.technicalSectionWrap}
              onLayout={(event) => registerSectionOffset("movement", event.nativeEvent.layout.y)}
            >
              <View style={styles.sectionScoreHeader}>
                <Text style={styles.sectionTitle}>Movement</Text>
                {currentMovementScore10 != null ? (
                  <View style={styles.sectionScoreBadge}>
                    {sectionDeltaPct.movement != null ? (
                      <View style={styles.sectionDeltaWrap}>
                        <Ionicons
                          name={deltaTrendIcon(sectionDeltaPct.movement)}
                          size={11}
                          color={deltaColor(sectionDeltaPct.movement)}
                        />
                        <Text style={[styles.sectionDeltaText, { color: deltaColor(sectionDeltaPct.movement) }]}>
                          {formatDeltaPercent(sectionDeltaPct.movement)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.sectionScoreText, { color: scoreColor(currentMovementScore10) }]}>
                      {formatScoreOutOfTen(currentMovementScore10)}/10
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.sectionCompactTechnical}>
                {movementItems.length ? (
                  <View style={styles.tenGroup}>
                    {visibleMovementItems.map((item) => (
                      <TenPointBar key={`move-${item.key}`} item={item} compact />
                    ))}

                    {hasMoreMovementItems ? (
                      <Pressable
                        onPress={() => setShowAllMovement((prev) => !prev)}
                        style={({ pressed }) => [styles.inlineMoreButton, { opacity: pressed ? 0.75 : 1 }]}
                      >
                        <Text style={styles.inlineMoreButtonText}>
                          {showAllMovement
                            ? "less"
                            : `${movementItems.length - visibleMovementItems.length} more..`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.inlineSectionLoading}>
                    <ActivityIndicator size="small" color={sportThemeColor} />
                    <Text style={styles.inlineSectionLoadingText}>Loading movement insights...</Text>
                  </View>
                )}
                </View>
            </View>
          ) : null}

          {isMatchPlayImproved && improvedStrokeMixItems.length > 0 ? (
            <View style={styles.sectionCompact}>
              <Text style={styles.sectionTitle}>Stroke Mix</Text>
              <View style={styles.strokeMixList}>
                {improvedStrokeMixItems.map((item) => (
                  <View key={item.stroke} style={styles.strokeMixRow}>
                    <View style={styles.strokeMixHeader}>
                      <View style={styles.strokeMixTitleRow}>
                        <View
                          style={[
                            styles.strokeMixDot,
                            { backgroundColor: strokeMixColor(item.stroke) },
                          ]}
                        />
                        <Text style={styles.strokeMixLabel}>
                          {item.stroke.charAt(0).toUpperCase() + item.stroke.slice(1)}
                        </Text>
                      </View>
                      <Text style={styles.strokeMixMeta}>{item.count} shots</Text>
                    </View>
                    <View style={styles.strokeMixTrack}>
                      <View
                        style={[
                          styles.strokeMixFill,
                          {
                            width: `${Math.max(6, Math.min(100, item.sharePct))}%`,
                            backgroundColor: strokeMixColor(item.stroke),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.strokeMixPercent}>{item.sharePct.toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {videoUrl && (
            <View style={styles.videoSection}>
              <View style={styles.videoHeader}>
                <Text style={styles.sectionTitle}>Video</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFullscreen(true);
                  }}
                  style={({ pressed }) => [
                    styles.fullscreenButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="expand-outline" size={18} color="#8E8E93" />
                </Pressable>
              </View>
              <View style={styles.videoContainer}>
                <VideoView
                  player={player}
                  style={styles.videoPlayer}
                  contentFit="contain"
                  nativeControls
                />
                {analysis.status === "completed" && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: "/analysis/[id]/manual-annotation",
                        params: { id: analysis.id },
                      });
                    }}
                    style={({ pressed }) => [
                      styles.manualAnnotationFloatingButton,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={manualAnnotationDone ? "#30D158" : "#8E8E93"}
                    />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {m.metricValues && displayedMetrics.length > 0 ? (
            <View style={styles.metricsSection}>
              <Text style={styles.sectionTitle}>Metrics</Text>
              <View style={styles.metricsGrid}>
                {displayedMetrics.map((metric) => (
                  <View key={metric.key} style={styles.metricCardWrapper}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({
                          pathname: "/analysis/[id]/trends",
                          params: { id: analysis.id, focusMetric: metric.key },
                        });
                      }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}
                    >
                      {(() => {
                        const rawMetricValueNumber = Number(m.metricValues[metric.key]);
                        const hasMetricValue = Number.isFinite(rawMetricValueNumber);
                        const metricUsesMph = isMphUnit(metric.unit);
                        const isScale10Metric = METRICS_SCALE10_KEYS.has(metric.key);
                        const normalizedMetricValue =
                          hasMetricValue
                            ? normalizeMetricDisplayScale(metric.key, rawMetricValueNumber)
                            : null;

                        const displayMetricValue =
                          hasMetricValue
                            ? (
                              metricUsesMph
                                ? toDisplaySpeed(normalizedMetricValue as number)
                                : normalizedMetricValue
                            )
                            : null;
                        const metricValuePrecision = 1;
                        const displayOptimalRange =
                          metricUsesMph && metric.optimalRange
                            ? [
                                toDisplaySpeed(metric.optimalRange[0]),
                                toDisplaySpeed(metric.optimalRange[1]),
                              ] as [number, number]
                            : isScale10Metric && metric.optimalRange
                              ? [
                                  metric.optimalRange[0] > 10 ? metric.optimalRange[0] / 10 : metric.optimalRange[0],
                                  metric.optimalRange[1] > 10 ? metric.optimalRange[1] / 10 : metric.optimalRange[1],
                                ] as [number, number]
                            : metric.optimalRange;

                        const previousRaw = Number(previousTrendPoint?.metricValues?.[metric.key]);
                        const previousNormalized = Number.isFinite(previousRaw)
                          ? normalizeMetricDisplayScale(metric.key, previousRaw)
                          : null;
                        const previousDisplayValue =
                          previousNormalized == null
                            ? null
                            : metricUsesMph
                              ? toDisplaySpeed(previousNormalized)
                              : previousNormalized;
                        const metricDeltaPct = computePercentDelta(
                          displayMetricValue == null ? null : Number(displayMetricValue),
                          previousDisplayValue,
                        );

                        return (
                      <MetricCard
                        icon={metric.icon as any}
                        label={metric.label}
                        value={displayMetricValue == null ? "-" : displayMetricValue}
                        valuePrecision={metricValuePrecision}
                        unit={metricUsesMph ? "kmph" : isScale10Metric ? "/10" : metric.unit}
                        color={metric.color}
                        optimalRange={displayOptimalRange}
                        change={metricDeltaPct}
                      />
                        );
                      })()}
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {ghostCorrection && ghostPlayerFrames.length > 0 ? (
            <SwingAnimationTabs
              playerFrames={ghostPlayerFrames}
              correction={ghostCorrection}
              corrections={ghostCorrections}
              accentColor={sportThemeColor}
            />
          ) : isGhostAnimationLoading ? (
            <GlassCard style={styles.ghostLoadingCard}>
              <View style={styles.ghostLoadingContent}>
                <ActivityIndicator size="small" color={sportThemeColor} />
                <View style={styles.ghostLoadingTextWrap}>
                  <Text style={styles.ghostLoadingTitle}>Loading swing animation</Text>
                  <Text style={styles.ghostLoadingSubtitle}>
                    Fetching skeleton frames for the Performance Metrics view.
                  </Text>
                </View>
              </View>
            </GlassCard>
          ) : null}

          {effectiveCoaching && (
            <View style={styles.coachingSection}>
              <Text style={styles.sectionTitle}>Insights</Text>
              <CoachingCard
                icon="trophy"
                title="Key Strength"
                content={effectiveCoaching.keyStrength}
                color="#30D158"
              />
              <CoachingCard
                icon="warning"
                title="Improvement Area"
                content={effectiveCoaching.improvementArea}
                color="#FFD60A"
              />
              <CoachingCard
                icon="bulb"
                title="Training Suggestion"
                content={effectiveCoaching.trainingSuggestion}
                color="#0A84FF"
              />
            </View>
          )}

        </ScrollView>
      ) : null}

      {analysis.status === "completed" && (
        <View style={[styles.bottomFeedbackBar, { bottom: insets.bottom + 12 }]}>
          <View style={styles.compactThumbsRow}>
            <Pressable
              onPress={() => handleThumbSelection("up")}
              style={({ pressed }) => [
                styles.compactThumbButton,
                (pendingRating === "up" || (!pendingRating && feedback?.rating === "up")) && styles.thumbButtonActiveUp,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={(pendingRating === "up" || (!pendingRating && feedback?.rating === "up")) ? "thumbs-up" : "thumbs-up-outline"}
                size={16}
                color={(pendingRating === "up" || (!pendingRating && feedback?.rating === "up")) ? "#30D158" : "#636366"}
              />
            </Pressable>
            <Pressable
              onPress={() => handleThumbSelection("down")}
              style={({ pressed }) => [
                styles.compactThumbButton,
                (pendingRating === "down" || (!pendingRating && feedback?.rating === "down")) && styles.thumbButtonActiveDown,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={(pendingRating === "down" || (!pendingRating && feedback?.rating === "down")) ? "thumbs-down" : "thumbs-down-outline"}
                size={16}
                color={(pendingRating === "down" || (!pendingRating && feedback?.rating === "down")) ? "#FF453A" : "#636366"}
              />
            </Pressable>
          </View>
        </View>
      )}

      {manualSavedVisible && (
        <View
          pointerEvents="none"
          style={[styles.savedBreadcrumbContainer, { bottom: insets.bottom + 84 }]}
        >
          <View style={styles.savedBreadcrumb}>
            <Ionicons
              name={manualSaveMessage === "Saving..." ? "time-outline" : manualSaveMessage === "Save Failed" ? "close-circle" : "checkmark-circle"}
              size={14}
              color={manualSaveMessage === "Saving..." ? "#8E8E93" : manualSaveMessage === "Save Failed" ? "#FF453A" : "#30D158"}
            />
            <Text style={styles.savedBreadcrumbText}>{manualSaveMessage}</Text>
          </View>
        </View>
      )}

      <Modal
        visible={feedbackSheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeFeedbackSheet}
      >
        <View style={styles.feedbackOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFeedbackSheet} />
          <KeyboardAvoidingView
            style={styles.feedbackKeyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
          >
            <View
              style={[
                styles.feedbackSheet,
                {
                  paddingBottom: Math.max(insets.bottom + 52, 60),
                },
              ]}
            >
              <View style={styles.feedbackSheetContent}>
                <View style={styles.feedbackSheetHandle} />
                <Text style={styles.feedbackSheetTitle}>Help us improve AI-Powered Analysis</Text>
                <Text style={styles.feedbackSheetSubtitle}>
                  Share any discrepancy you notice in AI-Powered Analysis or metrics.
                </Text>

                <Text style={styles.feedbackGroupTitle}>What felt off?</Text>
                <View style={styles.feedbackChipWrap}>
                  {FEEDBACK_DISCREPANCY_TAGS.map((tag) => {
                    const selected = selectedDiscrepancies.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => toggleDiscrepancy(tag)}
                        style={({ pressed }) => [
                          styles.feedbackChip,
                          selected && {
                            borderColor: sportThemeColor,
                            backgroundColor: `${sportThemeColor}20`,
                          },
                          { opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <Text style={[styles.feedbackChipText, selected && styles.feedbackChipTextActive]}>{tag}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.feedbackGroupTitle}>Tell us the discrepancy</Text>
                <TextInput
                  style={styles.feedbackSheetInput}
                  placeholder="Ex: Backhand was detected but this was a forehand; contact timing score looks low compared to video."
                  placeholderTextColor="#636366"
                  value={discrepancyText}
                  onChangeText={setDiscrepancyText}
                  multiline
                  maxLength={700}
                />

                <View style={styles.feedbackSheetActions}>
                  <Pressable
                    onPress={closeFeedbackSheet}
                    style={({ pressed }) => [styles.feedbackSheetGhostButton, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={styles.feedbackSheetGhostText}>Not now</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmitFeedbackSheet}
                    style={({ pressed }) => [
                      styles.feedbackSheetSubmit,
                      !feedbackMutation.isPending && pendingRating && { backgroundColor: sportThemeColor },
                      feedbackMutation.isPending && styles.feedbackSheetSubmitDisabled,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                    disabled={feedbackMutation.isPending || !pendingRating}
                  >
                    <Text style={styles.feedbackSheetSubmitText}>
                      {feedbackMutation.isPending ? "Submitting..." : "Submit"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {fullscreen && videoUrl && (
        <Modal
          animationType="none"
          transparent={false}
          visible={fullscreen}
          onRequestClose={() => setFullscreen(false)}
        >
          <View style={styles.fullscreenContainer}>
            <VideoView
              player={player}
              style={styles.fullscreenVideo}
              contentFit="contain"
              nativeControls
            />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFullscreen(false);
              }}
              style={[styles.closeFullscreen, { top: insets.top + 12 }]}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const METRIC_CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  topTitlePressable: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 28,
    position: "relative",
  },
  diagnosticsBackdropGlass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 10, 26, 0.32)",
    zIndex: 1,
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  aiEntryColumn: {
    gap: 8,
    alignItems: "flex-start",
  },
  badgesGroup: {
    flexDirection: "row",
    gap: 6,
    marginLeft: "auto",
    marginRight: 8,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  scoreStickyWrap: {
    paddingBottom: 6,
    backgroundColor: "transparent",
  },
  scoreUnavailableWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    gap: 4,
  },
  scoreUnavailableValue: {
    fontSize: 34,
    fontWeight: "700",
    color: "#8E8E93",
  },
  scoreFilteredHint: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
    textAlign: "center",
  },
  diagnosticsIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
  },
  diagnosticsEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  diagnosticsEntryButtonText: {
    fontSize: 10,
    fontWeight: "600",
  },
  diagnosticsBody: {
    borderWidth: 1,
    borderColor: "#54545840",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#1C1C1E",
    gap: 12,
  },
  diagnosticsBodyActive: {
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  diagHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#54545835",
  },
  diagHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  diagHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diagHeaderTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AEAEB2",
    letterSpacing: 0.3,
  },
  diagHeaderHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
  },
  diagnosticsGrid: {
    gap: 8,
  },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#00000090",
    borderWidth: 1,
    borderColor: "#54545835",
  },
  diagLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  diagValueText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  diagSubTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#AEAEB2",
    letterSpacing: 0.3,
    marginTop: 6,
    textTransform: "uppercase",
  },
  diagRowStacked: {
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#00000090",
    borderWidth: 1,
    borderColor: "#54545835",
  },
  techHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  diagBlockCard: {
    gap: 8,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#54545835",
    backgroundColor: "#00000070",
  },
  diagBlockTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AEAEB2",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  diagItem: {
    fontSize: 12,
    color: "#8E8E93",
    lineHeight: 18,
  },
  diagParagraph: {
    fontSize: 12,
    color: "#8E8E93",
    lineHeight: 18,
  },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#0A84FF12",
    borderWidth: 1,
    borderColor: "#0A84FF30",
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  requestedSessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#64D2FF12",
    borderWidth: 1,
    borderColor: "#64D2FF30",
  },
  requestedSessionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64D2FF",
  },
  requestedFocusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#C4B5FD12",
    borderWidth: 1,
    borderColor: "#C4B5FD30",
  },
  requestedFocusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#C4B5FD",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#30D15812",
    borderWidth: 1,
    borderColor: "#30D15830",
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#30D158",
  },
  shotCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#0A84FF12",
    borderWidth: 1,
    borderColor: "#0A84FF30",
  },
  shotCountBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 0,
  },
  shotSpeedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FF9F0A12",
    borderWidth: 1,
    borderColor: "#FF9F0A30",
  },
  shotSpeedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF9F0A",
  },
  compactThumbsRow: {
    flexDirection: "row",
    gap: 0,
  },
  bottomFeedbackBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "flex-end",
    paddingHorizontal: 20,
    zIndex: 20,
  },
  compactThumbButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  overrideBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#0A84FF10",
    borderWidth: 1,
    borderColor: "#0A84FF25",
  },
  overrideBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#8E8E93",
  },
  overrideHighlight: {
    fontWeight: "600",
    color: "#0A84FF",
  },
  videoSection: {
    gap: 10,
  },
  manualAnnotationFloatingButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#48484A66",
    backgroundColor: "rgba(16, 16, 37, 0.78)",
    zIndex: 3,
  },
  videoInfoFloatingButton: {
    position: "absolute",
    top: 50,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#48484A66",
    backgroundColor: "rgba(16, 16, 37, 0.78)",
    zIndex: 3,
  },
  videoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullscreenButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#54545860",
    alignItems: "center",
    justifyContent: "center",
  },
  videoContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#54545840",
  },
  videoPlayer: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenVideo: {
    width: "100%",
    height: "100%",
  },
  closeFullscreen: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    padding: 22,
    gap: 18,
  },
  sectionCompact: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#13132A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  technicalSectionWrap: {
    gap: 8,
  },
  performanceJumpStickyWrap: {
    marginTop: 6,
    marginBottom: 4,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    paddingVertical: 6,
    backgroundColor: "#1C1C1EDB",
  },
  performanceJumpRow: {
    flexDirection: "row",
    gap: 8,
  },
  performanceJumpPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155AA",
    backgroundColor: "#101828",
  },
  performanceJumpPillActive: {
    borderColor: "#0A84FF",
    backgroundColor: "#1E3A8A66",
  },
  performanceJumpPillDisabled: {
    borderColor: "#1F293780",
    backgroundColor: "#0B122080",
  },
  performanceJumpText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#AEAEB2",
  },
  performanceJumpTextActive: {
    color: "#E0F2FE",
  },
  performanceJumpTextDisabled: {
    color: "#636366",
  },
  sectionCompactTechnical: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545850",
    backgroundColor: "#13132A",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sectionScoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionScoreBadge: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    position: "relative",
    minWidth: 104,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#00000090",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  sectionScoreBadgeTechnical: {
    borderColor: "#54545840",
    backgroundColor: "#00000066",
  },
  sectionScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C7C7CC",
  },
  sectionDeltaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sectionDeltaWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    marginRight: 1,
  },
  overallDeltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  overallDeltaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  matchPlaySummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    padding: 16,
    gap: 14,
  },
  matchPlaySummaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  matchPlaySummaryEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64D2FF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  matchPlaySummaryTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  matchPlayPrimaryStrokeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#33415588",
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  matchPlayPrimaryStrokeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  matchPlayPrimaryStrokeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#AEAEB2",
  },
  matchPlaySummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  matchPlaySummaryStatCard: {
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545850",
    backgroundColor: "#13132A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  matchPlaySummaryStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#8E8E93",
  },
  matchPlaySummaryStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  matchPlaySummaryDeltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchPlaySummaryDeltaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  barsContainer: {
    gap: 18,
  },
  tenGroup: {
    gap: 8,
  },
  tenRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#54545830",
    backgroundColor: "#00000075",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  tenRowCompact: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tenLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#C7C7CC",
    marginRight: 8,
  },
  tenLabelCompact: {
    fontSize: 12,
    marginRight: 6,
  },
  tenScore: {
    fontSize: 12,
    fontWeight: "700",
  },
  tenTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1F2937",
    overflow: "hidden",
  },
  tenTrackCompact: {
    height: 6,
  },
  tenFill: {
    height: "100%",
    borderRadius: 999,
  },
  tenExplanation: {
    fontSize: 11,
    color: "#8E8E93",
    lineHeight: 16,
  },
  tenExplanationCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  inlineSectionLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545830",
    backgroundColor: "#00000088",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineSectionLoadingText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  inlineMoreButton: {
    marginTop: -2,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
  },
  inlineMoreButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0A84FF",
  },
  strokeMixList: {
    gap: 10,
  },
  strokeMixRow: {
    gap: 6,
    paddingVertical: 2,
  },
  strokeMixHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  strokeMixTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  strokeMixDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  strokeMixLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  strokeMixMeta: {
    fontSize: 11,
    fontWeight: "500",
    color: "#8E8E93",
  },
  strokeMixTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#1F2937",
    overflow: "hidden",
  },
  strokeMixFill: {
    height: "100%",
    borderRadius: 999,
  },
  strokeMixPercent: {
    fontSize: 11,
    fontWeight: "600",
    color: "#AFC4E0",
    textAlign: "right",
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#54545860",
  },
  periodPillActive: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF",
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#636366",
  },
  periodTextActive: {
    color: "#FFFFFF",
  },
  periodHint: {
    fontSize: 11,
    color: "#48484A",
    marginLeft: 4,
  },
  metricsSection: {
    gap: 14,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCardWrapper: {
    width: METRIC_CARD_WIDTH,
  },
  coachingSection: {
    gap: 14,
  },
  shotReportCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    padding: 16,
    gap: 10,
  },
  shotReportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shotReportTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  shotReportMeta: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  shotReportSubTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#AEAEB2",
  },
  shotReportList: {
    gap: 6,
  },
  shotReportRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#54545835",
    backgroundColor: "#00000090",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  shotReportRowText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  shotReportRowMeta: {
    fontSize: 11,
    color: "#8E8E93",
  },
  shotReportInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
    color: "#FFFFFF",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shotReportSaveButton: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#0A84FF",
  },
  shotReportSaveButtonDisabled: {
    backgroundColor: "#4C4A68",
  },
  shotReportSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  manualOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 10, 26, 0.32)",
  },
  manualKeyboardContainer: {
    width: "100%",
    justifyContent: "flex-end",
  },
  manualSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#101025",
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 12,
    minHeight: "58%",
    maxHeight: "90%",
  },
  manualSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#334155",
    marginBottom: 4,
  },
  manualHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  manualTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  manualSubtitle: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  manualShotList: {
    maxHeight: 448,
  },
  manualShotListContent: {
    gap: 10,
    paddingBottom: 6,
  },
  manualTrainingToggleRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#54545835",
    borderRadius: 10,
    backgroundColor: "#00000080",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  manualTrainingCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#48484A",
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  manualTrainingToggleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#AEAEB2",
  },
  manualShotActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  manualShotActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualShotActionDisabled: {
    backgroundColor: "#111827",
    borderColor: "#54545835",
  },
  manualShotActionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#C7C7CC",
  },
  manualShotActionTextDisabled: {
    color: "#636366",
  },
  manualShotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545835",
    backgroundColor: "#00000090",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  manualShotNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1E1B4B",
    borderWidth: 1,
    borderColor: "#312E81",
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "600",
    color: "#C4B5FD",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  manualDropdownWrap: {
    flex: 1,
  },
  manualDropdownTrigger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manualDropdownTriggerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  manualDropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#101025",
    padding: 8,
    gap: 6,
  },
  manualDropdownOption: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#54545835",
  },
  manualDropdownOptionActive: {
    borderColor: "#0A84FF",
    backgroundColor: "#0A84FF20",
  },
  manualDropdownOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#C7C7CC",
  },
  manualCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  feedbackSection: {
    gap: 14,
  },
  feedbackCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    gap: 14,
  },
  thumbButtonActiveUp: {
    borderColor: "#30D15840",
    backgroundColor: "#30D15810",
  },
  thumbButtonActiveDown: {
    borderColor: "#FF453A40",
    backgroundColor: "#FF453A10",
  },
  feedbackOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 10, 26, 0.32)",
  },
  feedbackKeyboardContainer: {
    width: "100%",
    justifyContent: "flex-end",
  },
  feedbackSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    maxHeight: "82%",
    backgroundColor: "#101025",
    borderTopWidth: 1,
    borderColor: "#54545860",
  },
  feedbackSheetContent: {
    gap: 10,
  },
  feedbackSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#334155",
    marginBottom: 4,
  },
  feedbackSheetTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  feedbackSheetSubtitle: {
    fontSize: 12,
    color: "#8E8E93",
    lineHeight: 18,
  },
  feedbackGroupTitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#AEAEB2",
  },
  feedbackChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedbackChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#54545860",
  },
  feedbackChipActive: {
    borderColor: "#0A84FF",
    backgroundColor: "#0A84FF20",
  },
  feedbackChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  feedbackChipTextActive: {
    color: "#C7C7CC",
  },
  feedbackSheetInput: {
    minHeight: 72,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 13,
    textAlignVertical: "top",
  },
  feedbackSheetActions: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingBottom: 22,
  },
  feedbackSheetGhostButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#000000",
  },
  feedbackSheetGhostText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
  },
  feedbackSheetSubmit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0A84FF",
  },
  feedbackSheetSubmitDisabled: {
    backgroundColor: "#4C4A68",
  },
  feedbackSheetSubmitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  savedBreadcrumbContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 12,
  },
  savedBreadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#101025EE",
  },
  savedBreadcrumbText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  processingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    padding: 28,
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  ghostLoadingCard: {
    width: "100%",
    alignSelf: "stretch",
    marginHorizontal: 0,
    marginVertical: 12,
  },
  ghostLoadingContent: {
    minHeight: 132,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  ghostLoadingTextWrap: {
    flex: 1,
    gap: 4,
  },
  ghostLoadingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  ghostLoadingSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  processingCardHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: -6,
  },
  processingInfoButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#0F172A",
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    color: "#FFFFFF",
  },
  enrichmentNotice: {
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E3A5F",
    backgroundColor: "#0B1B30",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  enrichmentNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: "#BFDBFE",
  },
  processingSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    color: "#8E8E93",
  },
  processingSteps: {
    gap: 10,
    width: "100%",
    marginTop: 8,
  },
  processingToast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0A84FF40",
    backgroundColor: "#1E3A5FCC",
  },
  processingToastText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#DBEAFE",
  },
  pipelineModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.68)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pipelineModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#111827",
    padding: 18,
    gap: 14,
  },
  pipelineModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  pipelineModalTitleWrap: {
    flex: 1,
    gap: 4,
  },
  pipelineModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pipelineModalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  pipelineModalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
  },
  stepRow: {
    flexDirection: "row",
    fontSize: 12,
    gap: 10,
  },
  stepText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
  },
  errorSub: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  tenExplanationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  rejectedStateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  rejectedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EF444418",
    borderWidth: 1,
    borderColor: "#EF444438",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  rejectionReason: {
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 360,
  },
  tryAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A84FF",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  rejectedTryAgainButton: {
    backgroundColor: "#16A34A",
  },
  tryAgainButtonDisabled: {
    backgroundColor: "#4C4A68",
  },
  tryAgainText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 15,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
