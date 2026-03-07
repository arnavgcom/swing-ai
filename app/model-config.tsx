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

export default function ModelConfigScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeModelVersion, setActiveModelVersion] = React.useState("");
  const [modelVersionChangeDescription, setModelVersionChangeDescription] = React.useState("");
  const [evaluationDatasetManifestPath, setEvaluationDatasetManifestPath] = React.useState("");

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
    setEvaluationDatasetManifestPath(configQuery.data.evaluationDatasetManifestPath || "");
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateModelRegistryConfig({
        activeModelVersion: activeModelVersion.trim(),
        modelVersionChangeDescription: modelVersionChangeDescription.trim(),
        evaluationDatasetManifestPath: evaluationDatasetManifestPath.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["model-registry-config"] });
      await queryClient.invalidateQueries({ queryKey: ["model-evaluation-settings"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to update model config");
    },
  });

  const validateMutation = useMutation({
    mutationFn: validateModelRegistryManifest,
    onSuccess: (result) => {
      const issues = [
        ...(result.validation.errors || []).map((line) => `Error: ${line}`),
        ...(result.validation.warnings || []).map((line) => `Warning: ${line}`),
      ];
      const status = result.validation.valid ? "Manifest is valid" : "Manifest has issues";
      Alert.alert(status, issues.length ? issues.join("\n") : "No issues found.");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to validate manifest");
    },
  });

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerWrap}>
          <Text style={styles.title}>Admin only</Text>
          <Text style={styles.subtitle}>Model Config is available only to admins.</Text>
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

            <Text style={styles.title}>Model Registry Config</Text>
            <Text style={styles.subtitle}>Control active model version and evaluation manifest settings</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Active Model Version</Text>
              <TextInput
                value={activeModelVersion}
                onChangeText={setActiveModelVersion}
                style={styles.input}
                placeholder="0.1"
                placeholderTextColor="#4A4A6A"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Version Change Description</Text>
              <TextInput
                value={modelVersionChangeDescription}
                onChangeText={setModelVersionChangeDescription}
                style={[styles.input, styles.multilineInput]}
                placeholder="What changed in this version"
                placeholderTextColor="#4A4A6A"
                multiline
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Evaluation Dataset Manifest Path</Text>
              <TextInput
                value={evaluationDatasetManifestPath}
                onChangeText={setEvaluationDatasetManifestPath}
                style={styles.input}
                placeholder="model_evaluation_datasets/manifest.json"
                placeholderTextColor="#4A4A6A"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {configQuery.data?.manifestValidation ? (
              <GlassCard style={styles.validationCard}>
                <Text style={styles.validationTitle}>
                  Manifest Validation: {configQuery.data.manifestValidation.valid ? "Valid" : "Issues Found"}
                </Text>
                <Text style={styles.validationText}>
                  Datasets: {configQuery.data.manifestValidation.datasetCount} | Videos: {configQuery.data.manifestValidation.totalVideos}
                </Text>
              </GlassCard>
            ) : null}

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
                <Ionicons name="checkmark-done-outline" size={18} color="#6C5CE7" />
              )}
              <Text style={styles.primaryButtonText}>Validate Manifest</Text>
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
              <Text style={styles.primaryButtonText}>Save Model Config</Text>
            </Pressable>
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
  primaryButton: {
    marginTop: 6,
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
});
