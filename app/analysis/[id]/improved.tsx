import React, { useMemo } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  fetchAnalysisDetail,
  fetchImprovedTennisAnalysis,
  fetchSportConfig,
} from "@/lib/api";
import { ScoreGauge } from "@/components/ScoreGauge";
import { MetricCard } from "@/components/MetricCard";
import { CoachingCard } from "@/components/CoachingCard";
import Colors, { sportColors } from "@/constants/colors";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  isImprovedTennisEnabled,
  type ImprovedScoreDetail,
} from "@/lib/improved-tennis";
import { getApiUrl } from "@/lib/query-client";
import type { SportCategoryConfig } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  buildMetricOptionsWithCatalog,
  normalizeMetricSelectionKey,
} from "@/lib/metrics-catalog";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HORIZONTAL_SCREEN_PADDING = 40; // scrollContent: 20 + 20
const SECTION_HORIZONTAL_PADDING = 32; // section: 16 + 16
const METRICS_GRID_GAP = 12;
const METRIC_CARD_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_SCREEN_PADDING - SECTION_HORIZONTAL_PADDING - METRICS_GRID_GAP) / 2;

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreColor(score: number): string {
  if (score >= 8) return "#34D399";
  if (score >= 6) return "#60A5FA";
  return "#FBBF24";
}

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mphToKmh(value: number): number {
  return value * 1.60934;
}

function isMphUnit(unit?: string): boolean {
  return String(unit || "").trim().toLowerCase() === "mph";
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

function TenPointBar({ item }: { item: ImprovedScoreDetail }) {
  const pct = Math.max(0, Math.min(100, item.score * 10));
  const color = scoreColor(item.score);

  return (
    <View style={styles.tenRow}>
      <View style={styles.tenHeader}>
        <Text style={styles.tenLabel}>{item.label}</Text>
        <Text style={[styles.tenScore, { color }]}>{item.score}/10</Text>
      </View>
      <View style={styles.tenTrack}>
        <View style={[styles.tenFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.tenExplanation} numberOfLines={2}>
        {item.explanation}
      </Text>
    </View>
  );
}

export default function ImprovedTennisAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors.dark;
  const { user } = useAuth();

  const { data: detail, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
  });

  const configKey = detail?.metrics?.configKey;
  const { data: sportConfig } = useQuery({
    queryKey: ["sport-config", configKey],
    queryFn: () => fetchSportConfig(configKey!),
    enabled: !!configKey,
  });

  const { data: improvedData, isLoading: improvedLoading } = useQuery({
    queryKey: ["analysis", id, "improved-tennis"],
    queryFn: () => fetchImprovedTennisAnalysis(id!),
    enabled: !!id && detail?.analysis?.status === "completed",
  });

  const isTennis = String(sportConfig?.sportName || "").toLowerCase() === "tennis";
  const report = useMemo(() => {
    if (!isTennis) return null;
    return improvedData?.report || null;
  }, [improvedData?.report, isTennis]);

  const strengthsText = useMemo(
    () => (report?.strengths || []).map((row) => `- ${row}`).join("\n"),
    [report?.strengths],
  );
  const improvementsText = useMemo(
    () => (report?.improvementAreas || []).map((row) => `- ${row}`).join("\n"),
    [report?.improvementAreas],
  );
  const coachTipsText = useMemo(
    () => (report?.coachingTips || []).map((row) => `- ${row}`).join("\n"),
    [report?.coachingTips],
  );

  const m = detail?.metrics;
  const inputMetrics = improvedData?.inputMetrics || {};

  const videoUrl = useMemo(() => {
    if (!detail?.analysis?.videoPath) return null;
    try {
      const normalizedPath = detail.analysis.videoPath.replace(/\\/g, "/");
      const lowerPath = normalizedPath.toLowerCase();

      let relativePath = "";
      const marker = "/uploads/";
      const markerIndex = lowerPath.lastIndexOf(marker);

      if (markerIndex >= 0) {
        relativePath = normalizedPath.slice(markerIndex + marker.length);
      } else {
        const looseMarker = "uploads/";
        const looseIndex = lowerPath.lastIndexOf(looseMarker);
        if (looseIndex >= 0) {
          relativePath = normalizedPath.slice(looseIndex + looseMarker.length);
        } else {
          relativePath = normalizedPath.split("/").pop() || "";
        }
      }

      if (!relativePath) return null;

      const encodedRelativePath = relativePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      const base = getApiUrl();
      return new URL(`/uploads/${encodedRelativePath}`, base).href;
    } catch {
      return null;
    }
  }, [detail?.analysis?.videoPath]);

  const player = useVideoPlayer(videoUrl ?? "about:blank", (p) => {
    p.loop = false;
  });

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

  const hasMetricSelection = selectedMetricKeys.size > 0;

  const availableMetricDefinitions = useMemo(
    () => buildMetricOptionsWithCatalog(sportConfig?.metrics || []),
    [sportConfig?.metrics],
  );

  const metricMetaByKey = useMemo(() => {
    const map = new Map<string, SportCategoryConfig["metrics"][number]>();
    for (const metric of availableMetricDefinitions) {
      map.set(metric.key, metric);
    }
    return map;
  }, [availableMetricDefinitions]);

  const metricSnapshotItems = useMemo(() => {
    const values = (m?.metricValues || inputMetrics || {}) as Record<string, unknown>;
    const selectedKeys = hasMetricSelection
      ? Array.from(selectedMetricKeys)
      : availableMetricDefinitions.map((metric) => metric.key);

    return selectedKeys
      .map((key) => {
        const meta = metricMetaByKey.get(key);
        if (!meta) return null;

        const rawValue = asFiniteNumber(values[key]);
        const metricUsesMph = isMphUnit(meta?.unit);
        const isScale10Metric = METRICS_SCALE10_KEYS.has(key);

        const normalizedValue =
          rawValue == null
            ? null
            : normalizeMetricDisplayScale(key, rawValue);

        const displayValue =
          normalizedValue == null
            ? null
            : metricUsesMph
              ? mphToKmh(normalizedValue)
              : normalizedValue;

        const rawRange = meta.optimalRange;
        const displayRange =
          metricUsesMph && rawRange
            ? [mphToKmh(rawRange[0]), mphToKmh(rawRange[1])] as [number, number]
            : isScale10Metric && rawRange
              ? [
                  rawRange[0] > 10 ? rawRange[0] / 10 : rawRange[0],
                  rawRange[1] > 10 ? rawRange[1] / 10 : rawRange[1],
                ] as [number, number]
              : rawRange;

        return {
          key,
          label: meta.label,
          value: displayValue,
          unit: metricUsesMph ? "km/h" : isScale10Metric ? "/10" : meta.unit,
          icon: meta.icon as any,
          color: meta.color,
          optimalRange: displayRange,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [
    availableMetricDefinitions,
    hasMetricSelection,
    inputMetrics,
    m?.metricValues,
    metricMetaByKey,
    selectedMetricKeys,
  ]);

  const metricRows = useMemo(() => {
    const rows: Array<Array<(typeof metricSnapshotItems)[number]>> = [];
    for (let i = 0; i < metricSnapshotItems.length; i += 2) {
      rows.push(metricSnapshotItems.slice(i, i + 2));
    }
    return rows;
  }, [metricSnapshotItems]);

  const technicalBiomecItems = useMemo(
    () =>
      (report?.biomechanics || []).filter(
        (item) => item.key !== "follow" && !String(item.label || "").toLowerCase().includes("follow"),
      ),
    [report?.biomechanics],
  );

  if (isLoading || improvedLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <Text style={styles.emptyText}>Analysis not found.</Text>
      </View>
    );
  }

  if (!isImprovedTennisEnabled()) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <Text style={styles.emptyText}>Improved analysis is currently disabled.</Text>
      </View>
    );
  }

  if (!isTennis) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <Text style={styles.emptyText}>Improved analysis is available for Tennis only.</Text>
      </View>
    );
  }

  const sportThemeColor = sportColors.Tennis.primary;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <Text numberOfLines={1} style={styles.topTitle}>Tennis Analysis</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { borderColor: `${sportThemeColor}44`, backgroundColor: `${sportThemeColor}18` }]}>
            <Ionicons name="fitness-outline" size={12} color={sportThemeColor} />
            <Text style={[styles.badgeText, { color: sportThemeColor }]}>Tennis</Text>
          </View>
          <View style={styles.badgeNeutral}>
            <Ionicons name="flash-outline" size={12} color="#34D399" />
            <Text style={styles.badgeTextNeutral}>{toTitleCase(report?.stroke || "forehand")}</Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <ScoreGauge score={report?.overallScore || 0} size={160} />
        </View>

        {videoUrl && (
          <View style={styles.videoSection}>
            <Text style={styles.sectionTitle}>Video</Text>
            <View style={styles.videoContainer}>
              <VideoView
                player={player}
                style={styles.videoPlayer}
                contentFit="contain"
                nativeControls
              />
            </View>
          </View>
        )}

        {!!m?.metricValues && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Performance Metrics</Text>
            <View style={styles.metricsRows}>
              {metricRows.map((row, rowIdx) => (
                <View key={`metric-row-${rowIdx}`} style={styles.metricsRow}>
                  {row.map((item) => (
                    <View
                      key={item.key}
                      style={[
                        styles.metricCardWrap,
                        (item.key === "kneeBendAngle" || item.key === "knee_bend_angle")
                          ? styles.metricCardWrapKnee
                          : null,
                      ]}
                    >
                      <MetricCard
                        icon={item.icon}
                        label={item.label}
                        value={item.value !== null ? item.value : "-"}
                        unit={item.unit}
                        valuePrecision={1}
                        color={item.color}
                        optimalRange={item.optimalRange}
                      />
                    </View>
                  ))}
                  {row.length === 1 && <View style={styles.metricCardWrap} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {report && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Metrics</Text>
            <View style={styles.metricGroup}>
              <Text style={styles.metricGroupTitle}>Technical (BIOMEC)</Text>
              {technicalBiomecItems.map((item) => (
                <TenPointBar key={`bio-${item.key}`} item={item} />
              ))}
            </View>
            <View style={styles.metricGroup}>
              <Text style={styles.metricGroupTitle}>Movement</Text>
              {report.movement.map((item) => (
                <TenPointBar key={`mov-${item.key}`} item={item} />
              ))}
            </View>
          </View>
        )}


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightsList}>
            <CoachingCard
              icon="trophy"
              title="Key Strength"
              content={strengthsText}
              color="#34D399"
            />
            <CoachingCard
              icon="warning"
              title="Improvement Area"
              content={improvementsText}
              color="#FBBF24"
            />
            <CoachingCard
              icon="bulb"
              title="Coach Tips"
              content={coachTipsText}
              color="#60A5FA"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15152D",
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    color: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  badgeTextNeutral: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  tenRow: {
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    backgroundColor: "rgba(10, 10, 26, 0.38)",
  },
  tenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tenLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#D7E2F0",
    letterSpacing: 0.2,
  },
  tenScore: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  tenTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#0B1020",
    overflow: "hidden",
  },
  tenFill: {
    height: "100%",
    borderRadius: 999,
  },
  tenExplanation: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
    color: "#8EA0BA",
  },
  metricGroup: {
    gap: 8,
  },
  metricGroupTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#9FB4D1",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricsRows: {
    gap: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricCardWrap: {
    flex: 1,
    maxWidth: METRIC_CARD_WIDTH,
  },
  metricCardWrapKnee: {
    minHeight: 156,
  },
  insightsList: {
    gap: 8,
  },
  videoSection: {
    gap: 10,
  },
  videoContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#2A2A5040",
  },
  videoPlayer: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
    textAlign: "center",
  },
});
