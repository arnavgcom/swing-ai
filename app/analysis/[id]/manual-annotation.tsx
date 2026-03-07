import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  fetchAnalysisDetail,
  fetchAnalysisDiagnostics,
  fetchAnalysisShotAnnotation,
  fetchSportConfig,
  saveAnalysisShotAnnotation,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const SPORT_MOVEMENT_OPTIONS: Record<string, string[]> = {
  tennis: ["forehand", "backhand", "serve", "volley", "game"],
  golf: ["drive", "iron", "chip", "putt", "full-swing"],
  pickleball: ["dink", "drive", "serve", "volley", "third-shot-drop"],
  paddle: ["forehand", "backhand", "serve", "smash", "bandeja"],
  badminton: ["clear", "smash", "drop", "net-shot", "serve"],
  tabletennis: ["forehand", "backhand", "serve", "loop", "chop"],
};

function toTitle(value: string): string {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function ManualAnnotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [manualShotLabels, setManualShotLabels] = useState<string[]>([]);
  const [activeShotDropdownIndex, setActiveShotDropdownIndex] = useState<number | null>(null);
  const [useForModelTraining, setUseForModelTraining] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
  });

  const { data: diagnostics } = useQuery({
    queryKey: ["analysis", id, "diagnostics"],
    queryFn: () => fetchAnalysisDiagnostics(id!),
    enabled: !!id,
  });

  const { data: shotAnnotation } = useQuery({
    queryKey: ["analysis", id, "shot-annotation"],
    queryFn: () => fetchAnalysisShotAnnotation(id!),
    enabled: !!id,
  });

  const configKey = detail?.metrics?.configKey;

  const { data: sportConfig } = useQuery({
    queryKey: ["sport-config", configKey],
    queryFn: () => fetchSportConfig(configKey!),
    enabled: !!configKey,
  });

  useEffect(() => {
    const savedLabels = (shotAnnotation?.orderedShotLabels || [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);

    if (savedLabels.length > 0) {
      setManualShotLabels(savedLabels);
    } else if (diagnostics?.shotSegments?.length) {
      setManualShotLabels(
        diagnostics.shotSegments.map((segment) => String(segment.label || "unknown").toLowerCase()),
      );
    }

    if (typeof shotAnnotation?.useForModelTraining === "boolean") {
      setUseForModelTraining(shotAnnotation.useForModelTraining);
    }
  }, [diagnostics?.shotSegments, shotAnnotation]);

  const movementTypeOptions = useMemo(() => {
    const sportKey = String(sportConfig?.sportName || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    if (SPORT_MOVEMENT_OPTIONS[sportKey]?.length) {
      return SPORT_MOVEMENT_OPTIONS[sportKey];
    }

    const values = new Set<string>();
    manualShotLabels.forEach((label) => {
      const value = String(label || "").trim().toLowerCase();
      if (value) values.add(value);
    });

    if (!values.size) {
      values.add("forehand");
      values.add("backhand");
    }

    return Array.from(values);
  }, [manualShotLabels, sportConfig?.sportName]);

  const saveMutation = useMutation({
    mutationFn: (payload: {
      totalShots: number;
      orderedShotLabels: string[];
      usedForScoringShotIndexes: number[];
      useForModelTraining?: boolean;
    }) => saveAnalysisShotAnnotation(id!, payload),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "shot-annotation"] }),
        queryClient.invalidateQueries({ queryKey: ["discrepancy-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["scoring-model-dashboard"] }),
      ]);
      queryClient.setQueryData(["analysis", id, "shot-annotation"], saved);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Save failed", error.message || "Could not save manual annotation.");
    },
  });

  const handleSave = () => {
    const orderedShotLabels = manualShotLabels
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);

    const totalShots = orderedShotLabels.length;
    if (totalShots === 0) {
      Alert.alert("Invalid input", "Add at least one shot label before saving.");
      return;
    }

    saveMutation.mutate({
      totalShots,
      orderedShotLabels,
      usedForScoringShotIndexes: Array.from({ length: totalShots }, (_value, index) => index + 1),
      useForModelTraining: isAdmin ? useForModelTraining : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.title}>Manual Annotation</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => setManualShotLabels((prev) => [...prev, movementTypeOptions[0] || "forehand"])}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="add" size={14} color="#6C5CE7" />
            <Text style={styles.actionText}>Add Shot</Text>
          </Pressable>
          <Pressable
            onPress={() => setManualShotLabels((prev) => prev.slice(0, -1))}
            disabled={manualShotLabels.length === 0}
            style={({ pressed }) => [
              styles.actionButton,
              manualShotLabels.length === 0 && styles.actionButtonDisabled,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="remove" size={14} color={manualShotLabels.length === 0 ? "#64748B" : "#FCA5A5"} />
            <Text style={[styles.actionText, manualShotLabels.length === 0 && styles.actionTextDisabled]}>Remove Shot</Text>
          </Pressable>
        </View>

        {manualShotLabels.map((shotLabel, index) => {
          const dropdownOpen = activeShotDropdownIndex === index;
          return (
            <View key={`manual-shot-${index}`} style={[styles.rowCard, dropdownOpen && { zIndex: 10 }]}> 
              <Text style={styles.indexText}>{index + 1}.</Text>
              <View style={styles.dropdownWrap}>
                <Pressable
                  onPress={() => setActiveShotDropdownIndex((prev) => (prev === index ? null : index))}
                  style={({ pressed }) => [styles.dropdownTrigger, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.dropdownText}>{toTitle(shotLabel)}</Text>
                  <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
                </Pressable>
                {dropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    {movementTypeOptions.map((option) => {
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
                            styles.dropdownOption,
                            selected && styles.dropdownOptionSelected,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                        >
                          <Text style={styles.dropdownOptionText}>{toTitle(option)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {isAdmin ? (
          <Pressable
            onPress={() => setUseForModelTraining((prev) => !prev)}
            style={({ pressed }) => [styles.trainingToggleRow, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={[styles.trainingCheckbox, useForModelTraining && styles.trainingCheckboxChecked]}>
              {useForModelTraining ? <Ionicons name="checkmark" size={13} color="#6C5CE7" /> : null}
            </View>
            <Text style={styles.trainingToggleText}>Use for Model Training/Tuning</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveButton, { opacity: pressed ? 0.85 : 1 }]}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Save Annotation</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  header: {
    marginTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonDisabled: { backgroundColor: "#0F172A" },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#CBD5E1" },
  actionTextDisabled: { color: "#64748B" },
  rowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#131328",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  indexText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#A78BFA", marginTop: 9 },
  dropdownWrap: { flex: 1 },
  dropdownTrigger: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A80",
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#CBD5E1" },
  dropdownMenu: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    padding: 6,
    gap: 5,
  },
  dropdownOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  dropdownOptionSelected: {
    borderColor: "#6C5CE7",
    backgroundColor: "#6C5CE720",
  },
  dropdownOptionText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#CBD5E1" },
  trainingToggleRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    borderRadius: 10,
    backgroundColor: "#0A0A1A80",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  trainingCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  trainingCheckboxChecked: {
    borderColor: "#6C5CE7",
    backgroundColor: "#6C5CE724",
  },
  trainingToggleText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#CBD5E1" },
  saveButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6C5CE7",
    backgroundColor: "#6C5CE7",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
});
