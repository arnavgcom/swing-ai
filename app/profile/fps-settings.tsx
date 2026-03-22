import React, { useEffect, useState } from "react";
import {
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
import {
  fetchAnalysisFpsSettings,
  type AnalysisFpsStep,
  updateAnalysisFpsSettings,
} from "@/lib/api";

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

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

export default function FpsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canUseAdminApis = normalizeRole(user?.role) === "admin";
  const [lowImpactFpsStep, setLowImpactFpsStep] = useState<AnalysisFpsStep>("step2");
  const [highImpactFpsStep, setHighImpactFpsStep] = useState<AnalysisFpsStep>("step1");
  const [tennisAutoDetectUsesHighImpact, setTennisAutoDetectUsesHighImpact] = useState(false);
  const [tennisMatchPlayUsesHighImpact, setTennisMatchPlayUsesHighImpact] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canUseAdminApis) {
      router.replace("/profile");
      return;
    }

    let active = true;
    (async () => {
      try {
        const settings = await fetchAnalysisFpsSettings();
        if (!active) return;
        setLowImpactFpsStep(settings.lowImpactStep);
        setHighImpactFpsStep(settings.highImpactStep);
        setTennisAutoDetectUsesHighImpact(Boolean(settings.tennisAutoDetectUsesHighImpact));
        setTennisMatchPlayUsesHighImpact(Boolean(settings.tennisMatchPlayUsesHighImpact));
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  const handleAnalysisFpsChange = async (
    nextLowImpactStep: AnalysisFpsStep,
    nextHighImpactStep: AnalysisFpsStep,
    nextTennisAutoDetectUsesHighImpact = tennisAutoDetectUsesHighImpact,
    nextTennisMatchPlayUsesHighImpact = tennisMatchPlayUsesHighImpact,
  ) => {
    if (!canUseAdminApis || loading) return;
    if (
      nextLowImpactStep === lowImpactFpsStep
      && nextHighImpactStep === highImpactFpsStep
      && nextTennisAutoDetectUsesHighImpact === tennisAutoDetectUsesHighImpact
      && nextTennisMatchPlayUsesHighImpact === tennisMatchPlayUsesHighImpact
    ) return;
    const previousState = {
      lowImpactFpsStep,
      highImpactFpsStep,
      tennisAutoDetectUsesHighImpact,
      tennisMatchPlayUsesHighImpact,
    };
    setLowImpactFpsStep(nextLowImpactStep);
    setHighImpactFpsStep(nextHighImpactStep);
    setTennisAutoDetectUsesHighImpact(nextTennisAutoDetectUsesHighImpact);
    setTennisMatchPlayUsesHighImpact(nextTennisMatchPlayUsesHighImpact);
    setLoading(true);
    try {
      await updateAnalysisFpsSettings(
        nextLowImpactStep,
        nextHighImpactStep,
        nextTennisAutoDetectUsesHighImpact,
        nextTennisMatchPlayUsesHighImpact,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setLowImpactFpsStep(previousState.lowImpactFpsStep);
      setHighImpactFpsStep(previousState.highImpactFpsStep);
      setTennisAutoDetectUsesHighImpact(previousState.tennisAutoDetectUsesHighImpact);
      setTennisMatchPlayUsesHighImpact(previousState.tennisMatchPlayUsesHighImpact);
      Alert.alert("Error", "Failed to update analysis FPS settings");
    } finally {
      setLoading(false);
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
        <Text style={styles.headerTitle}>FPS</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}> 
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Low Impact Diagnostics</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Default For Most Videos</Text>
            <Text style={styles.cardSubtext}>
              This profile is used for non-serve videos unless a tennis override routes the analysis to High Impact.
            </Text>
            <View style={styles.optionsList}>
              {LOW_IMPACT_FPS_OPTIONS.map((option) => {
                const selected = lowImpactFpsStep === option.step;
                return (
                  <Pressable
                    key={`low-${option.step}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleAnalysisFpsChange(option.step, highImpactFpsStep);
                    }}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      loading && styles.optionDisabled,
                      { transform: [{ scale: pressed ? 0.99 : 1 }] },
                    ]}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color="#34D399" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>High Impact Diagnostics</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Serve-Selected Videos</Text>
            <Text style={styles.cardSubtext}>
              This profile is used for Serve, and for tennis Auto-Detect or Match Play when their toggles are enabled.
            </Text>
            <View style={styles.optionsList}>
              {HIGH_IMPACT_FPS_OPTIONS.map((option) => {
                const selected = highImpactFpsStep === option.step;
                return (
                  <Pressable
                    key={`high-${option.step}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleAnalysisFpsChange(lowImpactFpsStep, option.step);
                    }}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      loading && styles.optionDisabled,
                      { transform: [{ scale: pressed ? 0.99 : 1 }] },
                    ]}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color="#34D399" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Tennis Overrides</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>High Impact Toggle Rules</Text>
            <Text style={styles.cardSubtext}>
              These toggles route qualifying tennis videos to the high impact FPS profile for analysis.
            </Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Auto-Detect uses High Impact</Text>
                <Text style={styles.toggleDescription}>Use High Impact FPS when tennis movement selection is Auto-Detect.</Text>
              </View>
              <Switch
                value={tennisAutoDetectUsesHighImpact}
                disabled={loading}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleAnalysisFpsChange(lowImpactFpsStep, highImpactFpsStep, value, tennisMatchPlayUsesHighImpact);
                }}
                trackColor={{ false: "#2A2A50", true: "#38BDF840" }}
                thumbColor={tennisAutoDetectUsesHighImpact ? "#38BDF8" : "#64748B"}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Match Play uses High Impact</Text>
                <Text style={styles.toggleDescription}>Use High Impact FPS when tennis session type is Match Play.</Text>
              </View>
              <Switch
                value={tennisMatchPlayUsesHighImpact}
                disabled={loading}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleAnalysisFpsChange(lowImpactFpsStep, highImpactFpsStep, tennisAutoDetectUsesHighImpact, value);
                }}
                trackColor={{ false: "#2A2A50", true: "#38BDF840" }}
                thumbColor={tennisMatchPlayUsesHighImpact ? "#38BDF8" : "#64748B"}
              />
            </View>
          </View>
        </View>
      </ScrollView>
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
  card: {
    gap: 10,
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardHeadline: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  cardSubtext: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  optionsList: {
    gap: 8,
  },
  option: {
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
  optionSelected: {
    borderColor: "#34D39966",
    backgroundColor: "#0A1F1A",
  },
  optionDisabled: {
    opacity: 0.7,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  optionLabelSelected: {
    color: "#DCFCE7",
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 3,
  },
  toggleTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  toggleDescription: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
});
