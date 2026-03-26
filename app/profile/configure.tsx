import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/query-client";
import {
  fetchAnalysisFpsSettings,
  fetchDriveMovementClassificationModelSettings,
  fetchPoseLandmarkerSettings,
  fetchSportsSettings,
  fetchVideoValidationSettings,
  fetchVideoStorageSettings,
  type AnalysisFpsStep,
  type DriveMovementClassificationModelOptionResponse,
  type SportAvailabilityResponse,
  type VideoValidationMode,
  updateVideoStorageSettings,
} from "@/lib/api";
import type { PoseLandmarkerModel } from "@shared/pose-landmarker";

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
  const [videoStorageMode, setVideoStorageMode] = useState<"filesystem" | "r2">("filesystem");
  const [videoStorageLoading, setVideoStorageLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcToast, setRecalcToast] = useState<{
    visible: boolean;
    message: string;
    tone: "success" | "error";
  }>({ visible: false, message: "", tone: "success" });
  const recalcToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canUseAdminApis = normalizeRole(user?.role) === "admin";

  const refreshAdminSettings = React.useCallback(async () => {
    const [storageSettings, validationSettings, fpsSettings, poseSettings, sportsSettings, classificationModelSettings] = await Promise.all([
      fetchVideoStorageSettings(),
      fetchVideoValidationSettings(),
      fetchAnalysisFpsSettings(),
      fetchPoseLandmarkerSettings(),
      fetchSportsSettings(),
      fetchDriveMovementClassificationModelSettings(),
    ]);
    setVideoStorageMode(storageSettings.mode);
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
      return undefined;
    }, [canUseAdminApis, refreshAdminSettings]),
  );

  useEffect(() => {
    return () => {
      if (recalcToastTimerRef.current) {
        clearTimeout(recalcToastTimerRef.current);
      }
    };
  }, []);

  const handleVideoStorageToggle = async (enabled: boolean) => {
    if (!canUseAdminApis) return;
    setVideoStorageLoading(true);
    const nextMode = enabled ? "r2" : "filesystem";
    try {
      await updateVideoStorageSettings(nextMode);
      setVideoStorageMode(nextMode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update video storage mode");
    } finally {
      setVideoStorageLoading(false);
    }
  };

  const handleRecalculateMetrics = async () => {
    const runRecalculation = async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecalculating(true);
      try {
        const res = await apiRequest("POST", "/api/analyses/recalculate");
        const data = await res.json();
        const queued = Number(data?.queuedAnalyses ?? 0);

        if (recalcToastTimerRef.current) {
          clearTimeout(recalcToastTimerRef.current);
        }

        setRecalcToast({
          visible: true,
          tone: "success",
          message: `Started in background for ${queued} videos`,
        });

        await queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });
        await queryClient.refetchQueries({ queryKey: ["analyses-summary"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        recalcToastTimerRef.current = setTimeout(() => {
          setRecalcToast((prev) => ({ ...prev, visible: false }));
        }, 1800);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Failed to recalc";
        Alert.alert("Error", reason);
        setRecalcToast({
          visible: true,
          tone: "error",
          message: reason,
        });
      } finally {
        setRecalculating(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = typeof globalThis.confirm === "function"
        ? globalThis.confirm(
            "This processing can take time and will run in the background. Do you want to continue?",
          )
        : true;

      if (confirmed) {
        await runRecalculation();
      }
      return;
    }

    Alert.alert(
      "Recalculate Score/Metrics?",
      "This processing can take time and will run in the background. Do you want to continue?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: () => {
            void runRecalculation();
          },
        },
      ],
    );
  };

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
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Configure</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Platform</Text>
          <View style={styles.sectionCards}>
            <View style={styles.navCard}>
              <View style={styles.navCardIconWrap}>
                <Ionicons
                  name={videoStorageMode === "r2" ? "cloud-outline" : "folder-open-outline"}
                  size={20}
                  color={videoStorageMode === "r2" ? "#38BDF8" : "#6C5CE7"}
                />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Video Storage Mode</Text>
                <Text style={styles.navCardDescription}>
                  {videoStorageMode === "r2"
                    ? "Store uploaded videos in Cloudflare R2"
                    : "Store uploaded videos on the local filesystem"}
                </Text>
              </View>
              <View style={styles.storageModeControl}>
                <Text style={styles.storageModeValue}>
                  {videoStorageMode === "r2" ? "R2" : "Filesystem"}
                </Text>
              </View>
              <Switch
                value={videoStorageMode === "r2"}
                disabled={videoStorageLoading}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleVideoStorageToggle(value);
                }}
                trackColor={{ false: "#2A2A50", true: "#38BDF840" }}
                thumbColor={videoStorageMode === "r2" ? "#38BDF8" : "#64748B"}
              />
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/sports-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="tennisball-outline" size={20} color="#F59E0B" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Sports</Text>
                <Text style={styles.navCardDescription}>
                  {sportsSummary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
                <Ionicons name="shield-checkmark-outline" size={20} color="#34D399" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Video Validation</Text>
                <Text style={styles.navCardDescription}>
                  Current mode: {VIDEO_VALIDATION_OPTIONS.find((option) => option.mode === videoValidationMode)?.label || "Disabled"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/fps-settings", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="speedometer-outline" size={20} color="#38BDF8" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Analysis FPS</Text>
                <Text style={styles.navCardDescription}>
                  Low: {LOW_IMPACT_FPS_OPTIONS.find((option) => option.step === lowImpactFpsStep)?.label || "Step 2"} | High: {HIGH_IMPACT_FPS_OPTIONS.find((option) => option.step === highImpactFpsStep)?.label || "Step 1"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
                  <ActivityIndicator size="small" color="#A78BFA" />
                ) : (
                  <Ionicons name="git-branch-outline" size={20} color="#A78BFA" />
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
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
                <Ionicons name="options-outline" size={20} color="#A78BFA" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Select Score/Metrics</Text>
                <Text style={styles.navCardDescription}>
                  {scoreMetricSummary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>

            <Pressable
              onPress={handleRecalculateMetrics}
              disabled={recalculating}
              style={({ pressed }) => [
                styles.navCard,
                recalculating && styles.navCardDisabled,
                { transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
            >
              <View style={styles.navCardIconWrap}>
                {recalculating ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color="#38BDF8" />
                )}
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Recalc Score/Metrics</Text>
                <Text style={styles.navCardDescription}>
                  Re-run scoring and metrics for eligible analyses
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/profile/dataset-insights", params: childRouteParams });
              }}
              style={({ pressed }) => [styles.navCard, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
            >
              <View style={styles.navCardIconWrap}>
                <Ionicons name="analytics-outline" size={20} color="#22C55E" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Dataset Insights</Text>
                <Text style={styles.navCardDescription}>
                  Coverage mix, practice vs match-play, and active model quality
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
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
                <Ionicons name="person-add-outline" size={20} color="#F59E0B" />
              </View>
              <View style={styles.navCardBody}>
                <Text style={styles.navCardTitle}>Add Player</Text>
                <Text style={styles.navCardDescription}>
                  Create a new player profile for uploads and analysis
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {recalcToast.visible ? (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={[styles.toast, recalcToast.tone === "success" ? styles.toastSuccess : styles.toastError]}>
            <Ionicons
              name={recalcToast.tone === "success" ? "checkmark-circle" : "alert-circle"}
              size={14}
              color={recalcToast.tone === "success" ? "#34D399" : "#F87171"}
            />
            <Text style={styles.toastText}>{recalcToast.message}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A36",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A36",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
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
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
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
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  navCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E1022",
    borderWidth: 1,
    borderColor: "#2A2A50",
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
    borderColor: "#A78BFA55",
    backgroundColor: "#A78BFA22",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineStatusBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#C4B5FD",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  storageModeControl: {
    alignItems: "flex-end",
    gap: 8,
  },
  storageModeValue: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  navCardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  navCardDescription: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  validationCard: {
    gap: 10,
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  validationHeadline: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  validationSubtext: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
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
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  validationOptionSelected: {
    borderColor: "#34D39966",
    backgroundColor: "#0A1F1A",
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
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  validationOptionLabelSelected: {
    color: "#DCFCE7",
  },
  validationOptionDescription: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
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
    borderColor: "#166534",
    backgroundColor: "#052E1A",
  },
  toastError: {
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1114",
  },
  toastText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#131328",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4A4A6A",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A50",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  modalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#6C5CE720",
  },
  modalDoneText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  modalIntroText: {
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
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
    borderTopWidth: 1,
    borderTopColor: "#2A2A50",
    paddingTop: 14,
    paddingHorizontal: 4,
  },
  modalCreateTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  modalCreateHint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modalCreateFields: {
    gap: 10,
  },
  modalFieldGroup: {
    gap: 6,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  modalTextInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
  },
  modalAddButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A78BFA55",
    backgroundColor: "#A78BFA22",
    paddingVertical: 12,
  },
  modalAddButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#C4B5FD",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalItemSelected: {
    borderColor: "#A78BFA66",
    backgroundColor: "#1B1331",
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
    backgroundColor: "#3F1114",
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  modalItemText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  modalItemTextSelected: {
    color: "#F5F3FF",
  },
  modalItemHint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modalBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#A78BFA55",
    backgroundColor: "#A78BFA22",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#C4B5FD",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});