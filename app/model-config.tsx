import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  fetchModelRegistryConfig,
  updateModelRegistryConfig,
  validateModelRegistryManifest,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ds } from "@/constants/design-system";
import { GlassCard } from "@/components/ui/GlassCard";

function formatStatusLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMovementList(values: string[]): string {
  if (!values.length) return "No movement labels yet";
  return values.map((value) => formatStatusLabel(value)).join(" • ");
}

export default function ModelConfigScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeModelVersion, setActiveModelVersion] = React.useState("");
  const [modelVersionChangeDescription, setModelVersionChangeDescription] = React.useState("");

  const configQuery = useQuery({
    queryKey: ["model-registry-config"],
    queryFn: fetchModelRegistryConfig,
    enabled: isAdmin,
    retry: false,
  });

  React.useEffect(() => {
    if (!configQuery.data) return;
    setActiveModelVersion(configQuery.data.activeModelVersion || "");
    setModelVersionChangeDescription(configQuery.data.modelVersionChangeDescription || "");
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateModelRegistryConfig({
        activeModelVersion: activeModelVersion.trim(),
        modelVersionChangeDescription: modelVersionChangeDescription.trim(),
        evaluationDatasetManifestPath:
          configQuery.data?.evaluationDatasetManifestPath || "database://model-registry",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["model-registry-config"] }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to update model registry");
    },
  });

  const validateMutation = useMutation({
    mutationFn: validateModelRegistryManifest,
    onSuccess: (result) => {
      const issues = [
        ...(result.validation.errors || []).map((line) => `Error: ${line}`),
        ...(result.validation.warnings || []).map((line) => `Warning: ${line}`),
      ];
      const status = result.validation.valid ? "Registry data looks healthy" : "Registry data needs attention";
      Alert.alert(status, issues.length ? issues.join("\n") : "No issues found.");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to validate registry data");
    },
  });

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerWrap}>
          <Text style={styles.title}>Admin only</Text>
          <Text style={styles.subtitle}>Model Registry is available only to admins.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      {configQuery.isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#34D399" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topNavRow}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.75 : 1 }]}
              >
                <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
              </Pressable>
            </View>

            <Text style={styles.title}>Model Registry</Text>
            <Text style={styles.subtitle}>Database-backed versions, datasets, and activation state</Text>

            <View style={styles.statGrid}>
              <GlassCard style={styles.statCard}>
                <Text style={styles.statLabel}>Storage</Text>
                <Text style={styles.statValue}>{configQuery.data?.storage === "database" ? "Database" : "Unknown"}</Text>
              </GlassCard>
              <GlassCard style={styles.statCard}>
                <Text style={styles.statLabel}>Datasets</Text>
                <Text style={styles.statValue}>{configQuery.data?.datasets.length || 0}</Text>
              </GlassCard>
              <GlassCard style={styles.statCard}>
                <Text style={styles.statLabel}>Videos</Text>
                <Text style={styles.statValue}>{configQuery.data?.manifestValidation.totalVideos || 0}</Text>
              </GlassCard>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Active Model Version</Text>
              <TextInput
                value={activeModelVersion}
                onChangeText={setActiveModelVersion}
                style={styles.input}
                placeholder="0.1"
                placeholderTextColor="#4A4A6A"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Version Description</Text>
              <TextInput
                value={modelVersionChangeDescription}
                onChangeText={setModelVersionChangeDescription}
                style={[styles.input, styles.multilineInput]}
                placeholder="Describe the active model version"
                placeholderTextColor="#4A4A6A"
                multiline
              />
            </View>

            <GlassCard style={styles.validationCard}>
              <Text style={styles.validationTitle}>
                Registry Validation: {configQuery.data?.manifestValidation.valid ? "Healthy" : "Issues Found"}
              </Text>
              <Text style={styles.validationText}>
                Datasets: {configQuery.data?.manifestValidation.datasetCount || 0} | Videos: {configQuery.data?.manifestValidation.totalVideos || 0}
              </Text>
              {(configQuery.data?.manifestValidation.warnings || []).slice(0, 2).map((warning) => (
                <Text key={warning} style={styles.validationHint}>{warning}</Text>
              ))}
            </GlassCard>

            <Pressable
              onPress={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed || validateMutation.isPending ? 0.75 : 1 },
              ]}
            >
              {validateMutation.isPending ? (
                <ActivityIndicator size="small" color="#6C5CE7" />
              ) : (
                <Ionicons name="shield-checkmark-outline" size={18} color="#6C5CE7" />
              )}
              <Text style={styles.primaryButtonText}>Validate Registry Data</Text>
            </Pressable>

            <Pressable
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed || saveMutation.isPending ? 0.75 : 1 },
              ]}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color="#6C5CE7" />
              ) : (
                <Ionicons name="save-outline" size={18} color="#6C5CE7" />
              )}
              <Text style={styles.primaryButtonText}>Save Active Version</Text>
            </Pressable>

            <GlassCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Model Versions</Text>
              {(configQuery.data?.versions || []).map((version) => {
                const selected = version.modelVersion === activeModelVersion;
                const statusTone = version.status === "active" ? styles.badgeActive : version.status === "draft" ? styles.badgeDraft : styles.badgeArchived;
                return (
                  <Pressable
                    key={version.id}
                    onPress={() => {
                      setActiveModelVersion(version.modelVersion);
                      setModelVersionChangeDescription(version.description || "");
                    }}
                    style={({ pressed }) => [
                      styles.versionRow,
                      selected && styles.versionRowSelected,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                  >
                    <View style={styles.versionRowLeft}>
                      <Text style={styles.versionText}>v{version.modelVersion}</Text>
                      <Text style={styles.versionDescription} numberOfLines={2}>{version.description || "No description"}</Text>
                    </View>
                    <View style={[styles.statusBadge, statusTone]}>
                      <Text style={styles.statusBadgeText}>{formatStatusLabel(version.status)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </GlassCard>

            <GlassCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Datasets</Text>
              {(configQuery.data?.datasets || []).map((dataset) => (
                <View key={dataset.id} style={styles.datasetRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.datasetName}>{dataset.name}</Text>
                    <Text style={styles.datasetMeta}>{dataset.videoCount} videos • {formatMovementList(dataset.movementTypes)}</Text>
                    <Text style={styles.datasetMetaSecondary}>{dataset.description || "No description"}</Text>
                  </View>
                  <View style={styles.datasetCountPill}>
                    <Text style={styles.datasetCountText}>{dataset.videoCount}</Text>
                  </View>
                </View>
              ))}
              {(configQuery.data?.datasets || []).length === 0 ? (
                <Text style={styles.emptyText}>No datasets are registered yet. Save manual annotations on completed analyses to populate this list.</Text>
              ) : null}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  scroll: {
    paddingHorizontal: ds.space.xl,
    gap: 14,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.glass,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: 6,
  },
  statGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: ds.radius.md,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: ds.color.bgElevated,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: ds.color.textPrimary,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  validationCard: {
    borderRadius: ds.radius.md,
    padding: 12,
    gap: 4,
  },
  validationTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  validationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  validationHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  primaryButton: {
    marginTop: 2,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: `${ds.color.accent}66`,
    backgroundColor: `${ds.color.accent}1F`,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.accent,
  },
  sectionCard: {
    borderRadius: ds.radius.md,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  versionRowSelected: {
    borderColor: `${ds.color.success}77`,
    backgroundColor: "#0E2F22",
  },
  versionRowLeft: {
    flex: 1,
    gap: 4,
  },
  versionText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  versionDescription: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: "#052E1A",
    borderColor: "#166534",
  },
  badgeDraft: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  badgeArchived: {
    backgroundColor: "#31111D",
    borderColor: "#4C1D2A",
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  datasetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ds.color.glassBorder,
    paddingTop: 10,
  },
  datasetName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  datasetMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  datasetMetaSecondary: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  datasetCountPill: {
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#0E2F22",
    borderWidth: 1,
    borderColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  datasetCountText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    textAlign: "center",
  },
});
