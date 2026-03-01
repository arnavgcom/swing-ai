import React, { useMemo, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Platform,
  TextInput,
  Modal,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  fetchFeedback,
  submitFeedback,
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
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("30d");
  const [fullscreen, setFullscreen] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState<string | null>(null);

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

  const { data: feedback } = useQuery({
    queryKey: ["analysis", id, "feedback"],
    queryFn: () => fetchFeedback(id!),
    enabled: !!id && data?.analysis?.status === "completed",
  });

  const feedbackMutation = useMutation({
    mutationFn: (vars: { rating: "up" | "down"; comment?: string }) =>
      submitFeedback(id!, vars.rating, vars.comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", id, "feedback"] });
    },
  });

  const commentValue = feedbackComment ?? feedback?.comment ?? "";
  const commentChanged = feedbackComment !== null && feedbackComment !== (feedback?.comment ?? "");

  const handleThumbsUp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedbackMutation.mutate({ rating: "up", comment: commentValue || undefined });
  }, [commentValue]);

  const handleThumbsDown = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedbackMutation.mutate({ rating: "down", comment: commentValue || undefined });
  }, [commentValue]);

  const handleSubmitComment = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const rating = feedback?.rating ?? "up";
    feedbackMutation.mutate({ rating, comment: commentValue || undefined });
    setFeedbackComment(null);
  }, [commentValue, feedback]);

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

  const selectedMovement = data?.selectedMovementName;
  const detectedMovement = analysis.detectedMovement;
  const wasOverridden =
    selectedMovement &&
    detectedMovement &&
    selectedMovement.toLowerCase().replace(/\s+/g, "-") !==
      detectedMovement.toLowerCase().replace(/\s+/g, "-");

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
          {(sportConfig?.sportName || sportConfig?.movementName || detectedMovement) && (
            <View style={styles.badgesRow}>
              {sportConfig?.sportName && (
                <View style={styles.sportBadge}>
                  <Ionicons name="fitness-outline" size={12} color="#A29BFE" />
                  <Text style={styles.sportBadgeText}>{sportConfig.sportName}</Text>
                </View>
              )}
              {(sportConfig?.movementName || detectedMovement) && (
                <View style={styles.categoryBadge}>
                  <Ionicons name="flash-outline" size={12} color="#34D399" />
                  <Text style={styles.categoryBadgeText}>
                    {(sportConfig?.movementName || detectedMovement || "").charAt(0).toUpperCase() +
                      (sportConfig?.movementName || detectedMovement || "").slice(1).replace(/-/g, " ")}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.scoreSection}>
            <ScoreGauge
              score={m.overallScore}
              size={160}
              label="Score"
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

          {wasOverridden && (
            <View style={styles.overrideBanner}>
              <Ionicons name="information-circle" size={18} color="#60A5FA" />
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

          {data?.analysis?.status === "completed" && (
            <View style={styles.compactThumbsRow}>
              <Pressable
                onPress={handleThumbsUp}
                style={({ pressed }) => [
                  styles.compactThumbButton,
                  feedback?.rating === "up" && styles.thumbButtonActiveUp,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons
                  name={feedback?.rating === "up" ? "thumbs-up" : "thumbs-up-outline"}
                  size={16}
                  color={feedback?.rating === "up" ? "#34D399" : "#64748B"}
                />
              </Pressable>
              <Pressable
                onPress={handleThumbsDown}
                style={({ pressed }) => [
                  styles.compactThumbButton,
                  feedback?.rating === "down" && styles.thumbButtonActiveDown,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons
                  name={feedback?.rating === "down" ? "thumbs-down" : "thumbs-down-outline"}
                  size={16}
                  color={feedback?.rating === "down" ? "#F87171" : "#64748B"}
                />
              </Pressable>
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
                  <Ionicons name="expand-outline" size={18} color="#94A3B8" />
                </Pressable>
              </View>
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
                      <View key={metric.key} style={styles.metricCardWrapper}>
                        <MetricCard
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
                      </View>
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
              <View style={styles.overallCard}>
                <View style={styles.overallHeader}>
                  <Ionicons name="chatbubbles" size={18} color="#6C5CE7" />
                  <Text style={styles.overallHeading}>Overall</Text>
                </View>
                <Text style={styles.summaryText}>
                  {coaching.simpleExplanation}
                </Text>
              </View>
            </View>
          )}

          {data?.analysis?.status === "completed" && (
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionTitle}>Player's Comment</Text>
              <View style={styles.feedbackCard}>
                <View style={styles.commentSection}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add your notes…"
                    placeholderTextColor="#475569"
                    value={commentValue}
                    onChangeText={setFeedbackComment}
                    multiline
                    maxLength={500}
                  />
                  {commentChanged && (
                    <View style={styles.commentActions}>
                      <Pressable
                        onPress={handleSubmitComment}
                        style={({ pressed }) => [
                          styles.submitButton,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={styles.submitButtonText}>Save</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      ) : null}

      {fullscreen && videoUrl && (
        <Modal
          animationType="fade"
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
  badgesRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#6C5CE712",
    borderWidth: 1,
    borderColor: "#6C5CE730",
  },
  sportBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#A29BFE",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#34D39912",
    borderWidth: 1,
    borderColor: "#34D39930",
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#34D399",
  },
  compactThumbsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  compactThumbButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  overrideBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#60A5FA10",
    borderWidth: 1,
    borderColor: "#60A5FA25",
  },
  overrideBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    color: "#94A3B8",
  },
  overrideHighlight: {
    fontFamily: "Inter_600SemiBold",
    color: "#60A5FA",
  },
  videoSection: {
    gap: 10,
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
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
    alignItems: "center",
    justifyContent: "center",
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
  metricCardWrapper: {
    width: METRIC_CARD_WIDTH,
  },
  coachingSection: {
    gap: 14,
  },
  overallCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#6C5CE708",
    borderColor: "#6C5CE720",
    gap: 10,
  },
  overallHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  overallHeading: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    color: "#CBD5E1",
  },
  feedbackSection: {
    gap: 14,
  },
  feedbackCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    gap: 14,
  },
  thumbButtonActiveUp: {
    borderColor: "#34D39940",
    backgroundColor: "#34D39910",
  },
  thumbButtonActiveDown: {
    borderColor: "#F8717140",
    backgroundColor: "#F8717110",
  },
  commentSection: {
    width: "100%",
    gap: 10,
  },
  commentInput: {
    width: "100%",
    minHeight: 72,
    backgroundColor: "#0A0A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
    textAlignVertical: "top",
  },
  commentActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#6C5CE7",
  },
  submitButtonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
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
