import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Line, Polyline, Circle, Polygon } from "react-native-svg";
import {
  fetchAnalysisDetail,
  fetchAnalysisMetricTrends,
  fetchSportConfig,
  type SportCategoryConfig,
} from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

const SESSION_FILTERS = [
  { key: 5, label: "5S" },
  { key: 10, label: "10S" },
  { key: 25, label: "25S" },
  { key: "all", label: "All" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  biomechanics: "Biomechanics",
  ball: "Ball Metrics",
  timing: "Timing & Rhythm",
  consistency: "Consistency",
  technique: "Technique",
  power: "Power",
};

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type SeriesPoint = {
  label: string;
  value: number;
};

function MetricTrendChart({ points, color }: { points: SeriesPoint[]; color: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: ds.motion.slow,
      useNativeDriver: true,
    }).start();
  }, [color, points.length, reveal]);

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
  const revealTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <Animated.View style={{ opacity: reveal, transform: [{ translateY: revealTranslateY }] }}>
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
              fill={index === focusedIndex ? "#F8FAFC" : color}
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
    </Animated.View>
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

  const { data: analysisDetail } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
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
  });

  const metricsByCategory = useMemo(() => {
    if (!sportConfig) return {} as Record<string, SportCategoryConfig["metrics"]>;
    const groups: Record<string, SportCategoryConfig["metrics"]> = {};
    for (const metric of sportConfig.metrics) {
      if (!groups[metric.category]) {
        groups[metric.category] = [];
      }
      groups[metric.category].push(metric);
    }
    return groups;
  }, [sportConfig]);

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
            label: formatDateLabel(point.capturedAt),
            value,
          };
        })
        .filter((point): point is SeriesPoint => point !== null),
    [points],
  );

  const breakdownTrendSeries = useMemo(() => {
    if (!sportConfig?.scores?.length) return [] as Array<{
      key: string;
      label: string;
      color: string;
      unit: string;
      points: SeriesPoint[];
    }>;

    const fallbackColors = ["#60A5FA", "#34D399", "#F59E0B", "#A78BFA", "#F87171"];
    return sportConfig.scores.map((score, index) => {
      const pointsForScore = points
        .map((point) => {
          const raw = point.subScores?.[score.key];
          const value = Number(raw);
          if (!Number.isFinite(value)) return null;
          return {
            label: formatDateLabel(point.capturedAt),
            value,
          };
        })
        .filter((point): point is SeriesPoint => point !== null);

      return {
        key: score.key,
        label: score.label,
        color: fallbackColors[index % fallbackColors.length],
        unit: "/100",
        points: pointsForScore,
      };
    });
  }, [points, sportConfig]);

  useEffect(() => {
    const targetSection = String(focusSection || "").trim().toLowerCase();
    if (targetSection === "overall" || targetSection === "breakdown") {
      const sectionY = sectionOffsets[targetSection];
      if (typeof sectionY !== "number") return;

      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, sectionY - 10), animated: false });
      }, 0);

      return () => clearTimeout(timer);
    }

    const targetKey = String(focusMetric || "").trim();
    if (!targetKey) return;
    const targetOffset = metricOffsets[targetKey];
    if (typeof targetOffset !== "number") return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, targetOffset - 10), animated: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [focusMetric, focusSection, metricOffsets, sectionOffsets, sessionFilter]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.78 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
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
          <ActivityIndicator size="large" color="#6C5CE7" />
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
                <View style={[styles.metricIconWrap, { backgroundColor: "#6C5CE71F" }]}>
                  <Ionicons name="stats-chart" size={14} color="#6C5CE7" />
                </View>
                <View style={styles.metricTitleWrap}>
                  <Text style={styles.metricTitle}>Overall Score Trend</Text>
                  <Text style={styles.metricSubTitle}>
                    Latest: {overallTrendPoints.length ? overallTrendPoints[overallTrendPoints.length - 1].value.toFixed(2) : "-"}
                  </Text>
                </View>
              </View>
              <MetricTrendChart points={overallTrendPoints} color="#6C5CE7" />
            </GlassCard>
          </View>

          <View
            onLayout={(event) => {
              const nextY = event.nativeEvent.layout.y;
              setSectionOffsets((prev) => (prev.breakdown === nextY ? prev : { ...prev, breakdown: nextY }));
            }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Performance Breakdown</Text>
            {breakdownTrendSeries.map((scoreTrend) => {
              const latestValue = scoreTrend.points.length
                ? scoreTrend.points[scoreTrend.points.length - 1].value
                : null;
              return (
                <GlassCard key={scoreTrend.key} style={styles.metricTrendCard}>
                  <View style={styles.metricHeaderRow}>
                    <View style={[styles.metricIconWrap, { backgroundColor: `${scoreTrend.color}1F` }]}>
                      <Ionicons name="pulse" size={14} color={scoreTrend.color} />
                    </View>
                    <View style={styles.metricTitleWrap}>
                      <Text style={styles.metricTitle}>{scoreTrend.label}</Text>
                      <Text style={styles.metricSubTitle}>
                        Latest: {latestValue !== null ? latestValue.toFixed(2) : "-"} {scoreTrend.unit}
                      </Text>
                    </View>
                  </View>
                  <MetricTrendChart points={scoreTrend.points} color={scoreTrend.color} />
                </GlassCard>
              );
            })}
          </View>

          {Object.entries(metricsByCategory).map(([category, categoryMetrics]) => (
            <View key={category} style={styles.section}>
              <Text style={styles.sectionTitle}>{CATEGORY_LABELS[category] || category}</Text>

              {categoryMetrics.map((metric) => {
                const trendPoints = points
                  .map((point) => {
                    const raw = point.metricValues?.[metric.key];
                    const value = Number(raw);
                    if (!Number.isFinite(value)) return null;
                    return {
                      label: formatDateLabel(point.capturedAt),
                      value,
                    };
                  })
                  .filter((point): point is SeriesPoint => point !== null);

                const latestValue = trendPoints.length ? trendPoints[trendPoints.length - 1].value : null;
                const highlighted = String(focusMetric || "") === metric.key;

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
                          <Text style={styles.metricSubTitle}>
                            Latest: {latestValue !== null ? latestValue.toFixed(2) : "-"} {metric.unit}
                          </Text>
                        </View>
                      </View>

                      <MetricTrendChart points={trendPoints} color={metric.color} />
                    </GlassCard>
                  </View>
                );
              })}
            </View>
          ))}
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
    paddingHorizontal: ds.space.lg,
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
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  scrollContent: {
    paddingHorizontal: ds.space.xl,
    paddingBottom: 26,
    gap: ds.space.lg,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
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
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  metricSubTitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  metricEmpty: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  chartLabel: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  chartTooltipLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
});
