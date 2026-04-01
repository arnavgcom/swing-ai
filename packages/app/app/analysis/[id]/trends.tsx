import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Line, Polyline, Circle, Polygon } from "react-native-svg";
import {
  getAnalysisRefreshIntervalMs,
  getCompletedAnalysisEnrichmentMessage,
} from "@/utils/analysis-refresh";
import {
  fetchAnalysisDetail,
  fetchAnalysisMetricTrends,
  fetchSportConfig,
  type SportCategoryConfig,
} from "@/services/api";
import { useAuth } from "@/contexts/auth-context";
import { formatMonthDayInTimeZone, resolveUserTimeZone } from "@/utils/timezone";
import { normalizeMetricSelectionKey } from "@/utils/metrics-catalog";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

const SESSION_FILTERS = [
  { key: 5, label: "5S" },
  { key: 10, label: "10S" },
  { key: 25, label: "25S" },
  { key: "all", label: "All" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  biomechanics: "Technical (BIOMEC)",
  ball: "Ball Metrics",
  timing: "Timing & Rhythm",
  technique: "Technique",
  power: "Power",
};

const LEGACY_SECTION_LABEL_MAP: Record<string, "technical" | "tactical" | "movement"> = {
  "technical (biomec)": "technical",
  technical: "technical",
  biomechanics: "technical",
  tactical: "tactical",
  "performance breakdown": "tactical",
  movement: "movement",
};

const SECTION_COMPONENTS: Record<
  "technical" | "tactical" | "movement",
  Array<{ key: string; label: string }>
> = {
  technical: [
    { key: "balance", label: "Balance" },
    { key: "inertia", label: "Inertia" },
    { key: "oppositeForce", label: "Opposite Force" },
    { key: "momentum", label: "Momentum" },
    { key: "elastic", label: "Elastic" },
    { key: "contact", label: "Contact" },
  ],
  tactical: [
    { key: "power", label: "Power" },
    { key: "control", label: "Control" },
    { key: "timing", label: "Timing" },
    { key: "technique", label: "Technique" },
  ],
  movement: [
    { key: "ready", label: "Ready" },
    { key: "read", label: "Read" },
    { key: "react", label: "React" },
    { key: "respond", label: "Respond" },
    { key: "recover", label: "Recover" },
  ],
};

const HISTORICAL_SCORE_SECTIONS: Array<"technical" | "tactical" | "movement"> = [
  "technical",
  "tactical",
  "movement",
];

function toSportPreferenceKey(sportName?: string | null): string {
  return String(sportName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-/g, "");
}

function normalizeScoreSectionSelection(value: string): "technical" | "tactical" | "movement" | null {
  const normalized = String(value || "").trim().toLowerCase();
  return LEGACY_SECTION_LABEL_MAP[normalized] || null;
}

const MPH_TO_KMPH = 1.60934;

function isMphUnit(unit?: string): boolean {
  return String(unit || "").trim().toLowerCase() === "mph";
}

function toDisplaySpeed(value: number): number {
  return value * MPH_TO_KMPH;
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

function formatDateLabel(value: string, timeZone?: string): string {
  return formatMonthDayInTimeZone(value, timeZone);
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

function formatDeltaPercent(deltaPct: number | null): string {
  if (deltaPct == null) return "";
  if (Math.abs(deltaPct) < 1e-6) return "  (-)";
  return `  (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`;
}

type SeriesPoint = {
  label: string;
  value: number;
};

function MetricTrendChart({ points, color }: { points: SeriesPoint[]; color: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!points.length) {
    return <Text style={styles.metricEmpty}>No trend data</Text>;
  }

  const width = SCREEN_WIDTH - 40 - 24;
  const height = 136;
  const leftPadding = 8;
  const rightPadding = 8;
  const topPadding = 10;
  const bottomPadding = 28;
  const innerWidth = width - leftPadding - rightPadding;
  const innerHeight = height - topPadding - bottomPadding;

  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const range = Math.max(maxValue - minValue, 1);

  const toX = (index: number) =>
    leftPadding + (points.length > 1 ? (innerWidth * index) / (points.length - 1) : innerWidth / 2);
  const toY = (value: number) => topPadding + (1 - (value - minValue) / range) * innerHeight;

  const polyline = points
    .map((point, index) => `${toX(index)},${toY(point.value)}`)
    .join(" ");
  const areaPoints = `${leftPadding},${height - bottomPadding} ${polyline} ${width - rightPadding},${height - bottomPadding}`;

  const xLabelStep =
    points.length <= 6
      ? 1
      : points.length <= 12
        ? 2
        : points.length <= 20
          ? 3
          : 4;

  const getIndexFromX = (x: number): number => {
    if (points.length <= 1) return 0;
    const clampedX = Math.max(leftPadding, Math.min(width - rightPadding, x));
    const ratio = (clampedX - leftPadding) / innerWidth;
    return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
  };

  const focusedIndex = activeIndex ?? points.length - 1;
  const focusedPoint = points[focusedIndex];
  const focusX = toX(focusedIndex);
  const focusY = toY(focusedPoint.value);
  const tooltipWidth = 96;
  const tooltipLeft = Math.max(
    leftPadding,
    Math.min(width - rightPadding - tooltipWidth, focusX - tooltipWidth / 2),
  );
  return (
    <View>
      <View
        style={styles.chartInteractiveWrap}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          setActiveIndex(getIndexFromX(event.nativeEvent.locationX));
        }}
        onResponderMove={(event) => {
          setActiveIndex(getIndexFromX(event.nativeEvent.locationX));
        }}
        onResponderRelease={() => setActiveIndex(null)}
        onResponderTerminate={() => setActiveIndex(null)}
      >
        <Svg width={width} height={height}>
          {[0, 0.25, 0.5, 0.75, 1].map((tick, idx) => {
            const y = topPadding + tick * innerHeight;
            return (
              <Line
                key={`grid-${idx}`}
                x1={leftPadding}
                y1={y}
                x2={width - rightPadding}
                y2={y}
                stroke="#33415555"
                strokeWidth={1}
              />
            );
          })}

          <Polygon points={areaPoints} fill={`${color}1F`} />

          <Polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <Line
            x1={focusX}
            y1={topPadding}
            x2={focusX}
            y2={height - bottomPadding}
            stroke={`${color}88`}
            strokeWidth={1}
          />

          {points.map((point, index) => (
            <Circle
              key={`dot-${index}`}
              cx={toX(index)}
              cy={toY(point.value)}
              r={index === focusedIndex ? 4 : 2.5}
              fill={index === focusedIndex ? "#FFFFFF" : color}
              stroke={color}
              strokeWidth={index === focusedIndex ? 2 : 0}
            />
          ))}
        </Svg>

        {activeIndex !== null ? (
          <View style={[styles.chartTooltip, { left: tooltipLeft, top: Math.max(0, focusY - 36) }]}>
            <Text style={styles.chartTooltipValue}>{focusedPoint.value.toFixed(1)}</Text>
            <Text style={styles.chartTooltipLabel}>{focusedPoint.label}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.chartValueRow}>
        <Text style={styles.chartValueText}>Min {minValue.toFixed(1)}</Text>
        <Text style={styles.chartValueText}>Max {maxValue.toFixed(1)}</Text>
      </View>

      <View style={styles.chartLabelsRow}>
        {points.map((point, index) => {
          const show =
            index === 0 ||
            index === points.length - 1 ||
            index % xLabelStep === 0;
          return (
            <Text key={`label-${index}`} style={styles.chartLabel} numberOfLines={1}>
              {show ? point.label : ""}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AnalysisMetricTrendsScreen() {
  const { id, focusMetric, focusSection } = useLocalSearchParams<{
    id: string;
    focusMetric?: string;
    focusSection?: "overall" | "breakdown";
  }>();
  const [sessionFilter, setSessionFilter] = useState<(typeof SESSION_FILTERS)[number]["key"]>(10);
  const scrollRef = useRef<ScrollView>(null);
  const [metricOffsets, setMetricOffsets] = useState<Record<string, number>>({});
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileTimeZone = resolveUserTimeZone(user);
  const enrichmentPendingRef = useRef(false);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: "/analysis/[id]",
      params: { id },
    });
  };

  const { data: analysisDetail } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
    refetchInterval: (query) => getAnalysisRefreshIntervalMs(
      query.state.data?.analysis?.status,
      query.state.data?.metrics?.aiDiagnostics,
    ),
  });

  const configKey = analysisDetail?.metrics?.configKey;

  const { data: sportConfig } = useQuery({
    queryKey: ["sport-config", configKey],
    queryFn: () => fetchSportConfig(configKey!),
    enabled: !!configKey,
  });

  const {
    data: trendData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["analysis", id, "metric-trends", "all-sessions"],
    queryFn: () => fetchAnalysisMetricTrends(id!, "all"),
    enabled: !!id,
    retry: false,
    refetchInterval: getAnalysisRefreshIntervalMs(
      analysisDetail?.analysis?.status,
      analysisDetail?.metrics?.aiDiagnostics,
    ),
  });

  const enrichmentMessage = useMemo(
    () => getCompletedAnalysisEnrichmentMessage(
      analysisDetail?.analysis?.status,
      analysisDetail?.metrics?.aiDiagnostics,
    ),
    [analysisDetail?.analysis?.status, analysisDetail?.metrics?.aiDiagnostics],
  );

  const allPoints = trendData?.points || [];

  const points = useMemo(() => {
    if (sessionFilter === "all") return allPoints;
    return allPoints.slice(-sessionFilter);
  }, [allPoints, sessionFilter]);

  const overallTrendPoints = useMemo(
    () =>
      points
        .map((point) => {
          const value = Number(point.overallScore);
          if (!Number.isFinite(value)) return null;
          return {
            label: formatDateLabel(point.capturedAt, profileTimeZone),
            value: value / 10,
          };
        })
        .filter((point): point is SeriesPoint => point !== null),
    [points, profileTimeZone],
  );

  const selectedSportKey = useMemo(
    () => toSportPreferenceKey(sportConfig?.sportName),
    [sportConfig?.sportName],
  );

  const selectedMetricKeys = useMemo(() => {
    const metricMap =
      user?.selectedMetricKeysBySport && typeof user.selectedMetricKeysBySport === "object"
        ? user.selectedMetricKeysBySport
        : {};
    const scoped = selectedSportKey ? metricMap[selectedSportKey] : null;
    const fallback = Array.isArray(user?.selectedMetricKeys) ? user.selectedMetricKeys : [];
    const source = Array.isArray(scoped) ? scoped : fallback;

    return Array.from(
      new Set(
        source
          .map((entry) => normalizeMetricSelectionKey(String(entry || "")))
          .filter((entry) => entry.length > 0),
      ),
    );
  }, [selectedSportKey, user?.selectedMetricKeys, user?.selectedMetricKeysBySport]);

  const sectionTrendSeries = useMemo(() => {
    return HISTORICAL_SCORE_SECTIONS.map((section) => {
      const pointsForSection = points
        .map((point) => {
          const raw = point.sectionScores?.[section];
          const value = Number(raw);
          if (!Number.isFinite(value)) return null;
          return {
            label: formatDateLabel(point.capturedAt, profileTimeZone),
            value,
          };
        })
        .filter((point): point is SeriesPoint => point !== null);

      return {
        key: section,
        label:
          section === "technical"
            ? "Technical Score"
            : section === "tactical"
              ? "Tactical Score"
              : "Movement Score",
        color:
          section === "technical"
            ? "#0A84FF"
            : section === "tactical"
              ? "#30D158"
              : "#FF9F0A",
        unit: "/10",
        points: pointsForSection,
      };
    });
  }, [points, profileTimeZone]);

  const orderedMetrics = useMemo(() => {
    if (!sportConfig) return [] as SportCategoryConfig["metrics"];

    const metrics = [...sportConfig.metrics];
    const hasShotSpeedData = allPoints.some((point) => {
      const value = Number(point.metricValues?.shotSpeed);
      return Number.isFinite(value) && value > 0;
    });

    if (hasShotSpeedData && !metrics.some((metric) => metric.key === "shotSpeed")) {
      metrics.push({
        key: "shotSpeed",
        label: "Shot Speed",
        unit: "kmph",
        icon: "speedometer-outline",
        category: "ball",
        color: "#FF9F0A",
        description: "Normalized shot speed across sessions.",
      });
    }

    const sorted = metrics.sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" }),
    );

    if (!selectedMetricKeys.length) return sorted;

    const selected = new Set(selectedMetricKeys);
    return sorted.filter((metric) => selected.has(normalizeMetricSelectionKey(metric.key)));
  }, [allPoints, selectedMetricKeys, sportConfig]);

  useEffect(() => {
    const enrichmentPending = Boolean(enrichmentMessage);
    const shouldRefetch = enrichmentPendingRef.current && !enrichmentPending && !!id;

    if (shouldRefetch) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analysis", id] }),
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "metric-trends", "all-sessions"] }),
      ]);
    }

    enrichmentPendingRef.current = enrichmentPending;
  }, [enrichmentMessage, id, queryClient]);

    useEffect(() => {
    const targetSection = String(focusSection || "").trim().toLowerCase();
    if (targetSection === "overall" || targetSection === "breakdown") {
      const sectionY = sectionOffsets[targetSection];
      if (typeof sectionY !== "number") return;

      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, sectionY - 10) });
      }, 0);

      return () => clearTimeout(timer);
    }

    const targetKey = String(focusMetric || "").trim();
    if (!targetKey) return;
    const targetOffset = metricOffsets[targetKey];
    if (typeof targetOffset !== "number") return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, targetOffset - 10) });
    }, 0);

    return () => clearTimeout(timer);
  }, [focusMetric, focusSection, metricOffsets, sectionOffsets, sessionFilter]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#000000", "#1C1C1E", "#000000"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.78 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topTitle}>Historical Performance</Text>
        <View style={styles.navButton} />
      </View>

      <View style={styles.periodRow}>
        {SESSION_FILTERS.map((option) => (
          <Pressable
            key={String(option.key)}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSessionFilter(option.key);
            }}
            style={({ pressed }) => [
              styles.periodPill,
              sessionFilter === option.key && styles.periodPillActive,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.periodText, sessionFilter === option.key && styles.periodTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#0A84FF" />
        </View>
      ) : isError || !sportConfig ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>Unable to load trend data</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {enrichmentMessage ? (
            <GlassCard style={styles.enrichmentNotice}>
              <View style={styles.enrichmentNoticeRow}>
                <ActivityIndicator size="small" color="#64D2FF" />
                <Text style={styles.enrichmentNoticeText}>{enrichmentMessage}</Text>
              </View>
            </GlassCard>
          ) : null}

          <View
            onLayout={(event) => {
              const nextY = event.nativeEvent.layout.y;
              setSectionOffsets((prev) => (prev.overall === nextY ? prev : { ...prev, overall: nextY }));
            }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Overall Score</Text>
            <GlassCard style={styles.metricTrendCard}>
              <View style={styles.metricHeaderRow}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#0A84FF1F" }]}>
                  <Ionicons name="stats-chart" size={14} color="#0A84FF" />
                </View>
                <View style={styles.metricTitleWrap}>
                  <Text style={styles.metricTitle}>Overall Score Trend</Text>
                  {(() => {
                    const latest = overallTrendPoints.length ? overallTrendPoints[overallTrendPoints.length - 1].value : null;
                    const previous = overallTrendPoints.length > 1 ? overallTrendPoints[overallTrendPoints.length - 2].value : null;
                    const deltaPct = computePercentDelta(latest, previous);
                    return (
                  <Text style={styles.metricSubTitle}>
                    Latest: {latest !== null ? latest.toFixed(2) : "-"}
                    {formatDeltaPercent(deltaPct)}
                  </Text>
                    );
                  })()}
                </View>
              </View>
              <MetricTrendChart points={overallTrendPoints} color="#0A84FF" />
            </GlassCard>
          </View>

          <View
            onLayout={(event) => {
              const nextY = event.nativeEvent.layout.y;
              setSectionOffsets((prev) => (prev.breakdown === nextY ? prev : { ...prev, breakdown: nextY }));
            }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Score Trends</Text>
            {sectionTrendSeries.map((scoreTrend) => {
              const latestValue = scoreTrend.points.length
                ? scoreTrend.points[scoreTrend.points.length - 1].value
                : null;
              const previousValue = scoreTrend.points.length > 1
                ? scoreTrend.points[scoreTrend.points.length - 2].value
                : null;
              const deltaPct = computePercentDelta(latestValue, previousValue);
              return (
                <GlassCard key={scoreTrend.key} style={styles.metricTrendCard}>
                  <View style={styles.metricHeaderRow}>
                    <View style={[styles.metricIconWrap, { backgroundColor: `${scoreTrend.color}1F` }]}>
                      <Ionicons name="pulse" size={14} color={scoreTrend.color} />
                    </View>
                    <View style={styles.metricTitleWrap}>
                      <Text style={styles.metricTitle}>{scoreTrend.label}</Text>
                      <Text style={[styles.metricSubTitle, { color: deltaPct != null ? deltaColor(deltaPct) : "#8E8E93" }]}>
                        Latest: {latestValue !== null ? latestValue.toFixed(2) : "-"} {scoreTrend.unit}
                        {formatDeltaPercent(deltaPct)}
                      </Text>
                    </View>
                  </View>
                  <MetricTrendChart points={scoreTrend.points} color={scoreTrend.color} />
                </GlassCard>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Metrics</Text>

            {orderedMetrics.map((metric) => {
              const metricUsesMph = isMphUnit(metric.unit);
              const isScale10Metric = METRICS_SCALE10_KEYS.has(metric.key);
              const displayUnit = metricUsesMph ? "kmph" : metric.unit;
              const trendPoints = points
                .map((point) => {
                  const raw = point.metricValues?.[metric.key];
                  const parsedValue = Number(raw);
                  const normalizedValue = Number.isFinite(parsedValue)
                    ? normalizeMetricDisplayScale(metric.key, parsedValue)
                    : parsedValue;
                  const value =
                    metricUsesMph && Number.isFinite(normalizedValue)
                      ? toDisplaySpeed(normalizedValue)
                      : normalizedValue;
                  if (!Number.isFinite(value)) return null;
                  return {
                    label: formatDateLabel(point.capturedAt, profileTimeZone),
                    value,
                  };
                })
                .filter((point): point is SeriesPoint => point !== null);

              const latestValue = trendPoints.length ? trendPoints[trendPoints.length - 1].value : null;
              const previousValue = trendPoints.length > 1 ? trendPoints[trendPoints.length - 2].value : null;
              const deltaPct = computePercentDelta(latestValue, previousValue);
              const highlighted = String(focusMetric || "") === metric.key;
              const latestPrecision = metric.key === "ballSpeed" || isScale10Metric ? 1 : 2;
              const metricDisplayUnit = metricUsesMph ? "kmph" : isScale10Metric ? "/10" : displayUnit;

              return (
                <View
                  key={metric.key}
                  onLayout={(event) => {
                    const nextY = event.nativeEvent.layout.y;
                    setMetricOffsets((prev) => {
                      if (prev[metric.key] === nextY) return prev;
                      return { ...prev, [metric.key]: nextY };
                    });
                  }}
                >
                  <GlassCard
                    style={[
                      styles.metricTrendCard,
                      highlighted && { borderColor: `${metric.color}99` },
                    ]}
                  >
                    <View style={styles.metricHeaderRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: `${metric.color}1F` }]}> 
                        <Ionicons name={metric.icon as any} size={14} color={metric.color} />
                      </View>
                      <View style={styles.metricTitleWrap}>
                        <Text style={styles.metricTitle}>{metric.label}</Text>
                        <Text style={[styles.metricSubTitle, { color: deltaPct != null ? deltaColor(deltaPct) : "#8E8E93" }]}>
                          Latest: {latestValue !== null ? latestValue.toFixed(latestPrecision) : "-"} {metricDisplayUnit}
                          {formatDeltaPercent(deltaPct)}
                        </Text>
                      </View>
                    </View>

                    <MetricTrendChart points={trendPoints} color={metric.color} />
                  </GlassCard>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  topBar: {
    marginTop: 52,
    paddingHorizontal: ds.space.xl,
    paddingBottom: ds.space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ds.color.glass,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: ds.space.xl,
    marginBottom: 6,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.glass,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  periodPillActive: {
    backgroundColor: ds.color.accent,
    borderColor: ds.color.accent,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: ds.color.textTertiary,
  },
  periodTextActive: {
    color: "#FFFFFF",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
    color: ds.color.textTertiary,
  },
  scrollContent: {
    paddingHorizontal: ds.space.xl,
    paddingBottom: 26,
    gap: ds.space.lg,
  },
  enrichmentNotice: {
    borderRadius: ds.radius.md,
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.md,
  },
  enrichmentNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ds.space.sm,
  },
  enrichmentNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#BFDBFE",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ds.color.textPrimary,
  },
  metricTrendCard: {
    borderRadius: ds.radius.lg,
    padding: ds.space.md,
    gap: 8,
  },
  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricTitleWrap: {
    flex: 1,
    gap: 1,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  metricSubTitle: {
    fontSize: 12,
    color: ds.color.textTertiary,
  },
  metricEmpty: {
    fontSize: 12,
    fontWeight: "500",
    color: ds.color.textTertiary,
    paddingVertical: 8,
  },
  chartLabelsRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 1,
  },
  chartValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -1,
    marginBottom: 2,
  },
  chartValueText: {
    fontSize: 10,
    fontWeight: "500",
    color: ds.color.textTertiary,
  },
  chartLabel: {
    flex: 1,
    fontSize: 9,
    color: ds.color.textTertiary,
    textAlign: "center",
  },
  chartInteractiveWrap: {
    position: "relative",
  },
  chartTooltip: {
    position: "absolute",
    width: 96,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: "rgba(7, 11, 22, 0.92)",
    alignItems: "center",
  },
  chartTooltipValue: {
    fontSize: 12,
    fontWeight: "700",
    color: ds.color.textPrimary,
  },
  chartTooltipLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: ds.color.textTertiary,
  },
});
