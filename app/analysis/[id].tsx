import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import Colors from "@/constants/colors";
import {
  fetchAnalysisDetail,
  fetchComparison,
  fetchSportConfig,
} from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { ScoreGauge } from "@/components/ScoreGauge";
import { MetricCard } from "@/components/MetricCard";
import { SubScoreBar } from "@/components/SubScoreBar";
import { CoachingCard } from "@/components/CoachingCard";

const PERIODS = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
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

function calcChange(
  current: number | null | undefined,
  avg: number | null | undefined,
): number | null {
  if (current == null || avg == null || avg === 0) return null;
  return ((current - avg) / avg) * 100;
}

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors.dark;
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState("30d");

  const { data, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.analysis?.status;
      if (status === "pending" || status === "processing") return 2000;
      return false;
    },
  });

  const configKey = data?.metrics?.configKey;

  const { data: sportConfig } = useQuery({
    queryKey: ["sport-config", configKey],
    queryFn: () => fetchSportConfig(configKey!),
    enabled: !!configKey,
  });

  const { data: comparison } = useQuery({
    queryKey: ["analysis", id, "comparison", period],
    queryFn: () => fetchComparison(id!, period),
    enabled:
      !!id && data?.analysis?.status === "completed" && !!data?.metrics,
  });

  const avgMetrics = comparison?.averages?.metricValues ?? null;
  const avgSubScores = comparison?.averages?.subScores ?? null;

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const analysis = data?.analysis;
  const m = data?.metrics;
  const coaching = data?.coaching;

  const metricsByCategory = useMemo(() => {
    if (!sportConfig) return {};
    const groups: Record<
      string,
      Array<{
        key: string;
        label: string;
        unit: string;
        icon: string;
        color: string;
        description: string;
        optimalRange?: [number, number];
      }>
    > = {};
    for (const metric of sportConfig.metrics) {
      if (!groups[metric.category]) {
        groups[metric.category] = [];
      }
      groups[metric.category].push(metric);
    }
    return groups;
  }, [sportConfig]);

  const videoUrl = useMemo(() => {
    if (!analysis?.videoPath) return null;
    try {
      const filename = analysis.videoPath.split("/").pop();
      if (!filename) return null;
      const base = getApiUrl();
      return new URL(`/uploads/${filename}`, base).href;
    } catch {
      return null;
    }
  }, [analysis?.videoPath]);

  const player = useVideoPlayer(videoUrl ?? "about:blank", (p) => {
    p.loop = false;
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient
          colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient
          colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="alert-circle-outline" size={48} color="#F87171" />
        <Text style={[styles.errorText, { color: "#F8FAFC" }]}>
          Analysis not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: "#6C5CE7" }]}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isProcessing =
    analysis.status === "pending" || analysis.status === "processing";

  const movementLabel =
    sportConfig?.movementName || analysis.detectedMovement || "Movement";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
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
            { backgroundColor: "#15152D", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text
          style={[styles.topTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {analysis.videoFilename}
        </Text>
        <View style={styles.navButton} />
      </View>

      {isProcessing ? (
        <View style={[styles.container, styles.center]}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.tint} />
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
                "Computing biomechanics",
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
                        ? colors.tint
                        : "#475569"
                    }
                  />
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color:
                          analysis.status === "processing" && i < 3
                            ? colors.text
                            : "#475569",
                      },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : analysis.status === "failed" ? (
        <View style={[styles.container, styles.center]}>
          <Ionicons name="alert-circle" size={48} color={colors.red} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Analysis failed
          </Text>
          <Text style={[styles.errorSub, { color: "#94A3B8" }]}>
            Please try uploading the video again
          </Text>
        </View>
      ) : m ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 34 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.scoreSection}>
            <ScoreGauge
              score={m.overallScore}
              size={160}
              label={sportConfig?.overallScoreLabel || "Performance"}
              change={calcChange(
                m.overallScore,
                avgSubScores
                  ? Object.values(avgSubScores).reduce(
                      (a, b) => a + b,
                      0,
                    ) / Math.max(Object.keys(avgSubScores).length, 1)
                  : null,
              )}
            />
          </View>

          {videoUrl && (
            <View style={styles.videoContainer}>
              <VideoView
                player={player}
                style={styles.videoPlayer}
                contentFit="contain"
                nativeControls
              />
            </View>
          )}

          {sportConfig && m.subScores && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance Breakdown</Text>
              <View style={styles.barsContainer}>
                {sportConfig.scores.map((score, i) => (
                  <SubScoreBar
                    key={score.key}
                    label={score.label}
                    score={m.subScores[score.key] ?? 0}
                    delay={200 + i * 200}
                    change={calcChange(
                      m.subScores[score.key],
                      avgSubScores?.[score.key],
                    )}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPeriod(p.key);
                }}
                style={[
                  styles.periodPill,
                  period === p.key && styles.periodPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    period === p.key && styles.periodTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
            {comparison && comparison.count > 0 && (
              <Text style={styles.periodHint}>
                vs {comparison.count} prior
              </Text>
            )}
          </View>

          {sportConfig &&
            m.metricValues &&
            Object.entries(metricsByCategory).map(
              ([category, categoryMetrics]) => (
                <View key={category} style={styles.metricsSection}>
                  <Text style={styles.sectionTitle}>
                    {CATEGORY_LABELS[category] || category}
                  </Text>
                  <View style={styles.metricsGrid}>
                    {categoryMetrics.map((metric) => (
                      <MetricCard
                        key={metric.key}
                        icon={metric.icon as any}
                        label={metric.label}
                        value={m.metricValues[metric.key] ?? 0}
                        unit={metric.unit}
                        color={metric.color}
                        change={calcChange(
                          m.metricValues[metric.key],
                          avgMetrics?.[metric.key],
                        )}
                      />
                    ))}
                  </View>
                </View>
              ),
            )}

          {coaching && (
            <View style={styles.coachingSection}>
              <Text style={styles.sectionTitle}>Coaching Insights</Text>
              <CoachingCard
                icon="trophy"
                title="Key Strength"
                content={coaching.keyStrength}
                color="#34D399"
              />
              <CoachingCard
                icon="warning"
                title="Improvement Area"
                content={coaching.improvementArea}
                color="#FBBF24"
              />
              <CoachingCard
                icon="bulb"
                title="Training Suggestion"
                content={coaching.trainingSuggestion}
                color="#60A5FA"
              />
              <View style={styles.summaryCard}>
                <Ionicons name="chatbubbles" size={18} color="#6C5CE7" />
                <Text style={styles.summaryText}>
                  {coaching.simpleExplanation}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      ) : null}
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
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 28,
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 20,
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
    aspectRatio: 4 / 3,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    padding: 22,
    gap: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  barsContainer: {
    gap: 18,
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
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
  },
  periodPillActive: {
    backgroundColor: "#6C5CE7",
    borderColor: "#6C5CE7",
  },
  periodText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
  },
  periodTextActive: {
    color: "#FFFFFF",
  },
  periodHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#475569",
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
  coachingSection: {
    gap: 14,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#6C5CE708",
    borderColor: "#6C5CE720",
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    color: "#CBD5E1",
  },
  processingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    padding: 28,
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  processingTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
    color: "#F8FAFC",
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    color: "#94A3B8",
  },
  processingSteps: {
    gap: 10,
    width: "100%",
    marginTop: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
  },
  errorSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  backButtonText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
