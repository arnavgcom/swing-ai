import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/auth-context";
import {
  type RecalculateAnalysesResponse,
  fetchAnalysisFpsSettings,
  fetchDriveMovementClassificationModelSettings,
  fetchPoseLandmarkerSettings,
  fetchSportsSettings,
  fetchVideoValidationSettings,
  type AnalysisFpsStep,
  type DriveMovementClassificationModelOptionResponse,
  type SportAvailabilityResponse,
} from "@/services/api";
import type { PoseLandmarkerModel } from "@swing-ai/shared/pose-landmarker";
import type { VideoValidationMode } from "@swing-ai/shared/video-validation";

const LOW_IMPACT_FPS_OPTIONS: Array<{
  step: AnalysisFpsStep;
  label: string;
  description: string;
}> = [
  { step: "step1", label: "Step 1", description: "Use every frame" },
  { step: "step2", label: "Step 2", description: "Use 1 out of 2 frames" },
  { step: "step3", label: "Step 3", description: "Use 1 out of 3 frames" },
];

const HIGH_IMPACT_FPS_OPTIONS: Array<{
  step: AnalysisFpsStep;
  label: string;
  description: string;
}> = [
  { step: "step1", label: "Step 1", description: "Use every frame" },
  { step: "step2", label: "Step 2", description: "Use 1 out of 2 frames" },
  { step: "step3", label: "Step 3", description: "Use 1 out of 3 frames" },
];

const VIDEO_VALIDATION_OPTIONS: Array<{
  mode: VideoValidationMode;
  label: string;
  description: string;
}> = [
  {
    mode: "disabled",
    label: "Disabled",
    description: "No validation is performed",
  },
  {
    mode: "light",
    label: "Light",
    description: "8-16 random frames",
  },
  {
    mode: "medium",
    label: "Medium",
    description: "24-48 random frames",
  },
  {
    mode: "full",
    label: "Full",
    description: "Full validation pipeline",
  },
];

const POSE_LANDMARKER_OPTIONS: Array<{
  model: PoseLandmarkerModel;
  label: string;
  description: string;
}> = [
  { model: "lite", label: "Lite", description: "Fastest default model" },
  { model: "full", label: "Full", description: "Higher accuracy with more compute" },
  { model: "heavy", label: "Heavy", description: "Highest accuracy and slowest runtime" },
];

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

const RECALC_RUN_STORAGE_KEY = "swingai_active_recalc_run";

type PersistedRecalcState = {
  run: RecalculateAnalysesResponse;
  progress?: unknown;
};

const formatRecalcModelLabel = (run: RecalculateAnalysesResponse | null): string | null => {
  if (!run?.selectedModelVersion) return null;
  const source = String(run.selectedModelSource || "active").trim();
  const sourceLabel = source ? `${source.charAt(0).toUpperCase()}${source.slice(1)}` : "Active";
  return `${sourceLabel} v${run.selectedModelVersion}`;
};

const toSportPreferenceKey = (sportName?: string | null): string => {
  return String(sportName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
};

const summarizeEnabledSports = (sports: SportAvailabilityResponse[]): string => {
  const enabledSports = sports.filter((sport) => sport.enabled).map((sport) => sport.name.trim()).filter(Boolean);
  if (enabledSports.length === 0) {
    return "No sports enabled";
  }

  const preview = enabledSports.slice(0, 3).join(", ");
  const remaining = enabledSports.length - 3;
  return remaining > 0
    ? `${enabledSports.length} enabled: ${preview} +${remaining} more`
    : `${enabledSports.length} enabled: ${preview}`;
};

export default function ConfigureScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { user } = useAuth();
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const childRouteParams = returnTo ? { returnTo } : undefined;
  const [videoValidationMode, setVideoValidationMode] = useState<VideoValidationMode>("disabled");
  const [lowImpactFpsStep, setLowImpactFpsStep] = useState<AnalysisFpsStep>("step2");
  const [highImpactFpsStep, setHighImpactFpsStep] = useState<AnalysisFpsStep>("step1");
  const [poseLandmarkerModel, setPoseLandmarkerModel] = useState<PoseLandmarkerModel>("lite");
  const [driveMovementClassificationModelOptions, setDriveMovementClassificationModelOptions] = useState<DriveMovementClassificationModelOptionResponse[]>([]);
  const [selectedClassificationModelKey, setSelectedClassificationModelKey] = useState<string>("tennis-active");
  const [classificationModelLoading, setClassificationModelLoading] = useState(false);
  const [sports, setSports] = useState<SportAvailabilityResponse[]>([]);
  const [activeRecalcRun, setActiveRecalcRun] = useState<RecalculateAnalysesResponse | null>(null);
  const canUseAdminApis = normalizeRole(user?.role) === "admin";

  const refreshAdminSettings = React.useCallback(async () => {
    const [validationSettings, fpsSettings, poseSettings, sportsSettings, classificationModelSettings] = await Promise.all([
      fetchVideoValidationSettings(),
      fetchAnalysisFpsSettings(),
      fetchPoseLandmarkerSettings(),
      fetchSportsSettings(),
      fetchDriveMovementClassificationModelSettings(),
    ]);
    setVideoValidationMode(validationSettings.mode);
    setLowImpactFpsStep(fpsSettings.lowImpactStep);
    setHighImpactFpsStep(fpsSettings.highImpactStep);
    setPoseLandmarkerModel(poseSettings.model);
    setSports(sportsSettings.sports || []);
    setDriveMovementClassificationModelOptions(classificationModelSettings.options || []);
    setSelectedClassificationModelKey(classificationModelSettings.selectedModelKey || "tennis-active");
  }, []);

  const sportsSummary = React.useMemo(() => summarizeEnabledSports(sports), [sports]);

  const scoreMetricSummary = React.useMemo(() => {
    const sportLabel = String(user?.sportsInterests || "").trim();
    const sportKey = toSportPreferenceKey(sportLabel);
    const scoreMap =
      user?.selectedScoreSectionsBySport && typeof user.selectedScoreSectionsBySport === "object"
        ? user.selectedScoreSectionsBySport
        : {};
    const metricMap =
      user?.selectedMetricKeysBySport && typeof user.selectedMetricKeysBySport === "object"
        ? user.selectedMetricKeysBySport
        : {};

    const scopedSections = sportKey ? scoreMap[sportKey] : null;
    const scopedMetrics = sportKey ? metricMap[sportKey] : null;
    const fallbackSections = Array.isArray(user?.selectedScoreSections) ? user.selectedScoreSections : [];
    const fallbackMetrics = Array.isArray(user?.selectedMetricKeys) ? user.selectedMetricKeys : [];
    const selectedSections = Array.isArray(scopedSections) && scopedSections.length > 0 ? scopedSections : fallbackSections;
    const selectedMetrics = Array.isArray(scopedMetrics) && scopedMetrics.length > 0 ? scopedMetrics : fallbackMetrics;

    if (selectedSections.length === 0 && selectedMetrics.length === 0) {
      return "No score or metric preferences saved yet";
    }

    const prefix = sportLabel ? `${sportLabel}: ` : "";
    return `${prefix}${selectedSections.length} sections · ${selectedMetrics.length} metrics selected`;
  }, [user]);

  const selectedClassificationModel = React.useMemo(() => {
    return driveMovementClassificationModelOptions.find((option) => option.key === selectedClassificationModelKey)
      || driveMovementClassificationModelOptions[0]
      || {
        key: "tennis-active",
        label: "Current production model",
        description: "Uses the live tennis classifier",
        badge: "Active",
      };
  }, [driveMovementClassificationModelOptions, selectedClassificationModelKey]);

  const classificationModelSummary = selectedClassificationModel.badge
    ? `Current model: ${selectedClassificationModel.label} (${selectedClassificationModel.badge.toLowerCase()})`
    : `Current model: ${selectedClassificationModel.label}`;

  const classificationModelCardBadge = selectedClassificationModel.badge || "Selected";
  const activeRecalcModelLabel = formatRecalcModelLabel(activeRecalcRun);

  useEffect(() => {
    if (!canUseAdminApis) {
      router.replace("/profile");
      return;
    }

    let active = true;
    (async () => {
      try {
        await refreshAdminSettings();
        if (!active) return;
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  useFocusEffect(
    React.useCallback(() => {
      if (!canUseAdminApis) return undefined;
      void refreshAdminSettings().catch(() => undefined);

      void (async () => {
        try {
          const raw = await AsyncStorage.getItem(RECALC_RUN_STORAGE_KEY);
          if (!raw) {
            setActiveRecalcRun(null);
            return;
          }
          const parsed = JSON.parse(raw) as PersistedRecalcState | RecalculateAnalysesResponse;
          const nextRun = "run" in parsed ? parsed.run : parsed;
          if (Array.isArray(nextRun?.queuedAnalysisIds) && nextRun.queuedAnalysisIds.length > 0) {
            setActiveRecalcRun(nextRun);
            return;
          }
          setActiveRecalcRun(null);
        } catch {
          setActiveRecalcRun(null);
        }
      })();

      return undefined;
    }, [canUseAdminApis, refreshAdminSettings]),
  );

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    if (returnTo && returnTo !== "/profile") {
      router.replace(returnTo as any);
      return;
    }
    router.replace("/profile");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}> 
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Configure</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Platform</Text>
          <View style={styles.sectionCards}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/storage-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="cloud-outline" size={20} color="#64D2FF" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Storage / R2 Settings</Text>
                <Text style={styles.navCardDescription}>
                  Video storage mode, R2 credentials & folder prefixes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/sports-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="tennisball-outline" size={20} color="#FF9F0A" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Sports</Text>
                <Text style={styles.navCardDescription}>
                  {sportsSummary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Analysis Pipeline</Text>
          <View style={styles.sectionCards}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/validation-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#30D158" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Video Validation</Text>
                <Text style={styles.navCardDescription}>
                  Current mode: {VIDEO_VALIDATION_OPTIONS.find((option) => option.mode === videoValidationMode)?.label || "Disabled"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/fps-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="speedometer-outline" size={20} color="#64D2FF" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Analysis FPS</Text>
                <Text style={styles.navCardDescription}>
                  Low: {LOW_IMPACT_FPS_OPTIONS.find((option) => option.step === lowImpactFpsStep)?.label || "Step 2"} | High: {HIGH_IMPACT_FPS_OPTIONS.find((option) => option.step === highImpactFpsStep)?.label || "Step 1"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/pose-landmarker-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="body-outline" size={20} color="#F97316" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Pose Landmarker Model</Text>
                <Text style={styles.navCardDescription}>
                  Current model: {POSE_LANDMARKER_OPTIONS.find((option) => option.model === poseLandmarkerModel)?.label || "Lite"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/drive-movement-classification-model-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                {classificationModelLoading ? (
                  <ActivityIndicator size="small" color="#BF5AF2" />
                ) : (
                  <Ionicons name="git-branch-outline" size={20} color="#BF5AF2" />
                )}
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Drive Movement Classification Model</Text>
                <Text style={styles.navCardDescription}>
                  {classificationModelSummary}
                </Text>
              </View>
              <View style={styles.inlineStatusBadge}>
                <Text style={styles.inlineStatusBadgeText}>{classificationModelCardBadge}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/ml-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="hardware-chip-outline" size={20} color="#FF9F0A" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>ML / LSTM Settings</Text>
                <Text style={styles.navCardDescription}>
                  Ensemble weights, thresholds & training params
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Scoring</Text>
          <View style={styles.sectionCards}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/score-metrics-selection", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="options-outline" size={20} color="#BF5AF2" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle} numberOfLines={1}>
                  Performance Metrics Selection
                </Text>
                <Text style={styles.navCardDescription} numberOfLines={1}>
                  {scoreMetricSummary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/recalculate-metrics", params: childRouteParams });
              }}
              style={({ pressed }) => [
                styles.navCard,
                { transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="refresh-outline" size={20} color="#64D2FF" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Recalculate Performance Metrics</Text>
                <Text style={styles.navCardDescription}>
                  {activeRecalcRun
                    ? activeRecalcModelLabel
                      ? `${activeRecalcModelLabel} in progress for ${activeRecalcRun.queuedAnalyses} queued analyses`
                      : `Recalc in progress for ${activeRecalcRun.queuedAnalyses} queued analyses`
                    : "Re-run scoring and performance metrics for eligible analyses"}
                </Text>
              </View>
              {activeRecalcRun ? (
                <View style={styles.inlineStatusBadgeActive}>
                  <ActivityIndicator size="small" color="#64D2FF" />
                  <Text style={styles.inlineStatusBadgeActiveText}>In progress</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Players</Text>
          <View style={styles.sectionCards}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/add-player", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="person-add-outline" size={20} color="#FF9F0A" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Add Player</Text>
                <Text style={styles.navCardDescription}>
                  Create a new player profile for uploads and analysis
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#38383A",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionGroup: {
    gap: 10,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCards: {
    gap: 12,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  navCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2C2C2E",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(84,84,88,0.65)",
  },
  navCardBody: {
    flex: 1,
    gap: 3,
  },
  navCardDisabled: {
    opacity: 0.7,
  },
  inlineStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BF5AF255",
    backgroundColor: "#BF5AF222",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineStatusBadgeActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0A84FF40",
    backgroundColor: "#0A84FF14",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineStatusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#BF5AF2",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inlineStatusBadgeActiveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64D2FF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  navCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  navCardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  validationCard: {
    gap: 10,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  validationHeadline: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  validationSubtext: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  validationOptionsList: {
    gap: 8,
  },
  validationOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  validationOptionSelected: {
    borderColor: "#30D15866",
    backgroundColor: "#30D15814",
  },
  validationOptionDisabled: {
    opacity: 0.7,
  },
  validationOptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  validationOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  validationOptionLabelSelected: {
    color: "#30D158",
  },
  validationOptionDescription: {
    fontSize: 12,
    color: "#8E8E93",
  },
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
    zIndex: 30,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toastSuccess: {
    borderColor: "#30D15840",
    backgroundColor: "#30D15814",
  },
  toastError: {
    borderColor: "#FF453A30",
    backgroundColor: "#FF453A14",
  },
  toastText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#48484A",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#38383A",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0A84FF20",
  },
  modalDoneText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A84FF",
  },
  modalIntroText: {
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  modalOptionsList: {
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  modalCreateSection: {
    gap: 10,
    marginTop: 12,
    marginBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#38383A",
    paddingTop: 14,
    paddingHorizontal: 4,
  },
  modalCreateTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalCreateHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  modalCreateFields: {
    gap: 10,
  },
  modalFieldGroup: {
    gap: 6,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  modalTextInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalAddButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BF5AF255",
    backgroundColor: "#BF5AF222",
    paddingVertical: 12,
  },
  modalAddButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#BF5AF2",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalItemSelected: {
    borderColor: "#BF5AF266",
    backgroundColor: "#BF5AF212",
  },
  modalItemDisabled: {
    opacity: 0.72,
  },
  modalItemMeta: {
    flex: 1,
    gap: 4,
  },
  modalItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF453A14",
    borderWidth: 1,
    borderColor: "#FF453A30",
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C7C7CC",
  },
  modalItemTextSelected: {
    color: "#FFFFFF",
  },
  modalItemHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
  },
  modalBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BF5AF255",
    backgroundColor: "#BF5AF222",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#BF5AF2",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});