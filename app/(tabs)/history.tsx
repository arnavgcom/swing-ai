
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
  TextInput,
  ScrollView,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchAnalysesSummary, deleteAnalysis, retryAnalysis } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import {
  DEFAULT_SESSION_TYPE_FILTERS,
  filterAnalysesBySessionAndStroke,
  SESSION_TYPE_FILTER_OPTIONS,
  STROKE_FILTER_OPTIONS,
  type SessionTypeFilter,
  type StrokeTypeFilter,
} from "@/lib/analysis-filters";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatMonthDayInTimeZone,
  parseApiDate,
  resolveUserTimeZone,
} from "@/lib/timezone";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

const LAST_WORKED_ANALYSIS_KEY = "swingai_last_worked_analysis_id";
const BACKGROUND_NOTICE_KEY = "swingai_background_processing_notice";
const PENDING_ANALYSIS_SUMMARY_KEY = "swingai_pending_analysis_summary";

type CompletionNotice = {
  analysisId: string;
  status: "completed" | "failed" | "rejected";
  message: string;
};

function TrendChart({ data, dates }: { data: number[]; dates: string[] }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = Math.max(maxVal - minVal, 10);
  const chartHeight = 30;
  const yLabelWidth = 28;
  const chartWidth = 260;
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
                  backgroundColor: "#34D399",
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
                    i === points.length - 1 ? "#34D399" : "#34D39960",
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
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "right" as const,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "#2A2A5020",
  },
  dot: { position: "absolute" },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  xLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
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
  if (deltaPct == null) return "#64748B";
  if (Math.abs(deltaPct) < 1e-6) return "#94A3B8";
  return deltaPct >= 0 ? "#34D399" : "#F87171";
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
    pending: { color: "#FBBF24", label: "Pending" },
    processing: { color: "#60A5FA", label: "Processing" },
    completed: { color: "#34D399", label: "Completed" },
    failed: { color: "#F87171", label: "Failed Processing" },
    rejected: { color: "#EF4444", label: "Rejected" },
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
                  <Ionicons name="close-circle-outline" size={11} color="#EF4444" />
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
          <Ionicons name="chevron-forward" size={16} color="#475569" />
        </View>
      </View>

      {failureMessage ? (
        <View style={summaryStyles.failureMessageWrap}>
          <Ionicons name="alert-circle-outline" size={13} color="#FCA5A5" />
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
                <ActivityIndicator size="small" color="#FEE2E2" />
              ) : (
                <Ionicons name="refresh" size={12} color="#FEE2E2" />
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
          <Ionicons name="trash-outline" size={13} color="#F87171" />
        </Pressable>
      )}
    </Pressable>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: "#15152D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
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
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  playerNameText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#A29BFE",
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
    fontFamily: "Inter_600SemiBold",
  },
  compactPlayerBadge: {
    backgroundColor: "#A29BFE12",
    borderColor: "#A29BFE30",
  },
  compactPlayerBadgeText: {
    color: "#A29BFE",
  },
  compactSessionBadge: {
    backgroundColor: "#93C5FD12",
    borderColor: "#93C5FD30",
  },
  compactSessionBadgeText: {
    color: "#93C5FD",
  },
  compactFocusBadge: {
    backgroundColor: "#34D39912",
    borderColor: "#34D39930",
  },
  compactFocusBadgeText: {
    color: "#34D399",
  },
  rejectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "#EF444414",
    borderWidth: 1,
    borderColor: "#EF444430",
  },
  rejectedBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#EF4444",
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
    backgroundColor: "#0A0A1A90",
    borderWidth: 1,
    borderColor: "#334155",
  },
  inlineProcessingBadge: {
    marginTop: 0,
  },
  backgroundProcessingBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  scoreText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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
    borderColor: "#7F1D1D",
    backgroundColor: "#450A0A66",
  },
  failureContent: {
    flex: 1,
    gap: 8,
  },
  failureMessageText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    color: "#FECACA",
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
    borderColor: "#7F1D1D",
    backgroundColor: "#7F1D1D66",
  },
  retryButtonDisabled: {
    backgroundColor: "#4B556380",
    borderColor: "#6B7280",
  },
  retryButtonText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#FEE2E2",
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
    backgroundColor: "#0A0A1A50",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#2A2A5020",
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
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
    fontFamily: "Inter_500Medium",
    color: "#64748B",
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
    fontFamily: "Inter_600SemiBold",
  },
  metricDeltaText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
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
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [selectedTrendSessions, setSelectedTrendSessions] = useState<TrendSessionWindow>(10);
  const [userList, setUserList] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<SessionTypeFilter[]>(
    DEFAULT_SESSION_TYPE_FILTERS,
  );
  const [selectedStroke, setSelectedStroke] = useState<StrokeTypeFilter | null>(null);
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
    queryKey: ["analyses-summary"],
    queryFn: fetchAnalysesSummary,
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
    let result = filteredBySessionAndStroke.filter((item) =>
      matchesAnalysisSearch(item, searchQuery, profileTimeZone),
    );

    return result;
  }, [filteredBySessionAndStroke, profileTimeZone, searchQuery]);

  const pendingSummaryVisible = useMemo(() => {
    if (!pendingAnalysisSummary) return null;
    if (
      pendingAnalysisSummary.status !== "pending"
      && pendingAnalysisSummary.status !== "processing"
    ) {
      return null;
    }

    if (filteredAnalyses.some((item) => item.id === pendingAnalysisSummary.id)) {
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

    if (!matchesAnalysisSearch(pendingAnalysisSummary, searchQuery, profileTimeZone)) {
      return null;
    }

    return pendingAnalysisSummary;
  }, [
    filteredAnalyses,
    isAdmin,
    pendingAnalysisSummary,
    profileTimeZone,
    searchQuery,
    selectedSessionTypes,
    selectedMovement?.name,
    selectedPlayerId,
    selectedSport?.name,
    selectedStroke,
    user?.id,
  ]);

  const visibleAnalyses = useMemo(() => {
    if (!pendingSummaryVisible) return filteredAnalyses;
    return [pendingSummaryVisible, ...filteredAnalyses];
  }, [filteredAnalyses, pendingSummaryVisible]);

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

  const historyHighlightColor = selectedSport?.color || "#34D399";
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
    const completedByTimeAsc = visibleAnalyses
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
  }, [visibleAnalyses]);

  const renderItem = ({ item }: { item: AnalysisSummary }) => (
    <SummaryCard
      item={item}
      deltas={deltaByAnalysisId.get(item.id)}
      isOwner={isOwner(item)}
      isAdmin={isAdmin}
      isHighlighted={item.id === activeBackgroundAnalysisId}
      highlightColor={historyHighlightColor}
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

  const listHeader = (
    <View>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Track Progress</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#64748B" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search"
          placeholderTextColor="#64748B"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <View style={styles.topControlsRow}>
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
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterGroup}>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterLabel}>Session Type</Text>
            {hasHistoryFilters ? (
              <Pressable
                onPress={clearHistoryFilters}
                style={({ pressed }) => [
                  styles.filterResetButton,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.filterResetText, { color: historyHighlightColor }]}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.filterChipRow}>
            {SESSION_TYPE_FILTER_OPTIONS.map((option) => {
              const selected = selectedSessionTypes.includes(option.key);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggleSessionType(option.key)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: selected ? `${historyHighlightColor}66` : "#2A2A5060",
                      backgroundColor: selected ? `${historyHighlightColor}1A` : "#101426",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selected ? historyHighlightColor : "#94A3B8" },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Stroke Type</Text>
          <View style={styles.filterChipRow}>
            {STROKE_FILTER_OPTIONS.map((option) => {
              const selected = selectedStroke === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggleStroke(option.key)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: selected ? "#34D39955" : "#2A2A5060",
                      backgroundColor: selected ? "#34D39918" : "#101426",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selected ? "#34D399" : "#94A3B8" },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

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
        <View style={styles.trendCard}>
          <View style={styles.trendCardGradient}>
            <View style={styles.trendHeaderRow}>
              <Text style={styles.trendLabel}>Overall Performance Trend</Text>
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
                              : "#94A3B8",
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
        </View>
      )}

      <View style={styles.statsRow}>
        {[
          {
            label: "Total",
            value: totalAnalyses,
            color: "#6C5CE7",
            icon: "analytics" as const,
          },
          {
            label: "In Progress",
            value: processing.length,
            color: "#60A5FA",
            icon: "pulse" as const,
          },
          {
            label: "Done",
            value: completed.length,
            color: "#34D399",
            icon: "checkmark-circle" as const,
          },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <LinearGradient
              colors={[stat.color + "14", stat.color + "06"]}
              style={styles.statCardGradient}
            >
              <Ionicons name={stat.icon} size={18} color={stat.color} />
              <Text style={[styles.statNumber, { color: stat.color }]}>
                {stat.value}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      {filteredAnalyses.length > 0 && (
        <View style={styles.recentHeaderRow}>
          <Text style={styles.recentTitle}>Recent Sessions</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <TabHeader />

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
              <Ionicons name="time-outline" size={16} color="#60A5FA" />
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
                  color={completionNotice.status === "completed" ? "#34D399" : "#FBBF24"}
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
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      ) : (
        <FlatList
          data={visibleAnalyses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#6C5CE7"
            />
          }
          scrollEnabled
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="folder-open-outline"
                  size={36}
                  color="#475569"
                />
              </View>
              <Text style={styles.emptyTitle}>No analysis history</Text>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? "No sessions match your search"
                  : hasHistoryFilters
                    ? "No sessions match the selected session and stroke filters"
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
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  headerSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  topControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  filterSection: {
    gap: 12,
    marginBottom: 16,
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
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
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
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  filterResetButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  filterResetText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: "58%",
  },
  playerDropdownText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 130,
  },
  playerDropdownReadonly: {
    justifyContent: "flex-start",
  },
  playerDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    paddingTop: 140,
    paddingHorizontal: 20,
  },
  playerDropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
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
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  subcategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "58%",
  },
  subcategoryBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    backgroundColor: "#15152D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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
    borderColor: "#60A5FA40",
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
    backgroundColor: "#0A0A1A80",
  },
  backgroundNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
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
    borderColor: "#34D39940",
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
    backgroundColor: "#0A0A1A80",
  },
  completionNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
    color: "#DCFCE7",
  },
  completionNoticeButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#34D39922",
    borderWidth: 1,
    borderColor: "#34D39950",
  },
  completionNoticeDismissButton: {
    backgroundColor: "#FBBF2416",
    borderColor: "#FBBF2440",
  },
  completionNoticeButtonText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  trendCard: {
    backgroundColor: "#15152D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    overflow: "hidden",
    marginBottom: 16,
  },
  trendCardGradient: {
    padding: 12,
    borderRadius: 16,
  },
  trendLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
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
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A80",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trendSessionTabText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  statCardGradient: {
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    backgroundColor: "#15152D",
  },
  statNumber: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  recentTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
    paddingHorizontal: 40,
    color: "#64748B",
  },
});
