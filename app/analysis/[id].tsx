import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  Animated,
  PanResponder,
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
import Colors, { sportColors } from "@/constants/colors";
import {
  fetchAnalysisDetail,
  fetchAnalysisDiagnostics,
  fetchAnalysisVideoMetadata,
  fetchAnalysisShotAnnotation,
  fetchComparison,
  fetchSportConfig,
  fetchFeedback,
  saveAnalysisShotAnnotation,
  submitFeedback,
} from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { ScoreGauge } from "@/components/ScoreGauge";
import { MetricCard } from "@/components/MetricCard";
import { SubScoreBar } from "@/components/SubScoreBar";
import { CoachingCard } from "@/components/CoachingCard";
import { useAuth } from "@/lib/auth-context";

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

const FEEDBACK_DISCREPANCY_TAGS = [
  "Wrong Detection",
  "Scores high/low",
  "Other",
] as const;

const SPORT_MOVEMENT_OPTIONS: Record<string, string[]> = {
  tennis: ["forehand", "backhand", "serve", "volley", "game"],
  golf: ["drive", "iron", "chip", "putt", "full-swing"],
  pickleball: ["dink", "drive", "serve", "volley", "third-shot-drop"],
  paddle: ["forehand", "backhand", "serve", "smash", "bandeja"],
  badminton: ["clear", "smash", "drop", "net-shot", "serve"],
  tabletennis: ["forehand", "backhand", "serve", "loop", "chop"],
};

function calcChange(
  current: number | null | undefined,
  avg: number | null | undefined,
): number | null {
  if (current == null || avg == null || avg === 0) return null;
  return ((current - avg) / avg) * 100;
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const datePart = date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  });
  const tzPart = new Intl.DateTimeFormat(undefined, { timeZoneName: "short", timeZone })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return tzPart ? `${datePart} ${tzPart}` : datePart;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors.dark;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("30d");
  const [fullscreen, setFullscreen] = useState(false);
  const [feedbackSheetVisible, setFeedbackSheetVisible] = useState(false);
  const [pendingRating, setPendingRating] = useState<"up" | "down" | null>(null);
  const [selectedDiscrepancies, setSelectedDiscrepancies] = useState<string[]>([]);
  const [discrepancyText, setDiscrepancyText] = useState("");
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [technicalExpanded, setTechnicalExpanded] = useState(false);
  const [manualShotLabels, setManualShotLabels] = useState<string[]>([]);
  const [manualFormInitialized, setManualFormInitialized] = useState(false);
  const [manualAnnotationVisible, setManualAnnotationVisible] = useState(false);
  const [activeShotDropdownIndex, setActiveShotDropdownIndex] = useState<number | null>(null);
  const [manualSavedVisible, setManualSavedVisible] = useState(false);
  const [manualSaveMessage, setManualSaveMessage] = useState("Saved");
  const [manualAnnotationDone, setManualAnnotationDone] = useState(false);
  const feedbackSheetTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    AsyncStorage.setItem("swingai_last_worked_analysis_id", id).catch(() => {});
  }, [id]);

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

  const { data: diagnostics, isLoading: diagnosticsLoading } = useQuery({
    queryKey: ["analysis", id, "diagnostics"],
    queryFn: () => fetchAnalysisDiagnostics(id!),
    enabled: !!id && data?.analysis?.status === "completed",
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
      notes?: string;
    }) => saveAnalysisShotAnnotation(id!, payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["analysis", id, "shot-annotation"] });
      queryClient.setQueryData(["analysis", id, "shot-annotation"], saved);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setManualAnnotationDone(true);
      setActiveShotDropdownIndex(null);
      setManualAnnotationVisible(false);
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
    feedbackSheetTranslateY.setValue(0);
    setFeedbackSheetVisible(false);
  }, [feedbackSheetTranslateY]);

  const dismissFeedbackSheetByGesture = useCallback(() => {
    Animated.timing(feedbackSheetTranslateY, {
      toValue: 260,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setFeedbackSheetVisible(false);
      feedbackSheetTranslateY.setValue(0);
    });
  }, [feedbackSheetTranslateY]);

  const feedbackSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dy) > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_evt, gestureState) => {
          if (gestureState.dy > 0) {
            feedbackSheetTranslateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dy > 110) {
            dismissFeedbackSheetByGesture();
            return;
          }

          Animated.spring(feedbackSheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        },
      }),
    [dismissFeedbackSheetByGesture, feedbackSheetTranslateY],
  );

  useEffect(() => {
    if (feedbackSheetVisible) {
      feedbackSheetTranslateY.setValue(0);
    }
  }, [feedbackSheetVisible, feedbackSheetTranslateY]);

  useEffect(() => {
    if (!manualAnnotationVisible) {
      setActiveShotDropdownIndex(null);
    }
  }, [manualAnnotationVisible]);

  useEffect(() => {
    setManualFormInitialized(false);
    setManualShotLabels([]);
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
    setManualAnnotationVisible(false);
    setManualSaveMessage("Saving...");
    setManualSavedVisible(true);

    shotAnnotationMutation.mutate({
      totalShots,
      orderedShotLabels,
      usedForScoringShotIndexes: Array.from(
        { length: totalShots },
        (_value, index) => index + 1,
      ),
    });
  }, [diagnostics?.shotSegments, manualShotLabels, shotAnnotation?.orderedShotLabels, shotAnnotationMutation]);

  const handleAddManualShot = useCallback(() => {
    setManualShotLabels((prev) => [...prev, "forehand"]);
  }, []);

  const handleRemoveManualShot = useCallback(() => {
    setManualShotLabels((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const avgMetrics = comparison?.averages?.metricValues ?? null;
  const avgSubScores = comparison?.averages?.subScores ?? null;

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const analysis = data?.analysis;
  const m = data?.metrics;
  const coaching = data?.coaching;

  const displayVideoName = useMemo(() => {
    if (analysis?.videoPath) {
      const fromPath = analysis.videoPath.split(/[\\/]/).pop();
      if (fromPath) return fromPath;
    }
    return analysis?.videoFilename || "Analysis";
  }, [analysis?.videoPath, analysis?.videoFilename]);

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
      const normalizedPath = analysis.videoPath.replace(/\\/g, "/");
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
  }, [analysis?.videoPath]);

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

  const sportThemeColor =
    (sportConfig?.sportName && sportColors[sportConfig.sportName]?.primary) ||
    "#A29BFE";

  const selectedMovement = data?.selectedMovementName;
  const detectedMovement = analysis.detectedMovement;
  const profileTimeZone =
    (user as any)?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
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
            {displayVideoName}
          </Text>
        </Pressable>
        <View style={styles.navButton} />
      </View>

      {isProcessing ? (
        <View style={[styles.container, styles.center]}>
          <View style={styles.processingCard}>
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
                        ? sportThemeColor
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
      ) : analysis.status === "rejected" ? (
        <View style={[styles.container, styles.center]}>
          <View style={styles.rejectedIconWrap}>
            <Ionicons name="warning" size={48} color="#FBBF24" />
          </View>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Video Rejected
          </Text>
          <Text style={[styles.rejectionReason, { color: "#94A3B8" }]}>
            {analysis.rejectionReason || "Video content does not match the selected sport."}
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/upload")}
            style={({ pressed }) => [
              styles.tryAgainButton,
              { backgroundColor: sportThemeColor },
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
          <Text style={[styles.errorSub, { color: "#94A3B8" }]}>
            {analysis.rejectionReason || "Please try uploading the video again"}
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
          {diagnosticsExpanded && (
            <Pressable
              style={styles.diagnosticsBackdropGlass}
              onPress={() => {
                setDiagnosticsExpanded(false);
                setAdvancedExpanded(false);
                setTechnicalExpanded(false);
              }}
            />
          )}

          <View style={styles.topMetaRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDiagnosticsExpanded((prev) => !prev);
              }}
              style={({ pressed }) => [
                styles.diagnosticsIconButton,
                {
                  borderColor: `${sportThemeColor}40`,
                  backgroundColor: `${sportThemeColor}12`,
                },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons
                name={diagnosticsExpanded ? "sparkles" : "sparkles-outline"}
                size={16}
                color={sportThemeColor}
              />
            </Pressable>
            <View style={styles.badgesGroup}>
              {sportConfig?.sportName && (
                <View
                  style={[
                    styles.sportBadge,
                    {
                      backgroundColor: `${sportThemeColor}12`,
                      borderColor: `${sportThemeColor}30`,
                    },
                  ]}
                >
                  <Ionicons name="fitness-outline" size={12} color={sportThemeColor} />
                  <Text style={[styles.sportBadgeText, { color: sportThemeColor }]}> 
                    {sportConfig.sportName}
                  </Text>
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
                  <Text style={[styles.shotCountBadgeText, { color: sportThemeColor }]}>
                    {data.metrics.metricValues.shotCount} shots
                  </Text>
                </View>
              )}
            </View>
          </View>

          {diagnosticsExpanded && (
            <View
              style={[
                styles.diagnosticsBody,
                styles.diagnosticsBodyActive,
                {
                  borderColor: `${sportThemeColor}26`,
                  backgroundColor: `${sportThemeColor}08`,
                },
              ]}
            >
              {diagnosticsLoading ? (
                <ActivityIndicator size="small" color={sportThemeColor} />
              ) : diagnostics ? (
                <>
                  <View style={styles.diagHeaderRow}>
                    <View style={styles.diagHeaderLeft}>
                      <Ionicons name="sparkles-outline" size={14} color={sportThemeColor} />
                      <Text style={styles.diagHeaderTitle}>AI Diagnostics</Text>
                    </View>
                    <View style={styles.diagHeaderRight}>
                      <Text style={styles.diagHeaderHint}>Confidence {diagnostics.aiConfidencePct.toFixed(1)}%</Text>
                    </View>
                  </View>

                  <View style={styles.diagBlockCard}>
                    <Text style={styles.diagBlockTitle}>AI Insight</Text>
                    <View style={styles.diagRow}>
                      <Text style={styles.diagLabel}>Detected Category</Text>
                      <Text style={styles.diagValueText}>
                        {(() => {
                          const detectedCategory = toCamelCaseLabel(diagnostics.detectedMovement);
                          return detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1);
                        })()}
                      </Text>
                    </View>
                    <View style={styles.diagRow}>
                      <Text style={styles.diagLabel}>Quality</Text>
                      <Text style={styles.diagValueText}>{diagnostics.videoQuality}</Text>
                    </View>
                    <Text style={styles.diagSubTitle}>Classification Rationale</Text>
                    <Text style={styles.diagParagraph}>{diagnostics.classificationRationale}</Text>
                  </View>

                  <View style={styles.diagBlockCard}>
                    <Text style={styles.diagBlockTitle}>Scoring Basis</Text>
                    <View style={styles.diagRow}>
                      <Text style={styles.diagLabel}>Active Time</Text>
                      <Text style={styles.diagValueText}>{diagnostics.activeTimeSec.toFixed(2)}s ({diagnostics.activeTimePct.toFixed(1)}%)</Text>
                    </View>
                    <View style={styles.diagRow}>
                      <Text style={styles.diagLabel}>Shots for Scoring</Text>
                      <Text style={styles.diagValueText}>{diagnostics.shotsConsideredForScoring}</Text>
                    </View>
                    <View style={styles.diagRow}>
                      <Text style={styles.diagLabel}>Pose Coverage</Text>
                      <Text style={styles.diagValueText}>{diagnostics.poseCoveragePct.toFixed(1)}%</Text>
                    </View>
                  </View>

                  <View style={styles.diagBlockCard}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAdvancedExpanded((prev) => !prev);
                      }}
                      style={({ pressed }) => [
                        styles.techHeaderRow,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={styles.diagBlockTitle}>Advanced Analysis</Text>
                      <Ionicons
                        name={advancedExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#94A3B8"
                      />
                    </Pressable>

                    {advancedExpanded && (
                      <>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>Total Frames</Text>
                          <Text style={styles.diagValueText}>{diagnostics.totalFrames}</Text>
                        </View>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>Frames for Scoring</Text>
                          <Text style={styles.diagValueText}>{diagnostics.framesConsideredForScoring}</Text>
                        </View>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>Shots Detected</Text>
                          <Text style={styles.diagValueText}>{diagnostics.shotsDetected}</Text>
                        </View>

                        <Text style={styles.diagSubTitle}>Shot-Level Labels</Text>
                        {diagnostics.shotSegments.length > 0 ? (
                          diagnostics.shotSegments.map((segment) => {
                            const detectedCategory = toCamelCaseLabel(segment.label);
                            const displayCategory = detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1);
                            const debug = segment.classificationDebug;
                            return (
                              <View key={`shot-${segment.index}`} style={styles.diagRowStacked}>
                                <Text style={styles.diagValueText}>Shot {segment.index}: {displayCategory}</Text>
                                <Text style={styles.diagItem}>
                                  Used for Scoring: {segment.includedForScoring ? "Yes" : "No"}
                                </Text>
                                <Text style={styles.diagItem}>
                                  Frames {segment.startFrame}–{segment.endFrame} ({segment.frames} frames)
                                </Text>
                                {debug && (
                                  <Text style={styles.diagItem}>
                                    Debug: side {debug.dominantSide ?? "-"} • cross-body {debug.isCrossBody ? "yes" : "no"} • serve {debug.isServe ? "yes" : "no"} • compact {debug.isCompactForward ? "yes" : "no"} • overhead {debug.isOverhead ? "yes" : "no"}
                                  </Text>
                                )}
                                {debug && (
                                  <Text style={styles.diagItem}>
                                    Speeds rw/lw/max {debug.rightWristSpeed?.toFixed(3) ?? "-"}/{debug.leftWristSpeed?.toFixed(3) ?? "-"}/{debug.maxWristSpeed?.toFixed(3) ?? "-"} • arc {debug.swingArcRatio?.toFixed(3) ?? "-"} • contact {debug.contactHeightRatio?.toFixed(3) ?? "-"}
                                  </Text>
                                )}
                              </View>
                            );
                          })
                        ) : (
                          <Text style={styles.diagItem}>No shot segments available</Text>
                        )}

                        {diagnostics.excludedShots.count > 0 && (
                          <>
                            <Text style={styles.diagSubTitle}>Excluded Shots</Text>
                            <View style={styles.diagRow}>
                              <Text style={styles.diagLabel}>Excluded Count</Text>
                              <Text style={styles.diagValueText}>{diagnostics.excludedShots.count}</Text>
                            </View>
                            {diagnostics.excludedShots.reasons.map((reason, idx) => (
                              <Text key={`excluded-reason-${idx}`} style={styles.diagItem}>• {reason}</Text>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </View>

                  <View style={styles.diagBlockCard}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTechnicalExpanded((prev) => !prev);
                      }}
                      style={({ pressed }) => [
                        styles.techHeaderRow,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={styles.diagBlockTitle}>Technical Details</Text>
                      <Ionicons
                        name={technicalExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#94A3B8"
                      />
                    </Pressable>

                    {technicalExpanded && (
                      <>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>Duration</Text>
                          <Text style={styles.diagValueText}>{diagnostics.videoDurationSec.toFixed(2)}s</Text>
                        </View>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>FPS</Text>
                          <Text style={styles.diagValueText}>{diagnostics.fps.toFixed(2)}</Text>
                        </View>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>File Size</Text>
                          <Text style={styles.diagValueText}>{formatBytes(diagnostics.fileSizeBytes)}</Text>
                        </View>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>Resolution</Text>
                          <Text style={styles.diagValueText}>{diagnostics.resolution.width}x{diagnostics.resolution.height}</Text>
                        </View>
                        <View style={styles.diagRow}>
                          <Text style={styles.diagLabel}>Bitrate</Text>
                          <Text style={styles.diagValueText}>{diagnostics.bitrateKbps.toFixed(2)} kbps</Text>
                        </View>
                      </>
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.diagItem}>Diagnostics unavailable for this video.</Text>
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
                {analysis.status === "completed" && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const gpsLat = analysis.gpsLat ?? videoMetadata?.gpsLat ?? null;
                      const gpsLng = analysis.gpsLng ?? videoMetadata?.gpsLng ?? null;
                      Alert.alert(
                        "Video metadata extracted",
                        `Captured At: ${formatDateWithTimezone(analysis.capturedAt, profileTimeZone)}\n` +
                          `Created At: ${formatDateWithTimezone(analysis.createdAt, profileTimeZone)}\n` +
                          `GPS: ${gpsLat != null && gpsLng != null ? `${Number(gpsLat).toFixed(6)}, ${Number(gpsLng).toFixed(6)}` : videoMetadataLoading ? "Loading..." : "Not available"}\n` +
                          `Duration: ${diagnostics ? `${diagnostics.videoDurationSec.toFixed(2)}s` : diagnosticsLoading ? "Loading..." : "Not available"}\n` +
                          `FPS: ${diagnostics ? diagnostics.fps.toFixed(2) : diagnosticsLoading ? "Loading..." : "Not available"}\n` +
                          `Resolution: ${diagnostics ? `${diagnostics.resolution.width}x${diagnostics.resolution.height}` : diagnosticsLoading ? "Loading..." : "Not available"}\n` +
                          `File Size: ${diagnostics ? formatBytes(diagnostics.fileSizeBytes) : diagnosticsLoading ? "Loading..." : "Not available"}\n` +
                          `Bitrate: ${diagnostics ? `${diagnostics.bitrateKbps.toFixed(2)} kbps` : diagnosticsLoading ? "Loading..." : "Not available"}`,
                      );
                    }}
                    style={({ pressed }) => [
                      styles.videoInfoFloatingButton,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={17} color="#94A3B8" />
                  </Pressable>
                )}
                {analysis.status === "completed" && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setManualAnnotationVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.manualAnnotationFloatingButton,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={manualAnnotationDone ? "#34D399" : "#94A3B8"}
                    />
                  </Pressable>
                )}
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
                  period === p.key && {
                    backgroundColor: sportThemeColor,
                    borderColor: sportThemeColor,
                  },
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
              <View
                style={[
                  styles.overallCard,
                  {
                    backgroundColor: `${sportThemeColor}12`,
                    borderColor: `${sportThemeColor}30`,
                  },
                ]}
              >
                <View style={styles.overallHeader}>
                  <Ionicons name="chatbubbles" size={18} color={sportThemeColor} />
                  <Text style={[styles.overallHeading, { color: sportThemeColor }]}>Overall</Text>
                </View>
                <Text style={styles.summaryText}>
                  {coaching.simpleExplanation}
                </Text>
              </View>
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
                color={(pendingRating === "up" || (!pendingRating && feedback?.rating === "up")) ? "#34D399" : "#64748B"}
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
                color={(pendingRating === "down" || (!pendingRating && feedback?.rating === "down")) ? "#F87171" : "#64748B"}
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
              color={manualSaveMessage === "Saving..." ? "#94A3B8" : manualSaveMessage === "Save Failed" ? "#F87171" : "#34D399"}
            />
            <Text style={styles.savedBreadcrumbText}>{manualSaveMessage}</Text>
          </View>
        </View>
      )}

      <Modal
        visible={feedbackSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeFeedbackSheet}
      >
        <View style={styles.feedbackOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFeedbackSheet} />
          <KeyboardAvoidingView
            style={styles.feedbackKeyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
          >
            <Animated.View
              style={[
                styles.feedbackSheet,
                {
                  paddingBottom: Math.max(insets.bottom + 52, 60),
                  transform: [{ translateY: feedbackSheetTranslateY }],
                },
              ]}
            >
              <View style={styles.feedbackSheetContent}>
                <View style={styles.feedbackSheetHandle} {...feedbackSheetPanResponder.panHandlers} />
                <Text style={styles.feedbackSheetTitle}>Help us improve AI diagnostics</Text>
                <Text style={styles.feedbackSheetSubtitle}>
                  Share any discrepancy you notice in diagnostics or metrics.
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
                  placeholderTextColor="#64748B"
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
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={manualAnnotationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualAnnotationVisible(false)}
      >
        <View style={styles.manualOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setManualAnnotationVisible(false)}
          />
          <KeyboardAvoidingView
            style={styles.manualKeyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
          >
            <View
              style={[
                styles.manualSheet,
                { paddingBottom: Math.max(insets.bottom + 20, 24) },
              ]}
            >
              <View style={styles.manualSheetHandle} />
              <View style={styles.manualHeaderRow}>
                <Text style={styles.manualTitle}>Manual Annotation</Text>
                <Pressable
                  onPress={() => setManualAnnotationVisible(false)}
                  style={({ pressed }) => [
                    styles.manualCloseButton,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons name="close" size={16} color="#F2F2F7" />
                </Pressable>
              </View>

              <View style={styles.manualShotActionsRow}>
                <Pressable
                  onPress={handleAddManualShot}
                  style={({ pressed }) => [
                    styles.manualShotActionButton,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={14} color={sportThemeColor} />
                  <Text style={styles.manualShotActionText}>Add Shot</Text>
                </Pressable>
                <Pressable
                  onPress={handleRemoveManualShot}
                  disabled={manualShotLabels.length === 0}
                  style={({ pressed }) => [
                    styles.manualShotActionButton,
                    manualShotLabels.length === 0 && styles.manualShotActionDisabled,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons name="remove" size={14} color={manualShotLabels.length === 0 ? "#64748B" : "#FCA5A5"} />
                  <Text
                    style={[
                      styles.manualShotActionText,
                      manualShotLabels.length === 0 && styles.manualShotActionTextDisabled,
                    ]}
                  >
                    Remove Shot
                  </Text>
                </Pressable>
              </View>

              <ScrollView style={styles.manualShotList} contentContainerStyle={styles.manualShotListContent}>
                {manualShotLabels.map((shotLabel, index) => {
                  const labelText = toCamelCaseLabel(shotLabel || "unknown");
                  const displayLabel = labelText.charAt(0).toUpperCase() + labelText.slice(1);
                  const dropdownOpen = activeShotDropdownIndex === index;
                  return (
                    <View
                      key={`manual-shot-${index}`}
                      style={[styles.manualShotRow, dropdownOpen && { zIndex: 10 }]}
                    >
                      <Text
                        style={[
                          styles.manualShotNumber,
                          {
                            backgroundColor: `${sportThemeColor}20`,
                            borderColor: `${sportThemeColor}44`,
                            color: sportThemeColor,
                          },
                        ]}
                      >
                        {index + 1}.
                      </Text>
                      <View style={styles.manualDropdownWrap}>
                        <Pressable
                          onPress={() =>
                            setActiveShotDropdownIndex((prev) => (prev === index ? null : index))
                          }
                          style={({ pressed }) => [
                            styles.manualDropdownTrigger,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                        >
                          <Text style={styles.manualDropdownTriggerText}>{displayLabel}</Text>
                          <Ionicons
                            name={dropdownOpen ? "chevron-up" : "chevron-down"}
                            size={14}
                            color="#94A3B8"
                          />
                        </Pressable>
                        {dropdownOpen && (
                          <View style={styles.manualDropdownMenu}>
                            {movementTypeOptions.map((option) => {
                              const optionText = toCamelCaseLabel(option);
                              const optionDisplay = optionText.charAt(0).toUpperCase() + optionText.slice(1);
                              const selected = option === shotLabel;
                              return (
                                <Pressable
                                  key={`manual-option-${index}-${option}`}
                                  onPress={() => {
                                    setManualShotLabels((prev) => {
                                      const next = [...prev];
                                      next[index] = option;
                                      return next;
                                    });
                                    setActiveShotDropdownIndex(null);
                                  }}
                                  style={({ pressed }) => [
                                    styles.manualDropdownOption,
                                    selected && {
                                      borderColor: sportThemeColor,
                                      backgroundColor: `${sportThemeColor}20`,
                                    },
                                    { opacity: pressed ? 0.85 : 1 },
                                  ]}
                                >
                                  <Text style={styles.manualDropdownOptionText}>{optionDisplay}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <Pressable
                onPress={handleSaveManualAnnotation}
                style={({ pressed }) => [
                  styles.shotReportSaveButton,
                  !shotAnnotationMutation.isPending && { backgroundColor: sportThemeColor },
                  shotAnnotationMutation.isPending && styles.shotReportSaveButtonDisabled,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                disabled={shotAnnotationMutation.isPending}
              >
                <Text style={styles.shotReportSaveText}>
                  {shotAnnotationMutation.isPending ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
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
    alignItems: "center",
    gap: 8,
  },
  badgesGroup: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  scoreSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  diagnosticsIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
  },
  diagnosticsBody: {
    borderWidth: 1,
    borderColor: "#2A2A5040",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#131328",
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
    borderBottomColor: "#2A2A5035",
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
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
    letterSpacing: 0.3,
  },
  diagHeaderHint: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
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
    backgroundColor: "#0A0A1A90",
    borderWidth: 1,
    borderColor: "#2A2A5035",
  },
  diagLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  diagValueText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  diagSubTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
    letterSpacing: 0.3,
    marginTop: 6,
    textTransform: "uppercase",
  },
  diagRowStacked: {
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#0A0A1A90",
    borderWidth: 1,
    borderColor: "#2A2A5035",
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
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A70",
  },
  diagBlockTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  diagItem: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },
  diagParagraph: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
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
  shotCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#60A5FA12",
    borderWidth: 1,
    borderColor: "#60A5FA30",
  },
  shotCountBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#60A5FA",
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
    borderColor: "#47556966",
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
    borderColor: "#47556966",
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
  shotReportCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
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
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  shotReportMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  shotReportSubTitle: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  shotReportList: {
    gap: 6,
  },
  shotReportRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A90",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  shotReportRowText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  shotReportRowMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  shotReportInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    color: "#F8FAFC",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shotReportSaveButton: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#6C5CE7",
  },
  shotReportSaveButtonDisabled: {
    backgroundColor: "#4C4A68",
  },
  shotReportSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
    borderColor: "#2A2A5060",
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
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  manualSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },
  manualShotList: {
    maxHeight: 448,
  },
  manualShotListContent: {
    gap: 10,
    paddingBottom: 6,
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
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualShotActionDisabled: {
    backgroundColor: "#111827",
    borderColor: "#2A2A5035",
  },
  manualShotActionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#E2E8F0",
  },
  manualShotActionTextDisabled: {
    color: "#64748B",
  },
  manualShotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A90",
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
    fontFamily: "Inter_600SemiBold",
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
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manualDropdownTriggerText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#F8FAFC",
  },
  manualDropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#101025",
    padding: 8,
    gap: 6,
  },
  manualDropdownOption: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#0A0A1A",
    borderWidth: 1,
    borderColor: "#2A2A5035",
  },
  manualDropdownOptionActive: {
    borderColor: "#6C5CE7",
    backgroundColor: "#6C5CE720",
  },
  manualDropdownOptionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#E2E8F0",
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
    borderColor: "#2A2A5060",
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
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  feedbackSheetSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },
  feedbackGroupTitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
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
    backgroundColor: "#0A0A1A",
    borderWidth: 1,
    borderColor: "#2A2A5060",
  },
  feedbackChipActive: {
    borderColor: "#6C5CE7",
    backgroundColor: "#6C5CE720",
  },
  feedbackChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  feedbackChipTextActive: {
    color: "#E2E8F0",
  },
  feedbackSheetInput: {
    minHeight: 72,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
  },
  feedbackSheetGhostText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  feedbackSheetSubmit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#6C5CE7",
  },
  feedbackSheetSubmitDisabled: {
    backgroundColor: "#4C4A68",
  },
  feedbackSheetSubmitText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
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
    borderColor: "#2A2A5060",
    backgroundColor: "#101025EE",
  },
  savedBreadcrumbText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
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
  rejectedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FBBF2414",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  tryAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6C5CE7",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  tryAgainText: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
