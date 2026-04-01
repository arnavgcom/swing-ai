
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchAnalysesSummary, deleteAnalysis, retryAnalysis } from "@/services/api";
import type { AnalysisSummary } from "@/services/api";
import {
  DEFAULT_SESSION_TYPE_FILTERS,
  filterAnalysesBySessionAndStroke,
  SESSION_TYPE_FILTER_OPTIONS,
  STROKE_FILTER_OPTIONS,
  type SessionTypeFilter,
  type StrokeTypeFilter,
} from "@/utils/analysis-filters";
import { getApiUrl } from "@/services/query-client";
import { useAuth } from "@/contexts/auth-context";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatMonthDayInTimeZone,
  parseApiDate,
  resolveUserTimeZone,
} from "@/utils/timezone";
import { useSport } from "@/contexts/sport-context";
import { TabScreenFilterGroup, TabScreenFilterRow, TabScreenIntro } from "@/components/layout/TabScreenIntro";
import { ds } from "@/constants/design-system";
import { useTabBar } from "@/contexts/tab-bar-context";

const LAST_WORKED_ANALYSIS_KEY = "swingai_last_worked_analysis_id";
const BACKGROUND_NOTICE_KEY = "swingai_background_processing_notice";
const PENDING_ANALYSIS_SUMMARY_KEY = "swingai_pending_analysis_summary";

type CompletionNotice = {
  analysisId: string;
  status: "completed" | "failed" | "rejected";
  message: string;
};

/** Collapsible section for history screen */
function HistoryCollapsibleSection({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[hcStyles.wrapper, { borderColor: `${color}30` }]}>
      <View style={hcStyles.header}>
        <View style={hcStyles.titleRow}>
          <View style={[hcStyles.titleAccent, { backgroundColor: color }]} />
          <Text style={hcStyles.title}>{title}</Text>
        </View>
      </View>
      <View style={hcStyles.content}>{children}</View>
    </View>
  );
}

const hcStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

function TrendChart({ data, dates }: { data: number[]; dates: string[] }) {
  const { width: screenWidth } = useWindowDimensions();
  if (data.length === 0) return null;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = Math.max(maxVal - minVal, 10);
  const chartHeight = 30;
  const yLabelWidth = 28;
  // screenWidth - card marginHorizontal(20*2) - content paddingHorizontal(16*2) - yLabelWidth
  const chartWidth = Math.max(screenWidth - 100, 100);
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((val, i) => ({
    x: i * stepX,
    y: chartHeight - ((val - minVal) / range) * chartHeight,
  }));

  const yMax = Math.round(maxVal);
  const yMin = Math.round(minVal);

  return (
    <View style={trendStyles.container}>
      <View style={trendStyles.chartRow}>
        <View style={trendStyles.yAxis}>
          <Text style={trendStyles.yLabel}>{yMax}</Text>
          <Text style={trendStyles.yLabel}>{yMin}</Text>
        </View>
        <View
          style={{
            width: chartWidth,
            height: chartHeight,
            position: "relative",
          }}
        >
          <View style={trendStyles.gridLine} />
          <View style={[trendStyles.gridLine, { top: chartHeight - 1 }]} />
          {points.map((point, i) => {
            if (i === 0) return null;
            const prev = points[i - 1];
            const dx = point.x - prev.x;
            const dy = point.y - prev.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`line-${i}`}
                style={{
                  position: "absolute",
                  left: prev.x,
                  top: prev.y,
                  width: length,
                  height: 2,
                  backgroundColor: "#30D158",
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: "left center",
                  opacity: 0.8,
                }}
              />
            );
          })}
          {points.map((point, i) => (
            <View
              key={`dot-${i}`}
              style={[
                trendStyles.dot,
                {
                  backgroundColor:
                    i === points.length - 1 ? "#30D158" : "#30D15860",
                  width: i === points.length - 1 ? 8 : 6,
                  height: i === points.length - 1 ? 8 : 6,
                  borderRadius: i === points.length - 1 ? 4 : 3,
                  left: point.x - (i === points.length - 1 ? 4 : 3),
                  top: point.y - (i === points.length - 1 ? 4 : 3),
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={[trendStyles.xAxis, { marginLeft: yLabelWidth }]}>
        {dates.map((d, i) => (
          <Text
            key={i}
            style={[
              trendStyles.xLabel,
              i === 0
                ? { textAlign: "left" as const }
                : i === dates.length - 1
                  ? { textAlign: "right" as const }
                  : {},
            ]}
          >
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: { paddingVertical: 8 },
  chartRow: { flexDirection: "row", alignItems: "stretch" },
  yAxis: {
    width: 28,
    justifyContent: "space-between",
    paddingRight: 4,
  },
  yLabel: {
    fontSize: 9,
    color: "#636366",
    textAlign: "right" as const,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "#54545820",
  },
  dot: { position: "absolute" },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  xLabel: {
    fontSize: 9,
    color: "#636366",
    flex: 1,
    textAlign: "center" as const,
  },
});

function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s+(.)/g, (_, c) => " " + c.toUpperCase())
    .trim();
}

const SESSION_SECTION_KEYS: Array<"technical" | "tactical" | "movement"> = [
  "technical",
  "tactical",
  "movement",
];
const SESSION_SECTION_LABELS: Record<(typeof SESSION_SECTION_KEYS)[number], string> = {
  technical: "Technical",
  tactical: "Tactical",
  movement: "Movement",
};
const TREND_SESSION_FILTERS = [
  { key: 5, label: "5S" },
  { key: 10, label: "10S" },
  { key: 25, label: "25S" },
  { key: "all", label: "All" },
] as const;
type TrendSessionWindow = (typeof TREND_SESSION_FILTERS)[number]["key"];

const HISTORY_SORT_OPTIONS = [
  { key: "session", label: "Session" },
  { key: "upload", label: "Upload" },
] as const;
type HistorySortKey = (typeof HISTORY_SORT_OPTIONS)[number]["key"];

function isInFlightAnalysisStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "processing";
}

function normalizeConfigSegment(value: string | null | undefined): string {
  return normalizeText(value).replace(/[_\s]+/g, "-").replace(/-+/g, "-");
}

function filterBySport(
  analyses: AnalysisSummary[],
  sportName: string | undefined,
  movementName: string | undefined,
): AnalysisSummary[] {
  if (!sportName) return analyses;
  const sportLower = normalizeConfigSegment(sportName);
  const movementLower = normalizeMovementValue(movementName);
  return analyses.filter((a) => {
    const keyLower = normalizeText(a.configKey);
    const keyParts = keyLower.split("-").filter(Boolean);
    const keySport = keyParts[0] || "";
    const summarySport = normalizeConfigSegment(a.sportName);
    const summaryMovement = normalizeMovementValue(a.movementName);
    if (keySport) {
      if (keySport !== sportLower) return false;
    } else if (summarySport) {
      if (summarySport !== sportLower) return false;
    } else if (!isInFlightAnalysisStatus(a.status)) {
      return false;
    }
    if (movementLower) {
      const resolvedMovement = summaryMovement || resolveAnalysisMovement(a);
      if (keyLower) {
        if (!keyLower.includes(movementLower)) return false;
      } else if (resolvedMovement !== movementLower) {
        return false;
      }
    }
    return true;
  });
}

function mergePendingAnalysisSummary(
  serverItem: AnalysisSummary,
  pendingItem: AnalysisSummary,
): AnalysisSummary {
  return {
    ...pendingItem,
    ...serverItem,
    userName: serverItem.userName || pendingItem.userName,
    videoPath: serverItem.videoPath || pendingItem.videoPath,
    detectedMovement: serverItem.detectedMovement || pendingItem.detectedMovement,
    capturedAt: serverItem.capturedAt || pendingItem.capturedAt,
    configKey: serverItem.configKey || pendingItem.configKey,
  };
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}

function getSectionScore10(item: AnalysisSummary, key: "technical" | "tactical" | "movement"): number | null {
  const raw = Number(item.sectionScores?.[key]);
  return Number.isFinite(raw) ? raw : null;
}

function getSessionOverallScore10(item: AnalysisSummary): number | null {
  // Use only persisted DB overall score; do not derive from section averages.
  const rawOverall = Number(item.overallScore);
  if (Number.isFinite(rawOverall)) {
    return Number((rawOverall / 10).toFixed(1));
  }

  return null;
}

function computePercentDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (Math.abs(previous) < 1e-6) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Number(pct.toFixed(1));
  return rounded === 0 ? null : rounded;
}

function getDeltaColor(deltaPct: number | null): string {
  if (deltaPct == null) return "#636366";
  if (Math.abs(deltaPct) < 1e-6) return "#8E8E93";
  return deltaPct >= 0 ? "#30D158" : "#FF453A";
}

function formatDeltaPercent(deltaPct: number | null): string | null {
  if (deltaPct == null) return null;
  return `${Math.abs(deltaPct).toFixed(1)}%`;
}

function deltaTrendIcon(deltaPct: number | null): "caret-up" | "caret-down" | "remove" {
  if (deltaPct == null || Math.abs(deltaPct) < 1e-6) return "remove";
  return deltaPct > 0 ? "caret-up" : "caret-down";
}

function normalizeMovementValue(value: string | null | undefined): string {
  const normalized = normalizeText(value).replace(/[_\s]+/g, "-").replace(/-+/g, "-");
  if (!normalized || normalized === "auto-detect" || normalized === "autodetect") {
    return "";
  }
  return normalized;
}

function movementFromConfigKey(configKey: string | null | undefined): string {
  const normalized = normalizeText(configKey);
  if (!normalized) return "";
  const parts = normalized.split("-").filter(Boolean);
  if (parts.length < 2) return "";
  return normalizeMovementValue(parts.slice(1).join("-"));
}

function movementFromVideoFilename(videoFilename: string | null | undefined): string {
  const filename = String(videoFilename || "");
  if (!filename) return "";
  const stem = filename.replace(/\.[^.]+$/, "");
  const parts = stem.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return "";
  return normalizeMovementValue(parts[2]);
}

function resolveAnalysisMovement(item: AnalysisSummary): string {
  return (
    normalizeMovementValue(item.detectedMovement) ||
    movementFromConfigKey(item.configKey) ||
    movementFromVideoFilename(item.videoFilename)
  );
}

function formatRequestedSessionTypeLabel(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (normalized === "practice") return "Practise / Drill";
  if (normalized === "match-play") return "Match Play";
  return null;
}

function formatRequestedFocusLabel(
  value: string | null | undefined,
  sessionType?: string | null,
): string | null {
  const normalized = normalizeText(value).replace(/[_\s]+/g, "-").replace(/-+/g, "-");
  if (!normalized) return null;
  if (normalized === "game") {
    return normalizeText(sessionType) === "match-play" ? null : "Game";
  }
  if (normalized === "auto-detect" || normalized === "autodetect") {
    return null;
  }
  return toTitleCase(normalized.replace(/-/g, " "));
}

function getVideoDate(item: Pick<AnalysisSummary, "capturedAt" | "createdAt">): string {
  return item.capturedAt || item.createdAt;
}

function getProcessingStartDate(item: Pick<AnalysisSummary, "createdAt">): string {
  return item.createdAt;
}

function formatElapsedDuration(startedAtIso: string, nowMs: number): string | null {
  const startedAt = parseApiDate(startedAtIso);
  if (!startedAt) return null;

  const elapsedMs = Math.max(nowMs - startedAt.getTime(), 0);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${seconds}s`;
}

function getAverageScore10(items: AnalysisSummary[]): number | null {
  const scores = items
    .map((item) => getSessionOverallScore10(item))
    .filter((value): value is number => value != null);
  if (!scores.length) return null;
  return Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1));
}

function getReviewPriority(item: AnalysisSummary, nowMs: number): number {
  if (item.status === "rejected") return 0;
  if (item.status === "failed") return 1;
  if (item.status === "processing" || item.status === "pending") {
    const startedAt = parseApiDate(getProcessingStartDate(item))?.getTime() ?? nowMs;
    const elapsedMinutes = Math.max(nowMs - startedAt, 0) / 60000;
    if (elapsedMinutes >= 20) return 2;
    return 3;
  }
  return 4;
}

function getReviewStatusLabel(item: AnalysisSummary, nowMs: number): string {
  if (item.status === "rejected") return "Rejected";
  if (item.status === "failed") return "Failed";
  if (item.status === "processing" || item.status === "pending") {
    const elapsed = formatElapsedDuration(getProcessingStartDate(item), nowMs);
    return elapsed ? `Running ${elapsed}` : "Running";
  }
  return toTitleCase(item.status);
}

function getReviewStatusTone(item: AnalysisSummary, nowMs: number): { bg: string; border: string; text: string } {
  if (item.status === "rejected") {
    return { bg: "#FF453A14", border: "#FF453A30", text: "#FF453A" };
  }
  if (item.status === "failed") {
    return { bg: "#332B00", border: "#665600", text: "#FFD60A" };
  }
  if (item.status === "processing" || item.status === "pending") {
    const startedAt = parseApiDate(getProcessingStartDate(item))?.getTime() ?? nowMs;
    const elapsedMinutes = Math.max(nowMs - startedAt, 0) / 60000;
    if (elapsedMinutes >= 20) {
      return { bg: "#332B00", border: "#665600", text: "#FFD60A" };
    }
    return { bg: "#002040", border: "#0A84FF", text: "#64D2FF" };
  }
  return { bg: "#30D15814", border: "#30D15840", text: "#30D158" };
}

function ReviewMetricCard({
  label,
  value,
  helper,
  icon,
  color,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}) {
  return (
    <View style={styles.reviewMetricCard}>
      <View style={[styles.reviewMetricIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.reviewMetricLabel}>{label}</Text>
      <Text style={[styles.reviewMetricValue, { color }]}>{value}</Text>
      <Text style={styles.reviewMetricHelper}>{helper}</Text>
    </View>
  );
}

function AdminQueueItem({
  item,
  timeZone,
  nowMs,
}: {
  item: AnalysisSummary;
  timeZone?: string;
  nowMs: number;
}) {
  const tone = getReviewStatusTone(item, nowMs);
  const score = getSessionOverallScore10(item);
  const movementLabel = toTitleCase((resolveAnalysisMovement(item) || "general").replace(/-/g, " "));
  const playerLabel = String(item.userName || "Unknown").trim() || "Unknown";

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/analysis/[id]",
          params: { id: item.id },
        })
      }
      style={({ pressed }) => [styles.reviewQueueItem, { opacity: pressed ? 0.86 : 1 }]}
    >
      <View style={styles.reviewQueueTopRow}>
        <View style={styles.reviewQueueMeta}>
          <Text style={styles.reviewQueuePlayer} numberOfLines={1}>{playerLabel}</Text>
          <Text style={styles.reviewQueueVideo} numberOfLines={1}>{item.videoFilename}</Text>
        </View>
        <View style={[styles.reviewQueueStatusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.reviewQueueStatusText, { color: tone.text }]}>
            {getReviewStatusLabel(item, nowMs)}
          </Text>
        </View>
      </View>
      <View style={styles.reviewQueueBottomRow}>
        <View style={styles.reviewQueueTags}>
          <View style={styles.reviewQueueTag}>
            <Ionicons name="flash-outline" size={11} color="#8E8E93" />
            <Text style={styles.reviewQueueTagText}>{movementLabel}</Text>
          </View>
          <View style={styles.reviewQueueTag}>
            <Ionicons name="calendar-outline" size={11} color="#8E8E93" />
            <Text style={styles.reviewQueueTagText}>
              {formatMonthDayInTimeZone(getVideoDate(item), timeZone)}
            </Text>
          </View>
        </View>
        <Text style={styles.reviewQueueScoreText}>
          {score != null ? `${score.toFixed(1)}` : "Open"}
        </Text>
      </View>
    </Pressable>
  );
}

function AdminPlayerPulseCard({
  label,
  averageScore,
  sessionCount,
  lastSessionLabel,
  onPress,
  isSelected,
  accentColor,
}: {
  label: string;
  averageScore: number | null;
  sessionCount: number;
  lastSessionLabel: string;
  onPress: () => void;
  isSelected: boolean;
  accentColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.playerPulseCard,
        isSelected && {
          borderColor: `${accentColor}66`,
          backgroundColor: `${accentColor}10`,
        },
        { opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <View style={styles.playerPulseTopRow}>
        <Text style={styles.playerPulseName} numberOfLines={1}>{label}</Text>
        {isSelected ? (
          <View style={[styles.playerPulseSelectedBadge, { backgroundColor: `${accentColor}22` }]}>
            <Text style={[styles.playerPulseSelectedText, { color: accentColor }]}>Scoped</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.playerPulseScore}>
        {averageScore != null ? averageScore.toFixed(1) : "-"}
      </Text>
      <Text style={styles.playerPulseMeta}>{sessionCount} completed sessions</Text>
      <Text style={styles.playerPulseSubtle}>Last session {lastSessionLabel}</Text>
    </Pressable>
  );
}

function formatSessionSearchDate(createdAt: string, timeZone?: string): string[] {
  const date = parseApiDate(createdAt);
  if (!date) return [createdAt];
  return [
    createdAt,
    createdAt.slice(0, 10),
    formatDateInTimeZone(date, timeZone, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }),
    formatDateInTimeZone(date, timeZone, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    formatDateInTimeZone(date, timeZone, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  ];
}

function getAnalysisSearchText(item: AnalysisSummary, timeZone?: string): string {
  const movement = item.detectedMovement || "";
  const config = item.configKey || "";
  const configParts = config.split("-").join(" ");
  const dateTokens = formatSessionSearchDate(getVideoDate(item), timeZone);

  return normalizeText(
    [
      item.videoFilename,
      item.userName,
      item.userId,
      item.sportName,
      item.movementName,
      item.rejectionReason,
      movement,
      movement.replace(/-/g, " "),
      config,
      configParts,
      ...dateTokens,
    ].join(" "),
  );
}

function matchesAnalysisSearch(item: AnalysisSummary, query: string, timeZone?: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return getAnalysisSearchText(item, timeZone).includes(q);
}

function SummaryCard({
  item,
  deltas,
  isOwner,
  isAdmin,
  isHighlighted,
  highlightColor,
  sortMode,
  onPress,
  onDelete,
  onRetry,
  retryPending,
  timeZone,
  showBackgroundProcessing,
}: {
  item: AnalysisSummary;
  deltas?: {
    overallPct: number | null;
    sections: Record<string, number | null>;
  };
  isOwner: boolean;
  isAdmin: boolean;
  isHighlighted: boolean;
  highlightColor: string;
  sortMode: HistorySortKey;
  onPress: () => void;
  onDelete: () => void;
  onRetry: () => void;
  retryPending?: boolean;
  timeZone?: string;
  showBackgroundProcessing?: boolean;
}) {
  const [elapsedNowMs, setElapsedNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!showBackgroundProcessing) return;

    setElapsedNowMs(Date.now());
    const intervalId = setInterval(() => {
      setElapsedNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [item.createdAt, showBackgroundProcessing]);

  const timeStr = formatDateTimeInTimeZone(getVideoDate(item), timeZone, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const score = getSessionOverallScore10(item);
  const movement = resolveAnalysisMovement(item);
  const requestedSessionLabel = formatRequestedSessionTypeLabel(item.requestedSessionType);
  const requestedFocusLabel = formatRequestedFocusLabel(item.requestedFocusKey, item.requestedSessionType);
  const compactStrokeLabel = isInFlightAnalysisStatus(item.status) || item.status === "rejected"
    ? null
    : requestedFocusLabel || (movement ? toTitleCase(movement).replace(/-/g, " ") : null);
  const isRecentUpload =
    sortMode === "upload"
    && Date.now() - (parseApiDate(item.createdAt)?.getTime() || 0) <= 24 * 60 * 60 * 1000;
  const elapsedTimeLabel = showBackgroundProcessing
    ? formatElapsedDuration(getProcessingStartDate(item), elapsedNowMs)
    : null;

  const sectionEntries = SESSION_SECTION_KEYS.map((key) => {
    const value = getSectionScore10(item, key);

    return {
      key,
      label: SESSION_SECTION_LABELS[key],
      value,
    };
  }).filter((entry) => entry.value != null);

  const overallDeltaPct = deltas?.overallPct ?? null;

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: "#FFD60A", label: "Pending" },
    processing: { color: "#0A84FF", label: "Processing" },
    completed: { color: "#30D158", label: "Completed" },
    failed: { color: "#FF453A", label: "Failed Processing" },
    rejected: { color: "#FF453A", label: "Rejected" },
  };
  const status = statusConfig[item.status] || statusConfig.pending;
  const failureMessage = item.status === "failed"
    ? String(item.rejectionReason || "").trim() || "Processing failed unexpectedly."
    : null;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        summaryStyles.card,
        isHighlighted && {
          borderColor: `${highlightColor}AA`,
          borderWidth: 1.5,
          shadowColor: highlightColor,
          shadowOpacity: 0.22,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        },
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View
        style={[summaryStyles.accentBar, { backgroundColor: status.color }]}
      />
      <View style={summaryStyles.cardTop}>
        <View style={summaryStyles.cardTopLeft}>
          <Text style={summaryStyles.timeText}>{timeStr}</Text>
          {showBackgroundProcessing && item.userName ? (
            <View style={summaryStyles.playerMetaRow}>
              {showBackgroundProcessing ? (
                <View style={[summaryStyles.backgroundProcessingBadge, summaryStyles.inlineProcessingBadge]}>
                  <ActivityIndicator size="small" color={status.color} />
                  <Text style={[summaryStyles.backgroundProcessingBadgeText, { color: status.color }]}>
                    {elapsedTimeLabel
                      ? `Processing • ${elapsedTimeLabel}`
                      : "Processing"}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {item.userName || requestedSessionLabel || compactStrokeLabel || item.status === "rejected" ? (
            <View style={summaryStyles.compactMetaRow}>
              {isRecentUpload ? (
                <View style={[summaryStyles.compactMetaBadge, summaryStyles.compactUploadBadge]}>
                  <Text style={[summaryStyles.compactMetaBadgeText, summaryStyles.compactUploadBadgeText]}>New</Text>
                </View>
              ) : null}
              {item.userName ? (
                <View style={[summaryStyles.compactMetaBadge, summaryStyles.compactPlayerBadge]}>
                  <Text style={[summaryStyles.compactMetaBadgeText, summaryStyles.compactPlayerBadgeText]} numberOfLines={1}>
                    {item.userName}
                  </Text>
                </View>
              ) : null}
              {requestedSessionLabel ? (
                <View style={[summaryStyles.compactMetaBadge, summaryStyles.compactSessionBadge]}>
                  <Text style={[summaryStyles.compactMetaBadgeText, summaryStyles.compactSessionBadgeText]}>
                    {requestedSessionLabel}
                  </Text>
                </View>
              ) : null}
              {compactStrokeLabel ? (
                <View style={[summaryStyles.compactMetaBadge, summaryStyles.compactFocusBadge]}>
                  <Text style={[summaryStyles.compactMetaBadgeText, summaryStyles.compactFocusBadgeText]}>
                    {compactStrokeLabel}
                  </Text>
                </View>
              ) : null}
              {item.status === "rejected" ? (
                <View style={summaryStyles.rejectedBadge}>
                  <Ionicons name="close-circle-outline" size={11} color="#FF453A" />
                  <Text style={summaryStyles.rejectedBadgeText}>Rejected</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {showBackgroundProcessing && !(isAdmin && item.userName) ? (
            <View style={summaryStyles.backgroundProcessingBadge}>
              <ActivityIndicator size="small" color={status.color} />
              <Text style={[summaryStyles.backgroundProcessingBadgeText, { color: status.color }]}>
                {elapsedTimeLabel
                  ? `Processing • ${elapsedTimeLabel}`
                  : "Processing"}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={summaryStyles.cardTopRight}>
          {score != null ? (
            <View style={summaryStyles.scoreWrap}>
              <Text style={summaryStyles.scoreLabel}>Score</Text>
              <View style={summaryStyles.scoreValueRow}>
                {overallDeltaPct != null ? (
                  <View style={summaryStyles.deltaWrap}>
                    <Ionicons
                      name={deltaTrendIcon(overallDeltaPct)}
                      size={12}
                      color={getDeltaColor(overallDeltaPct)}
                    />
                    <Text style={[summaryStyles.deltaText, { color: getDeltaColor(overallDeltaPct) }]}>
                      {formatDeltaPercent(overallDeltaPct)}
                    </Text>
                  </View>
                ) : null}
                <Text style={summaryStyles.scoreText}>{score.toFixed(1)}</Text>
              </View>
            </View>
          ) : (
            <View
              style={[
                summaryStyles.statusBadge,
                { backgroundColor: status.color + "14" },
              ]}
            >
              <Text style={[summaryStyles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="#48484A" />
        </View>
      </View>

      {failureMessage ? (
        <View style={summaryStyles.failureMessageWrap}>
          <Ionicons name="alert-circle-outline" size={13} color="#FF453A" />
          <View style={summaryStyles.failureContent}>
            <Text style={summaryStyles.failureMessageText} numberOfLines={3}>
              {failureMessage}
            </Text>
            <Pressable
              disabled={retryPending}
              onPress={(e) => {
                if (retryPending) return;
                e.stopPropagation?.();
                onRetry();
              }}
              style={({ pressed }) => [
                summaryStyles.retryButton,
                retryPending && summaryStyles.retryButtonDisabled,
                { opacity: pressed ? 0.72 : 1 },
              ]}
            >
              {retryPending ? (
                <ActivityIndicator size="small" color="#FF453A" />
              ) : (
                <Ionicons name="refresh" size={12} color="#FF453A" />
              )}
              <Text style={summaryStyles.retryButtonText}>{retryPending ? "Retrying..." : "Retry"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {sectionEntries.length > 0 && (
        <View style={summaryStyles.metricsRow}>
            {sectionEntries.map((entry) => {
              return (
                <View key={entry.key} style={summaryStyles.metricItem}>
                  <Text style={summaryStyles.metricLabel} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <View style={summaryStyles.metricValueRow}>
                    <Text style={summaryStyles.metricValue}>
                      {Number(entry.value).toFixed(1)}
                    </Text>
                    {deltas?.sections?.[entry.key] != null ? (
                      <View style={summaryStyles.metricDeltaWrap}>
                        <Ionicons
                          name={deltaTrendIcon(Number(deltas.sections[entry.key]))}
                          size={10}
                          color={getDeltaColor(Number(deltas.sections[entry.key]))}
                        />
                        <Text
                          style={[
                            summaryStyles.metricDeltaText,
                            { color: getDeltaColor(deltas.sections[entry.key]) },
                          ]}
                        >
                          {formatDeltaPercent(Number(deltas.sections[entry.key]))}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
          })}
        </View>
      )}

      {isOwner && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete();
          }}
          style={({ pressed }) => [
            summaryStyles.deleteBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={13} color="#FF453A" />
        </Pressable>
      )}
    </Pressable>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545840",
    padding: 16,
    overflow: "hidden",
    position: "relative",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTopLeft: { flex: 1, gap: 2 },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
  },
  playerNameText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#BF5AF2",
    flexShrink: 1,
  },
  playerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  compactMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  compactMetaBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "48%",
  },
  compactMetaBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  compactPlayerBadge: {
    backgroundColor: "#BF5AF212",
    borderColor: "#BF5AF230",
  },
  compactPlayerBadgeText: {
    color: "#BF5AF2",
  },
  compactUploadBadge: {
    backgroundColor: "#30D15812",
    borderColor: "#30D15844",
  },
  compactUploadBadgeText: {
    color: "#30D158",
  },
  compactSessionBadge: {
    backgroundColor: "#64D2FF12",
    borderColor: "#64D2FF30",
  },
  compactSessionBadgeText: {
    color: "#64D2FF",
  },
  compactFocusBadge: {
    backgroundColor: "#30D15812",
    borderColor: "#30D15830",
  },
  compactFocusBadgeText: {
    color: "#30D158",
  },
  rejectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "#FF453A14",
    borderWidth: 1,
    borderColor: "#FF453A30",
  },
  rejectedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF453A",
  },
  backgroundProcessingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#00000090",
    borderWidth: 1,
    borderColor: "#38383A",
  },
  inlineProcessingBadge: {
    marginTop: 0,
  },
  backgroundProcessingBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scoreText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#30D158",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  failureMessageWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FF453A30",
    backgroundColor: "#FF453A14",
  },
  failureContent: {
    flex: 1,
    gap: 8,
  },
  failureMessageText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    color: "#FF453A",
  },
  retryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF453A30",
    backgroundColor: "#FF453A18",
  },
  retryButtonDisabled: {
    backgroundColor: "#48484A80",
    borderColor: "#636366",
  },
  retryButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF453A",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 6,
  },
  metricItem: {
    minWidth: "31%" as any,
    flexGrow: 1,
    flexBasis: "31%" as any,
    backgroundColor: "#00000050",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#54545820",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#636366",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  metricValueRow: {
    width: "100%",
    minHeight: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scoreWrap: {
    alignItems: "flex-end",
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: "#636366",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  scoreValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  deltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 4,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  metricDeltaText: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 10,
  },
  metricDeltaWrap: {
    position: "absolute",
    right: "50%",
    marginRight: 16,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  deleteBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    padding: 4,
  },
});

export default function HistoryScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const profileTimeZone = resolveUserTimeZone(user);
  const isAdmin = user?.role === "admin";
  const { selectedSport, selectedMovement } = useSport();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [selectedTrendSessions, setSelectedTrendSessions] = useState<TrendSessionWindow>(10);
  const [userList, setUserList] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<SessionTypeFilter[]>(
    DEFAULT_SESSION_TYPE_FILTERS,
  );
  const [selectedStroke, setSelectedStroke] = useState<StrokeTypeFilter | null>(null);
  const [selectedHistorySort, setSelectedHistorySort] = useState<HistorySortKey>("session");
  const [visibleCount, setVisibleCount] = useState(10);
  const [lastWorkedAnalysisId, setLastWorkedAnalysisId] = useState<string | null>(null);
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] = useState<CompletionNotice | null>(null);
  const [pendingAnalysisSummary, setPendingAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const completionNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedStatusRef = useRef<string | null>(null);
  const toastTranslateY = useRef(new Animated.Value(24)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const areAllSessionTypesSelected = selectedSessionTypes.length === DEFAULT_SESSION_TYPE_FILTERS.length;
  const hasHistoryFilters = !areAllSessionTypesSelected || selectedStroke !== null;

  const toggleSessionType = useCallback((sessionType: SessionTypeFilter) => {
    setSelectedSessionTypes((current) => {
      if (current.includes(sessionType)) {
        if (current.length === 1) return current;
        const next = current.filter((value) => value !== sessionType);
        return DEFAULT_SESSION_TYPE_FILTERS.filter((value) => next.includes(value));
      }

      const next = [...current, sessionType];
      return DEFAULT_SESSION_TYPE_FILTERS.filter((value) => next.includes(value));
    });
  }, []);

  const toggleStroke = useCallback((strokeType: StrokeTypeFilter) => {
    setSelectedStroke((current) => (current === strokeType ? null : strokeType));
  }, []);

  const clearHistoryFilters = useCallback(() => {
    setSelectedSessionTypes(DEFAULT_SESSION_TYPE_FILTERS);
    setSelectedStroke(null);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedPlayerId("all");
      setShowPlayerDropdown(false);
      setUserList([]);
      return;
    }

    let active = true;
    (async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/users`, { credentials: "include" });
        if (active && res.ok) {
          const users = await res.json();
          if (Array.isArray(users) && users.length > 0) {
            setUserList(users);
          } else if (user) {
            setUserList([
              {
                id: user.id,
                name: user.name || "",
                email: user.email || "",
                role: user.role || "player",
              },
            ]);
          } else {
            setUserList([]);
          }
        }
      } catch {
        if (active) {
          if (user) {
            setUserList([
              {
                id: user.id,
                name: user.name || "",
                email: user.email || "",
                role: user.role || "player",
              },
            ]);
          } else {
            setUserList([]);
          }
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isAdmin, user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let hideTimer: ReturnType<typeof setTimeout> | null = null;

      Promise.all([
        AsyncStorage.getItem(LAST_WORKED_ANALYSIS_KEY),
        AsyncStorage.getItem(BACKGROUND_NOTICE_KEY),
        AsyncStorage.getItem(PENDING_ANALYSIS_SUMMARY_KEY),
      ])
        .then(async ([lastWorkedValue, noticeValue, pendingSummaryValue]) => {
          if (!active) return;
          setLastWorkedAnalysisId(lastWorkedValue);
          setBackgroundNotice(noticeValue);
          if (pendingSummaryValue) {
            try {
              setPendingAnalysisSummary(JSON.parse(pendingSummaryValue) as AnalysisSummary);
            } catch {
              setPendingAnalysisSummary(null);
            }
          } else {
            setPendingAnalysisSummary(null);
          }
          if (noticeValue) {
            hideTimer = setTimeout(() => {
              setBackgroundNotice(null);
            }, 4500);
            await AsyncStorage.removeItem(BACKGROUND_NOTICE_KEY).catch(() => {});
          }
        })
        .catch(() => {
          if (!active) return;
          setLastWorkedAnalysisId(null);
          setBackgroundNotice(null);
          setPendingAnalysisSummary(null);
        });

      return () => {
        active = false;
        if (hideTimer) clearTimeout(hideTimer);
      };
    }, []),
  );

  const {
    data: allAnalyses,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["analyses-summary", isAdmin ? "include-all" : "default"],
    queryFn: () => fetchAnalysesSummary({ includeAll: isAdmin }),
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!pendingAnalysisSummary) return;
    if (isLoading || !Array.isArray(allAnalyses)) return;

    const matchingServerItem = allAnalyses.find((item) => item.id === pendingAnalysisSummary.id);
    if (matchingServerItem && isInFlightAnalysisStatus(matchingServerItem.status)) {
      return;
    }

    AsyncStorage.multiRemove([
      PENDING_ANALYSIS_SUMMARY_KEY,
      BACKGROUND_NOTICE_KEY,
    ]).catch(() => {});
    setPendingAnalysisSummary(null);
    setBackgroundNotice(null);
  }, [allAnalyses, isLoading, pendingAnalysisSummary]);

  const effectiveAnalyses = useMemo(() => {
    const base = allAnalyses || [];
    if (!pendingAnalysisSummary) return base;

    const matchingServerItem = base.find((item) => item.id === pendingAnalysisSummary.id);
    if (matchingServerItem) {
      return base.map((item) => (
        item.id === pendingAnalysisSummary.id
          ? mergePendingAnalysisSummary(matchingServerItem, pendingAnalysisSummary)
          : item
      ));
    }

    return [pendingAnalysisSummary, ...base];
  }, [allAnalyses, pendingAnalysisSummary]);

  const analysesBySport = filterBySport(
    effectiveAnalyses,
    selectedSport?.name,
    selectedMovement?.name,
  );

  const comparisonAnalyses = useMemo(() => {
    let result = analysesBySport;

    if (isAdmin && selectedPlayerId !== "all") {
      result = result.filter((item) => item.userId === selectedPlayerId);
    } else if (!isAdmin && user?.id) {
      result = result.filter((item) => item.userId === user.id);
    }

    return result;
  }, [analysesBySport, isAdmin, selectedPlayerId, user?.id]);

  const filteredBySessionAndStroke = useMemo(
    () => filterAnalysesBySessionAndStroke(comparisonAnalyses, selectedSessionTypes, selectedStroke),
    [comparisonAnalyses, selectedSessionTypes, selectedStroke],
  );

  const filteredAnalyses = useMemo(() => {
    return filteredBySessionAndStroke;
  }, [filteredBySessionAndStroke]);

  const sortedAnalyses = useMemo(() => {
    const items = filteredAnalyses.slice();
    const getSortTime = (item: AnalysisSummary) => {
      const sortValue = selectedHistorySort === "upload" ? item.createdAt : getVideoDate(item);
      return parseApiDate(sortValue)?.getTime() || 0;
    };

    items.sort((a, b) => getSortTime(b) - getSortTime(a));
    return items;
  }, [filteredAnalyses, selectedHistorySort]);

  const pendingSummaryVisible = useMemo(() => {
    if (!pendingAnalysisSummary) return null;
    if (
      pendingAnalysisSummary.status !== "pending"
      && pendingAnalysisSummary.status !== "processing"
    ) {
      return null;
    }

    if (sortedAnalyses.some((item) => item.id === pendingAnalysisSummary.id)) {
      return null;
    }

    const bySport = filterBySport(
      [pendingAnalysisSummary],
      selectedSport?.name,
      selectedMovement?.name,
    );
    if (!bySport.length) return null;

    if (isAdmin && selectedPlayerId !== "all") {
      if (pendingAnalysisSummary.userId !== selectedPlayerId) return null;
    } else if (!isAdmin && user?.id) {
      if (pendingAnalysisSummary.userId !== user.id) return null;
    }

    const bySessionAndStroke = filterAnalysesBySessionAndStroke(
      [pendingAnalysisSummary],
      selectedSessionTypes,
      selectedStroke,
    );
    if (!bySessionAndStroke.length) return null;

    return pendingAnalysisSummary;
  }, [
    sortedAnalyses,
    isAdmin,
    pendingAnalysisSummary,
    selectedSessionTypes,
    selectedMovement?.name,
    selectedPlayerId,
    selectedSport?.name,
    selectedStroke,
    user?.id,
  ]);

  const visibleAnalyses = useMemo(() => {
    if (!pendingSummaryVisible) return sortedAnalyses;
    return [pendingSummaryVisible, ...sortedAnalyses];
  }, [pendingSummaryVisible, sortedAnalyses]);

  // Reset pagination when the visible list changes (filter/sort change)
  useEffect(() => {
    setVisibleCount(10);
  }, [sortedAnalyses, selectedSessionTypes, selectedStroke, selectedHistorySort]);

  const activeBackgroundAnalysisId = useMemo(() => {
    if (pendingAnalysisSummary && isInFlightAnalysisStatus(pendingAnalysisSummary.status)) {
      return pendingAnalysisSummary.id;
    }
    return lastWorkedAnalysisId;
  }, [lastWorkedAnalysisId, pendingAnalysisSummary]);

  const activeBackgroundAnalysis = useMemo(
    () => effectiveAnalyses.find((item) => item.id === activeBackgroundAnalysisId) ?? null,
    [activeBackgroundAnalysisId, effectiveAnalyses],
  );
  const nowMs = Date.now();

  useEffect(() => {
    return () => {
      if (completionNoticeTimerRef.current) {
        clearTimeout(completionNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeBackgroundAnalysisId) {
      lastTrackedStatusRef.current = null;
      return;
    }

    const nextStatus = activeBackgroundAnalysis?.status ?? null;
    if (!nextStatus) return;

    const previousStatus = lastTrackedStatusRef.current;
    lastTrackedStatusRef.current = nextStatus;

    if (
      (previousStatus === "pending" || previousStatus === "processing") &&
      (nextStatus === "completed" || nextStatus === "failed" || nextStatus === "rejected")
    ) {
      if (completionNoticeTimerRef.current) {
        clearTimeout(completionNoticeTimerRef.current);
      }

      const messageByStatus: Record<CompletionNotice["status"], string> = {
        completed: "Analysis is ready to review.",
        failed: "Analysis could not be completed.",
        rejected: "Analysis was rejected and needs attention.",
      };

      setBackgroundNotice(null);
      setCompletionNotice({
        analysisId: activeBackgroundAnalysisId,
        status: nextStatus,
        message: messageByStatus[nextStatus],
      });
      AsyncStorage.setItem(LAST_WORKED_ANALYSIS_KEY, activeBackgroundAnalysisId).catch(() => {});
      setLastWorkedAnalysisId(activeBackgroundAnalysisId);
      AsyncStorage.removeItem(PENDING_ANALYSIS_SUMMARY_KEY).catch(() => {});
      setPendingAnalysisSummary(null);
      Haptics.notificationAsync(
        nextStatus === "completed"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );

      completionNoticeTimerRef.current = setTimeout(() => {
        setCompletionNotice(null);
      }, 6000);
    }
  }, [activeBackgroundAnalysis?.status, activeBackgroundAnalysisId]);

  useEffect(() => {
    const hasToast = Boolean(backgroundNotice || completionNotice);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: hasToast ? 1 : 0,
        duration: hasToast ? 180 : 140,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: hasToast ? 0 : 24,
        duration: hasToast ? 220 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backgroundNotice, completionNotice, toastOpacity, toastTranslateY]);

  const deleteMutation = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryAnalysis,
    onSuccess: async (result) => {
      await AsyncStorage.setItem(LAST_WORKED_ANALYSIS_KEY, result.analysisId).catch(() => {});
      await AsyncStorage.setItem(
        BACKGROUND_NOTICE_KEY,
        "Retry started. Processing will continue in the background.",
      ).catch(() => {});
      setLastWorkedAnalysisId(result.analysisId);
      setBackgroundNotice("Retry started. Processing will continue in the background.");
      setPendingAnalysisSummary((current) => {
        if (!current || current.id !== result.analysisId) return current;
        return {
          ...current,
          status: "processing",
          rejectionReason: null,
          updatedAt: new Date().toISOString(),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Retry Failed", error.message || "Could not restart analysis.");
    },
  });

  const handleDelete = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Analysis", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const handleRetry = (item: AnalysisSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Retry Analysis", `Retry processing for "${item.videoFilename}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Retry",
        onPress: () => retryMutation.mutate(item.id),
      },
    ]);
  };

  const isOwner = (item: AnalysisSummary) => item.userId === user?.id;

  const totalAnalyses = visibleAnalyses?.length || 0;
  const completed =
    visibleAnalyses?.filter((a) => a.status === "completed") || [];
  const processing =
    visibleAnalyses?.filter(
      (a) => a.status === "processing" || a.status === "pending",
    ) || [];

  const trendSliceCount =
    selectedTrendSessions === "all"
      ? completed.filter((a) => getSessionOverallScore10(a) != null).length
      : selectedTrendSessions;
  const trendItems = completed
    .filter((a) => getSessionOverallScore10(a) != null)
    .slice(0, trendSliceCount)
    .reverse();
  const trendScores = trendItems.map((a) => getSessionOverallScore10(a) as number);
  const trendDates = trendItems.map((a) =>
    formatMonthDayInTimeZone(getVideoDate(a), profileTimeZone),
  );

  const historyHighlightColor = selectedSport?.color || "#30D158";
  const historyMovementLabel = selectedMovement?.name
    ? toTitleCase(selectedMovement.name.replace(/-/g, " "))
    : null;

  const getPlayerDisplayName = (u: {
    id: string;
    name: string;
    email: string;
    role: string;
  }) => {
    const fullName = String(u.name || "").trim();
    return fullName || String(u.email || "").trim() || "Unknown";
  };

  const selectedPlayerLabel =
    selectedPlayerId === "all"
      ? "All"
      : (() => {
          const selected = userList.find((u) => u.id === selectedPlayerId);
          return selected ? getPlayerDisplayName(selected) : "All";
        })();
  const playerFilterLabel = isAdmin
    ? selectedPlayerLabel
    : user?.name || "Player";
  const deltaByAnalysisId = useMemo(() => {
    const completedByTimeAsc = filteredAnalyses
      .filter((analysis) => analysis.status === "completed")
      .slice()
      .sort((a, b) => (parseApiDate(getVideoDate(a))?.getTime() || 0) - (parseApiDate(getVideoDate(b))?.getTime() || 0));

    const map = new Map<string, { overallPct: number | null; sections: Record<string, number | null> }>();
    for (let idx = 0; idx < completedByTimeAsc.length; idx += 1) {
      const current = completedByTimeAsc[idx];
      const previous = idx > 0 ? completedByTimeAsc[idx - 1] : null;
      const sections: Record<string, number | null> = {};
      for (const sectionKey of SESSION_SECTION_KEYS) {
        sections[sectionKey] = computePercentDelta(
          getSectionScore10(current, sectionKey),
          previous ? getSectionScore10(previous, sectionKey) : null,
        );
      }

      map.set(current.id, {
        overallPct: computePercentDelta(
          getSessionOverallScore10(current),
          previous ? getSessionOverallScore10(previous) : null,
        ),
        sections,
      });
    }

    return map;
  }, [filteredAnalyses]);

  const renderItem = ({ item }: { item: AnalysisSummary }) => (
    <SummaryCard
      item={item}
      deltas={deltaByAnalysisId.get(item.id)}
      isOwner={isOwner(item)}
      isAdmin={isAdmin}
      isHighlighted={item.id === activeBackgroundAnalysisId}
      highlightColor={historyHighlightColor}
      sortMode={selectedHistorySort}
      timeZone={profileTimeZone}
      showBackgroundProcessing={
        item.id === activeBackgroundAnalysisId &&
        isInFlightAnalysisStatus(item.status)
      }
      onPress={() =>
        router.push({
          pathname: "/analysis/[id]",
          params: { id: item.id },
        })
      }
      onDelete={() => handleDelete(item.id, item.videoFilename)}
      onRetry={() => handleRetry(item)}
      retryPending={retryMutation.isPending && retryMutation.variables === item.id}
    />
  );

  const historyControls = (
    <>
      {isAdmin ? (
        <Pressable
          onPress={() => setShowPlayerDropdown((prev) => !prev)}
          style={[
            styles.playerDropdown,
            {
              borderColor: `${historyHighlightColor}55`,
              backgroundColor: `${historyHighlightColor}12`,
            },
          ]}
        >
          <Ionicons name="people" size={15} color={historyHighlightColor} />
          <Text
            style={[styles.playerDropdownText, { color: historyHighlightColor }]}
            numberOfLines={1}
          >
            {selectedPlayerLabel}
          </Text>
          <Ionicons
            name={showPlayerDropdown ? "chevron-up" : "chevron-down"}
            size={14}
            color={historyHighlightColor}
          />
        </Pressable>
      ) : null}

      {historyMovementLabel ? (
        <View
          style={[
            styles.subcategoryBadge,
            {
              backgroundColor: `${historyHighlightColor}12`,
              borderColor: `${historyHighlightColor}40`,
            },
          ]}
        >
          <Ionicons
            name="flash-outline"
            size={11}
            color={historyHighlightColor}
          />
          <Text
            style={[
              styles.subcategoryBadgeText,
              { color: historyHighlightColor },
            ]}
            numberOfLines={1}
          >
            {historyMovementLabel}
          </Text>
        </View>
      ) : null}
    </>
  );

  const listHeader = (
    <View>
      <TabScreenIntro
        title="Track Progress"
        subtitle="Monitor your improvements and track changes"
        controls={historyControls}
      >
        <TabScreenFilterGroup
          action={hasHistoryFilters ? (
            <Pressable
              onPress={clearHistoryFilters}
              style={({ pressed }) => [
                styles.filterResetButton,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.filterResetText, { color: historyHighlightColor }]}>Clear</Text>
            </Pressable>
          ) : null}
        >
          <TabScreenFilterRow>
            {SESSION_TYPE_FILTER_OPTIONS.map((option) => {
              const selected = selectedSessionTypes.includes(option.key);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggleSessionType(option.key)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: selected ? `${historyHighlightColor}66` : "#54545860",
                      backgroundColor: selected ? `${historyHighlightColor}1A` : "#1C1C1E",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selected ? historyHighlightColor : "#8E8E93" },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
            {STROKE_FILTER_OPTIONS.map((option) => {
              const selected = selectedStroke === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggleStroke(option.key)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: selected ? `${historyHighlightColor}66` : "#54545860",
                      backgroundColor: selected ? `${historyHighlightColor}1A` : "#1C1C1E",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selected ? historyHighlightColor : "#8E8E93" },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </TabScreenFilterRow>
        </TabScreenFilterGroup>
      </TabScreenIntro>

      {isAdmin && showPlayerDropdown && (
        <Modal
          transparent
          animationType="none"
          onRequestClose={() => setShowPlayerDropdown(false)}
        >
          <Pressable
            style={styles.playerDropdownOverlay}
            onPress={() => setShowPlayerDropdown(false)}
          >
            <Pressable
              style={styles.playerDropdownMenu}
              onPress={() => {}}
            >
              {[
                { id: "all", name: "All" },
                ...userList.map((u) => ({ id: u.id, name: getPlayerDisplayName(u) })),
              ].map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setSelectedPlayerId(option.id);
                    setShowPlayerDropdown(false);
                  }}
                  style={[
                    styles.playerDropdownItem,
                    option.id === selectedPlayerId && {
                      backgroundColor: `${historyHighlightColor}18`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.playerDropdownItemText,
                      option.id === selectedPlayerId && {
                        color: historyHighlightColor,
                      },
                    ]}
                  >
                    {option.name}
                  </Text>
                  {option.id === selectedPlayerId ? (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={historyHighlightColor}
                    />
                  ) : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {trendScores.length > 1 && (
        <HistoryCollapsibleSection title="Performance Trend" color={historyHighlightColor} defaultOpen={true}>
          <View style={styles.trendCardGradient}>
            <View style={styles.trendHeaderRow}>
              <View style={styles.trendSessionTabs}>
                {TREND_SESSION_FILTERS.map((option) => (
                  <Pressable
                    key={String(option.key)}
                    onPress={() => setSelectedTrendSessions(option.key)}
                    style={[
                      styles.trendSessionTab,
                      selectedTrendSessions === option.key && {
                        borderColor: `${historyHighlightColor}66`,
                        backgroundColor: `${historyHighlightColor}1A`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.trendSessionTabText,
                        {
                          color:
                            selectedTrendSessions === option.key
                              ? historyHighlightColor
                              : "#8E8E93",
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TrendChart data={trendScores} dates={trendDates} />
          </View>
        </HistoryCollapsibleSection>
      )}

      {isAdmin ? (
      <View style={styles.statsRow}>
        {[
          { label: "Total", value: totalAnalyses, color: "#0A84FF" },
          { label: "Processing", value: processing.length, color: "#FFD60A" },
          { label: "Done", value: completed.length, color: "#30D158" },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      ) : null}

      {filteredAnalyses.length > 0 && (
        <View style={styles.recentHeaderRow}>
          <Text style={styles.recentTitle}>
            {selectedHistorySort === "upload" ? "Recent Uploads" : "Recent Sessions"}
          </Text>
          <View
            style={[
              styles.recentSortToggle,
              {
                borderColor: `${historyHighlightColor}45`,
                backgroundColor: `${historyHighlightColor}10`,
              },
            ]}
          >
            {HISTORY_SORT_OPTIONS.map((option) => {
              const selected = selectedHistorySort === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSelectedHistorySort(option.key)}
                  style={[
                    styles.recentSortOption,
                    selected && {
                      backgroundColor: `${historyHighlightColor}22`,
                      borderColor: `${historyHighlightColor}55`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.recentSortText,
                      { color: selected ? historyHighlightColor : "#8E8E93" },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── AI Session Insight (lazy-loads with scroll) ── */}
      {!isAdmin && completed.length >= 2 && (() => {
        const recent = completed.slice(0, 5);
        const sectionKeys = ["technical", "tactical", "movement"] as const;
        const avgBySection = sectionKeys.map((key) => {
          const vals = recent
            .map((a) => getSectionScore10(a, key))
            .filter((v): v is number => v != null);
          return {
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
          };
        });
        const weakest = avgBySection
          .filter((s) => s.avg != null)
          .sort((a, b) => (a.avg as number) - (b.avg as number))[0];
        if (!weakest) return null;
        const tipMap: Record<string, string> = {
          technical: "Focus on form checkpoints — slow reps with a finish hold will accelerate gains.",
          tactical: "Work on shot selection under pressure — pattern drills with recovery help most.",
          movement: "Bolster footwork and balance — split-step drills and lateral shuffles pay off fast.",
        };
        return (
          <View style={[styles.aiInsightCard, { borderColor: `${historyHighlightColor}30` }]}>
            <View style={styles.aiInsightBadge}>
              <Ionicons name="sparkles" size={12} color="#BF5AF2" />
              <Text style={styles.aiInsightBadgeText}>AI Insight</Text>
            </View>
            <Text style={styles.aiInsightTitle}>
              {weakest.label} needs attention ({weakest.avg!.toFixed(1)}/10)
            </Text>
            <Text style={styles.aiInsightTip}>
              {tipMap[weakest.key] || "Keep at it — consistency is the key to improvement."}
            </Text>
          </View>
        );
      })()}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.toastLayer,
          {
            bottom: insets.bottom + 88,
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
          },
        ]}
      >
        {backgroundNotice ? (
          <View style={styles.backgroundNoticeCard}>
            <View style={styles.backgroundNoticeIconWrap}>
              <Ionicons name="time-outline" size={16} color="#0A84FF" />
            </View>
            <Text style={styles.backgroundNoticeText}>{backgroundNotice}</Text>
          </View>
        ) : null}

        {completionNotice ? (
          <View style={styles.completionNoticeCard}>
            <View style={styles.completionNoticeCopy}>
              <View style={styles.completionNoticeIconWrap}>
                <Ionicons
                  name={completionNotice.status === "completed" ? "checkmark-circle" : "alert-circle"}
                  size={18}
                  color={completionNotice.status === "completed" ? "#30D158" : "#FFD60A"}
                />
              </View>
              <Text style={styles.completionNoticeText}>{completionNotice.message}</Text>
            </View>
            {completionNotice.status === "completed" ? (
              <Pressable
                onPress={() => {
                  setCompletionNotice(null);
                  router.push({
                    pathname: "/analysis/[id]",
                    params: { id: completionNotice.analysisId },
                  });
                }}
                style={({ pressed }) => [
                  styles.completionNoticeButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.completionNoticeButtonText}>Open</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setCompletionNotice(null)}
                style={({ pressed }) => [
                  styles.completionNoticeButton,
                  styles.completionNoticeDismissButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.completionNoticeButtonText}>Dismiss</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </Animated.View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0A84FF" />
        </View>
      ) : (
        <FlatList
          data={visibleAnalyses.slice(0, visibleCount)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#0A84FF"
            />
          }
          onScroll={handleTabBarScroll}
          scrollEventThrottle={16}
          onEndReached={() => setVisibleCount((c) => Math.min(c + 10, visibleAnalyses.length))}
          onEndReachedThreshold={0.4}
          scrollEnabled
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="folder-open-outline"
                  size={36}
                  color="#48484A"
                />
              </View>
              <Text style={styles.emptyTitle}>No analysis history</Text>
              <Text style={styles.emptyText}>
                {hasHistoryFilters
                  ? "No sessions match the selected session type and focus filters"
                  : isAdmin
                    ? "Uploads, retries, and review items will appear here as analyses arrive"
                    : "Upload and analyze videos to see them here"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  aiInsightCard: {
    borderRadius: 14,
    backgroundColor: ds.color.bgElevated,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  aiInsightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(191,90,242,0.12)",
    marginBottom: 10,
  },
  aiInsightBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BF5AF2",
  },
  aiInsightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: ds.color.textPrimary,
    marginBottom: 4,
  },
  aiInsightTip: {
    fontSize: 13,
    color: ds.color.textSecondary,
    lineHeight: 18,
  },
  headerSection: {
    marginTop: 20,
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: "#8E8E93",
    maxWidth: 620,
  },
  topControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  filterSection: {
    gap: 12,
    marginBottom: 20,
  },
  filterGroup: {
    gap: 8,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#AEAEB2",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 34,
    justifyContent: "center",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  filterResetButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  filterResetText: {
    fontSize: 11,
    fontWeight: "600",
  },
  playerDropdown: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: "58%",
  },
  playerDropdownText: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 130,
  },
  playerDropdownReadonly: {
    justifyContent: "flex-start",
  },
  playerDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    paddingTop: 160,
    paddingHorizontal: 20,
  },
  playerDropdownMenu: {
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    maxHeight: 260,
    overflow: "hidden",
  },
  playerDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerDropdownItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: ds.color.textSecondary,
  },
  subcategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "58%",
  },
  subcategoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  compactReviewSummaryCard: {
    gap: 12,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54545840",
    backgroundColor: "#1C1C1E",
    padding: 14,
  },
  compactReviewSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  compactReviewSummaryCopy: {
    flex: 1,
    gap: 3,
  },
  compactReviewSummaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  compactReviewSummarySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  compactReviewSummaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#1C1C1E",
    borderColor: "rgba(84,84,88,0.36)",
  },
  compactReviewSummaryToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  compactReviewSummaryMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  compactReviewSummaryMetric: {
    flex: 1,
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  compactReviewSummaryMetricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  compactReviewSummaryMetricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  adminOverviewSection: {
    gap: 14,
    marginBottom: 12,
  },
  adminMetricGrid: {
    flexDirection: "row",
    gap: 10,
  },
  reviewMetricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54545840",
    backgroundColor: "#1C1C1E",
    padding: 14,
    gap: 6,
  },
  reviewMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewMetricLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
  },
  reviewMetricValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  reviewMetricHelper: {
    fontSize: 11,
    lineHeight: 16,
    color: "#636366",
  },
  adminSectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54545840",
    backgroundColor: "#1C1C1E",
    padding: 14,
    gap: 12,
  },
  adminSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  adminSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  adminSectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#8E8E93",
  },
  adminSectionCount: {
    minWidth: 28,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#2C2C2E",
    color: "#AEAEB2",
    textAlign: "center" as const,
    fontSize: 11,
    fontWeight: "700",
  },
  reviewQueueList: {
    gap: 10,
  },
  reviewQueueItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    padding: 12,
    gap: 10,
  },
  reviewQueueTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewQueueMeta: {
    flex: 1,
    gap: 2,
  },
  reviewQueuePlayer: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  reviewQueueVideo: {
    fontSize: 12,
    color: "#8E8E93",
  },
  reviewQueueStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewQueueStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reviewQueueBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewQueueTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  reviewQueueTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.36)",
  },
  reviewQueueTagText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#AEAEB2",
  },
  reviewQueueScoreText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  playerPulseList: {
    gap: 10,
  },
  playerPulseCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    padding: 12,
    gap: 4,
  },
  playerPulseTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  playerPulseName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  playerPulseSelectedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  playerPulseSelectedText: {
    fontSize: 10,
    fontWeight: "700",
  },
  playerPulseScore: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  playerPulseMeta: {
    fontSize: 12,
    fontWeight: "500",
    color: "#AEAEB2",
  },
  playerPulseSubtle: {
    fontSize: 11,
    color: "#636366",
  },
  adminEmptyText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#636366",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#54545840",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#C7C7CC",
    fontSize: 14,
    paddingVertical: 0,
  },
  toastLayer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 30,
    gap: 10,
    pointerEvents: "box-none" as const,
  },
  backgroundNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0A84FF40",
    backgroundColor: "#172554EE",
    shadowColor: "#020617",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  backgroundNoticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000080",
  },
  backgroundNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#DBEAFE",
  },
  completionNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#30D15840",
    backgroundColor: "#052E2BCC",
    shadowColor: "#020617",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  completionNoticeCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  completionNoticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000080",
  },
  completionNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  completionNoticeButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#30D15822",
    borderWidth: 1,
    borderColor: "#30D15850",
  },
  completionNoticeDismissButton: {
    backgroundColor: "#FFD60A16",
    borderColor: "#FFD60A40",
  },
  completionNoticeButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  trendCardGradient: {
    // Content lives inside HistoryCollapsibleSection — no extra border/radius needed
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 4,
  },
  trendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  trendSessionTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendSessionTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#00000080",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trendSessionTabText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8E8E93",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(84,84,88,0.36)",
    backgroundColor: "#1C1C1E",
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  statCardGradient: {
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545840",
    backgroundColor: "#1C1C1E",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    color: "#636366",
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  recentSortToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  recentSortOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recentSortText: {
    fontSize: 10,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#54545860",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center" as const,
    paddingHorizontal: 40,
    color: "#636366",
  },
});
