import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/query-client";
import {
  fetchModelEvaluationSettings,
  fetchVideoValidationSettings,
  fetchVideoStorageSettings,
  type VideoValidationMode,
  updateModelEvaluationSettings,
  updateVideoValidationSettings,
  updateVideoStorageSettings,
} from "@/lib/api";

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

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

export default function ConfigureScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [modelEvaluationMode, setModelEvaluationMode] = useState(false);
  const [modelEvalLoading, setModelEvalLoading] = useState(false);
  const [videoValidationMode, setVideoValidationMode] = useState<VideoValidationMode>("disabled");
  const [videoValidationLoading, setVideoValidationLoading] = useState(false);
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

  useEffect(() => {
    if (!canUseAdminApis) {
      router.replace("/profile");
      return;
    }

    let active = true;
    (async () => {
      try {
        const [settings, storageSettings, validationSettings] = await Promise.all([
          fetchModelEvaluationSettings(),
          fetchVideoStorageSettings(),
          fetchVideoValidationSettings(),
        ]);
        if (!active) return;
        setModelEvaluationMode(Boolean(settings.enabled));
        setVideoStorageMode(storageSettings.mode);
        setVideoValidationMode(validationSettings.mode);
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  useEffect(() => {
    return () => {
      if (recalcToastTimerRef.current) {
        clearTimeout(recalcToastTimerRef.current);
      }
    };
  }, []);

  const handleModelEvaluationToggle = async (enabled: boolean) => {
    if (!canUseAdminApis) return;
    setModelEvalLoading(true);
    try {
      await updateModelEvaluationSettings(enabled);
      setModelEvaluationMode(enabled);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["model-evaluation-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["scoring-model-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["discrepancy-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["scoring-model-registry"] }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update Model Evaluation Mode");
    } finally {
      setModelEvalLoading(false);
    }
  };

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

  const handleVideoValidationChange = async (mode: VideoValidationMode) => {
    if (!canUseAdminApis || videoValidationLoading || mode === videoValidationMode) return;
    setVideoValidationLoading(true);
    try {
      await updateVideoValidationSettings(mode);
      setVideoValidationMode(mode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update validation mode");
    } finally {
      setVideoValidationLoading(false);
    }
  };

  const handleRecalculateMetrics = async () => {
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
        message: `Recalc of ${queued} videos started`,
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Configure</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Video Storage Mode</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfoInline}>
              <Ionicons
                name={videoStorageMode === "r2" ? "cloud" : "folder-open"}
                size={18}
                color={videoStorageMode === "r2" ? "#38BDF8" : "#6C5CE7"}
              />
              <Text style={styles.toggleText}>
                {videoStorageMode === "r2" ? "R2 on Cloud" : "Filesystem"}
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
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Model Evaluation Mode</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfoInline}>
              <Ionicons
                name={modelEvaluationMode ? "analytics" : "analytics-outline"}
                size={18}
                color={modelEvaluationMode ? "#34D399" : "#6C5CE7"}
              />
              <Text style={styles.toggleText}>
                {modelEvaluationMode ? "ON - Evaluation Dataset Only" : "OFF - All Videos"}
              </Text>
            </View>
            <Switch
              value={modelEvaluationMode}
              disabled={modelEvalLoading}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleModelEvaluationToggle(value);
              }}
              trackColor={{ false: "#2A2A50", true: "#34D39940" }}
              thumbColor={modelEvaluationMode ? "#34D399" : "#64748B"}
            />
          </View>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Validation</Text>
          <View style={styles.validationCard}>
            <Text style={styles.validationHeadline}>Upload/Pipeline Validation Mode</Text>
            <Text style={styles.validationSubtext}>
              Disabled is the persisted default, so no validation is currently performed.
            </Text>
            <View style={styles.validationOptionsList}>
              {VIDEO_VALIDATION_OPTIONS.map((option) => {
                const selected = videoValidationMode === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleVideoValidationChange(option.mode);
                    }}
                    disabled={videoValidationLoading}
                    style={({ pressed }) => [
                      styles.validationOption,
                      selected && styles.validationOptionSelected,
                      videoValidationLoading && styles.validationOptionDisabled,
                      { transform: [{ scale: pressed ? 0.99 : 1 }] },
                    ]}
                  >
                    <View style={styles.validationOptionTextWrap}>
                      <Text style={[styles.validationOptionLabel, selected && styles.validationOptionLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.validationOptionDescription}>{option.description}</Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/profile/score-metrics-selection")}
          style={({ pressed }) => [styles.actionButton, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Ionicons name="options-outline" size={20} color="#6C5CE7" />
          <Text style={styles.actionText}>Select Score/Metrics</Text>
        </Pressable>

        <Pressable
          onPress={handleRecalculateMetrics}
          disabled={recalculating}
          style={({ pressed }) => [
            styles.actionButton,
            recalculating && styles.actionButtonDisabled,
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          {recalculating ? (
            <ActivityIndicator size="small" color="#6C5CE7" />
          ) : (
            <Ionicons name="refresh" size={20} color="#6C5CE7" />
          )}
          <Text style={styles.actionText}>Recalc Score/Metrics</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/add-player")}
          style={({ pressed }) => [styles.actionButton, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Ionicons name="person-add" size={20} color="#6C5CE7" />
          <Text style={styles.actionText}>Add Player</Text>
        </Pressable>
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
  fieldWrapper: {
    gap: 6,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleInfoInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#F8FAFC",
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
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6C5CE740",
    backgroundColor: "#6C5CE720",
    marginBottom: 12,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
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
});