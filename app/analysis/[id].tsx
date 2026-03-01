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
import { fetchAnalysisDetail, fetchComparison } from "@/lib/api";
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

function calcChange(current: number | null | undefined, avg: number | null | undefined): number | null {
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

  const { data: comparison } = useQuery({
    queryKey: ["analysis", id, "comparison", period],
    queryFn: () => fetchComparison(id!, period),
    enabled: !!id && data?.analysis?.status === "completed" && !!data?.metrics,
  });

  const avg = comparison?.averages ?? null;

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const analysis = data?.analysis;
  const m = data?.metrics;
  const coaching = data?.coaching;

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
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
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
            { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
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
          <View
            style={[
              styles.processingCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.processingTitle, { color: colors.text }]}>
              Analyzing Your Forehand
            </Text>
            <Text
              style={[
                styles.processingSubtitle,
                { color: colors.textSecondary },
              ]}
            >
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
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color:
                          analysis.status === "processing" && i < 3
                            ? colors.text
                            : colors.textSecondary,
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
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
            Please try uploading the video again
          </Text>
        </View>
      ) : m ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 34 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.scoreSection}>
            <ScoreGauge
              score={m.forehandPerformanceScore}
              size={160}
              label="Performance"
              change={calcChange(m.forehandPerformanceScore, avg?.forehandPerformanceScore)}
            />
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Performance Breakdown
            </Text>
            <View style={styles.barsContainer}>
              <SubScoreBar label="Power" score={m.powerScore} delay={200} change={calcChange(m.powerScore, avg?.powerScore)} />
              <SubScoreBar label="Stability" score={m.stabilityScore} delay={400} change={calcChange(m.stabilityScore, avg?.stabilityScore)} />
              <SubScoreBar label="Timing" score={m.timingScore} delay={600} change={calcChange(m.timingScore, avg?.timingScore)} />
              <SubScoreBar label="Follow-through" score={m.followThroughScore} delay={800} change={calcChange(m.followThroughScore, avg?.followThroughScore)} />
            </View>
          </View>

          {videoUrl && (
            <View
              style={[
                styles.section,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.videoWrapper}>
                <VideoView
                  player={player}
                  style={styles.videoPlayer}
                  contentFit="contain"
                  nativeControls
                />
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

          <View style={styles.metricsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Biomechanics
            </Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="speedometer"
                label="Wrist Speed"
                value={m.wristSpeed}
                unit="m/s"
                color={colors.tint}
                change={calcChange(m.wristSpeed, avg?.wristSpeed)}
              />
              <MetricCard
                icon="body"
                label="Elbow Angle"
                value={m.elbowAngle}
                unit="deg"
                color={colors.blue}
                change={calcChange(m.elbowAngle, avg?.elbowAngle)}
              />
              <MetricCard
                icon="refresh-circle"
                label="Shoulder Rotation"
                value={m.shoulderRotationVelocity}
                unit="deg/s"
                color={colors.accent}
                change={calcChange(m.shoulderRotationVelocity, avg?.shoulderRotationVelocity)}
              />
              <MetricCard
                icon="footsteps"
                label="Balance"
                value={m.balanceStabilityScore}
                unit="/100"
                color={colors.amber}
                change={calcChange(m.balanceStabilityScore, avg?.balanceStabilityScore)}
              />
            </View>
          </View>

          <View style={styles.metricsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Ball Metrics
            </Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="flash"
                label="Ball Speed"
                value={m.ballSpeed}
                unit="mph"
                color={colors.red}
                change={calcChange(m.ballSpeed, avg?.ballSpeed)}
              />
              <MetricCard
                icon="trending-up"
                label="Trajectory Arc"
                value={m.ballTrajectoryArc}
                unit="deg"
                color={colors.blue}
                change={calcChange(m.ballTrajectoryArc, avg?.ballTrajectoryArc)}
              />
              <MetricCard
                icon="sync"
                label="Spin Rate"
                value={m.spinEstimation}
                unit="rpm"
                color={colors.accent}
                change={calcChange(m.spinEstimation, avg?.spinEstimation)}
              />
              <MetricCard
                icon="ribbon"
                label="Consistency"
                value={m.shotConsistencyScore}
                unit="/100"
                color={colors.tint}
                change={calcChange(m.shotConsistencyScore, avg?.shotConsistencyScore)}
              />
            </View>
          </View>

          <View style={styles.metricsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Timing & Rhythm
            </Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="arrow-back-circle"
                label="Backswing"
                value={m.backswingDuration}
                unit="s"
                color={colors.amber}
                change={calcChange(m.backswingDuration, avg?.backswingDuration)}
              />
              <MetricCard
                icon="locate"
                label="Contact Timing"
                value={m.contactTiming}
                unit="s"
                color={colors.red}
                change={calcChange(m.contactTiming, avg?.contactTiming)}
              />
              <MetricCard
                icon="arrow-forward-circle"
                label="Follow-through"
                value={m.followThroughDuration}
                unit="s"
                color={colors.tint}
                change={calcChange(m.followThroughDuration, avg?.followThroughDuration)}
              />
              <MetricCard
                icon="musical-notes"
                label="Rhythm"
                value={m.rhythmConsistency}
                unit="/100"
                color={colors.blue}
                change={calcChange(m.rhythmConsistency, avg?.rhythmConsistency)}
              />
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.contactRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Contact Height
              </Text>
              <Text style={[styles.contactValue, { color: colors.tint }]}>
                {m.contactHeight}m
              </Text>
            </View>
            <Text style={[styles.contactHint, { color: colors.textSecondary }]}>
              Optimal range: 0.85m - 1.10m above ground
            </Text>
            <View style={[styles.contactBar, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.contactOptimal,
                  { backgroundColor: colors.tint + "30" },
                ]}
              />
              <View
                style={[
                  styles.contactMarker,
                  {
                    backgroundColor: colors.tint,
                    left: `${Math.min(Math.max(((m.contactHeight - 0.5) / 1.0) * 100, 0), 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {coaching && (
            <View style={styles.coachingSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Coaching Insights
              </Text>
              <CoachingCard
                icon="trophy"
                title="Key Strength"
                content={coaching.keyStrength}
                color={colors.tint}
              />
              <CoachingCard
                icon="warning"
                title="Improvement Area"
                content={coaching.improvementArea}
                color={colors.amber}
              />
              <CoachingCard
                icon="bulb"
                title="Training Suggestion"
                content={coaching.trainingSuggestion}
                color={colors.blue}
              />
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.tint + "10", borderColor: colors.tint + "30" },
                ]}
              >
                <Ionicons name="chatbubbles" size={20} color={colors.tint} />
                <Text style={[styles.summaryText, { color: colors.text }]}>
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
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  barsContainer: {
    gap: 14,
  },
  videoWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  videoPlayer: {
    width: "100%",
    aspectRatio: 16 / 9,
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
    backgroundColor: "#1A1A36",
    borderWidth: 1,
    borderColor: "#2A2A50",
  },
  periodPillActive: {
    backgroundColor: "#6C5CE7",
    borderColor: "#6C5CE7",
  },
  periodText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
  },
  periodTextActive: {
    color: "#FFFFFF",
  },
  periodHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginLeft: 4,
  },
  metricsSection: {
    gap: 12,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contactValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  contactHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  contactBar: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  contactOptimal: {
    position: "absolute",
    left: "35%",
    width: "25%",
    height: "100%",
    borderRadius: 6,
  },
  contactMarker: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 0,
  },
  coachingSection: {
    gap: 12,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  processingCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  processingTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
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
