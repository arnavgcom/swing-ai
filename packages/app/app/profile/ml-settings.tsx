import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/auth-context";
import { fetchMlSettings, updateMlSettings, type MlSettings } from "@/services/api";

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

export default function MlSettingsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { user } = useAuth();
  const canUseAdminApis = normalizeRole(user?.role) === "admin";
  const [settings, setSettings] = useState<MlSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

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

  useEffect(() => {
    if (!canUseAdminApis) {
      router.replace("/profile");
      return;
    }
    let active = true;
    (async () => {
      try {
        const s = await fetchMlSettings();
        if (active) setSettings(s);
      } catch {
        if (active) Alert.alert("Error", "Failed to load ML settings");
      }
    })();
    return () => { active = false; };
  }, [canUseAdminApis]);

  const update = (patch: Partial<MlSettings>) => {
    if (!settings || saving) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    updateMlSettings(next)
      .then(() => { setSaving(false); })
      .catch(() => {
        setSettings(settings);
        setSaving(false);
        Alert.alert("Error", "Failed to save ML settings");
      });
  };

  if (!settings) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>ML Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: "#8E8E93" }}>Loading…</Text>
        </View>
      </View>
    );
  }

  const rfWeight = Math.round((1 - settings.lstmEnsembleWeight) * 100);
  const lstmWeight = Math.round(settings.lstmEnsembleWeight * 100);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>ML Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Inference ──────────────────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Inference</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Ensemble Model</Text>
            <Text style={styles.cardSubtext}>
              Controls how the LSTM and Random Forest models combine predictions.
            </Text>
            <View style={styles.optionsList}>
              <View style={styles.option}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>LSTM Enabled</Text>
                  <Text style={styles.optionDescription}>Use LSTM alongside Random Forest for ensemble inference</Text>
                </View>
                <Switch
                  value={settings.lstmEnabled}
                  onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ lstmEnabled: v }); }}
                  disabled={saving}
                  trackColor={{ false: "#39393D", true: "rgba(48,209,88,0.5)" }}
                  thumbColor={settings.lstmEnabled ? "#30D158" : "#F4F3F4"}
                />
              </View>

              <View style={[styles.option, !settings.lstmEnabled && styles.optionDisabled]}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>Ensemble Weight</Text>
                  <Text style={styles.optionDescription}>LSTM: {lstmWeight}%  ·  RF: {rfWeight}%</Text>
                </View>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ lstmEnsembleWeight: Math.max(0, +(settings.lstmEnsembleWeight - 0.05).toFixed(2)) }); }}
                    disabled={saving || !settings.lstmEnabled || settings.lstmEnsembleWeight <= 0}
                    style={[styles.stepperBtn, (saving || !settings.lstmEnabled || settings.lstmEnsembleWeight <= 0) && { opacity: 0.3 }]}
                  >
                    <Ionicons name="remove" size={14} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.stepperValue}>{lstmWeight}%</Text>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ lstmEnsembleWeight: Math.min(1, +(settings.lstmEnsembleWeight + 0.05).toFixed(2)) }); }}
                    disabled={saving || !settings.lstmEnabled || settings.lstmEnsembleWeight >= 1}
                    style={[styles.stepperBtn, (saving || !settings.lstmEnabled || settings.lstmEnsembleWeight >= 1) && { opacity: 0.3 }]}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Thresholds ─────────────────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Classification Thresholds</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Confidence & Margin</Text>
            <Text style={styles.cardSubtext}>
              Controls when model predictions are accepted vs. falling back to heuristics.
            </Text>
            <View style={styles.optionsList}>
              <View style={styles.option}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>Confidence Threshold</Text>
                  <Text style={styles.optionDescription}>Min confidence to accept prediction</Text>
                </View>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ modelConfidenceThreshold: Math.max(0.1, +(settings.modelConfidenceThreshold - 0.02).toFixed(2)) }); }}
                    disabled={saving || settings.modelConfidenceThreshold <= 0.1}
                    style={[styles.stepperBtn, (saving || settings.modelConfidenceThreshold <= 0.1) && { opacity: 0.3 }]}
                  >
                    <Ionicons name="remove" size={14} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.stepperValue}>{settings.modelConfidenceThreshold.toFixed(2)}</Text>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ modelConfidenceThreshold: Math.min(1, +(settings.modelConfidenceThreshold + 0.02).toFixed(2)) }); }}
                    disabled={saving || settings.modelConfidenceThreshold >= 1}
                    style={[styles.stepperBtn, (saving || settings.modelConfidenceThreshold >= 1) && { opacity: 0.3 }]}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.option}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>Margin Threshold</Text>
                  <Text style={styles.optionDescription}>Min gap between top-1 and top-2 probabilities</Text>
                </View>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ modelMarginThreshold: Math.max(0, +(settings.modelMarginThreshold - 0.01).toFixed(2)) }); }}
                    disabled={saving || settings.modelMarginThreshold <= 0}
                    style={[styles.stepperBtn, (saving || settings.modelMarginThreshold <= 0) && { opacity: 0.3 }]}
                  >
                    <Ionicons name="remove" size={14} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.stepperValue}>{settings.modelMarginThreshold.toFixed(2)}</Text>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ modelMarginThreshold: Math.min(0.5, +(settings.modelMarginThreshold + 0.01).toFixed(2)) }); }}
                    disabled={saving || settings.modelMarginThreshold >= 0.5}
                    style={[styles.stepperBtn, (saving || settings.modelMarginThreshold >= 0.5) && { opacity: 0.3 }]}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Training ───────────────────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>LSTM Training</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Training Configuration</Text>
            <Text style={styles.cardSubtext}>
              Parameters used when the LSTM model is retrained alongside Random Forest.
            </Text>
            <View style={styles.optionsList}>
              <View style={styles.option}>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>LSTM Training Enabled</Text>
                  <Text style={styles.optionDescription}>Train LSTM alongside RF during training jobs</Text>
                </View>
                <Switch
                  value={settings.lstmTrainingEnabled}
                  onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update({ lstmTrainingEnabled: v }); }}
                  disabled={saving}
                  trackColor={{ false: "#39393D", true: "rgba(48,209,88,0.5)" }}
                  thumbColor={settings.lstmTrainingEnabled ? "#30D158" : "#F4F3F4"}
                />
              </View>

              <NumberOption
                label="Min Training Rows"
                description="Min samples with temporal data to start training"
                value={settings.lstmMinTrainingRows}
                onChange={(v) => update({ lstmMinTrainingRows: v })}
                min={5} max={10000}
                disabled={saving || !settings.lstmTrainingEnabled}
              />
              <NumberOption
                label="Epochs"
                description="Max training epochs (early stopping may finish sooner)"
                value={settings.lstmTrainingEpochs}
                onChange={(v) => update({ lstmTrainingEpochs: v })}
                min={5} max={500}
                disabled={saving || !settings.lstmTrainingEnabled}
              />
              <NumberOption
                label="Batch Size"
                description="Samples per training batch"
                value={settings.lstmTrainingBatchSize}
                onChange={(v) => update({ lstmTrainingBatchSize: v })}
                min={4} max={256}
                disabled={saving || !settings.lstmTrainingEnabled}
              />
              <NumberOption
                label="Learning Rate"
                description="AdamW optimiser learning rate"
                value={settings.lstmLearningRate}
                onChange={(v) => update({ lstmLearningRate: v })}
                min={0.00001} max={0.1} isDecimal
                disabled={saving || !settings.lstmTrainingEnabled}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── NumberOption ─────────────────────────────────────────── */

function NumberOption({
  label, description, value, onChange, min, max, disabled, isDecimal,
}: {
  label: string; description: string; value: number;
  onChange: (v: number) => void; min: number; max: number;
  disabled?: boolean; isDecimal?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) { setText(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, isDecimal ? n : Math.round(n)));
    onChange(clamped);
    setText(String(clamped));
  };

  return (
    <View style={[styles.option, disabled && styles.optionDisabled]}>
      <View style={styles.optionTextWrap}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <TextInput
        style={styles.numberInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType={isDecimal ? "decimal-pad" : "number-pad"}
        editable={!disabled}
        placeholderTextColor="#636366"
      />
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2C2C2E",
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
  fieldWrapper: {
    gap: 6,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    gap: 10,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardHeadline: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cardSubtext: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E8E93",
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
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  optionDescription: {
    fontSize: 12,
    color: "#8E8E93",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#3A3A3C",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A84FF",
    minWidth: 40,
    textAlign: "center",
  },
  numberInput: {
    width: 80,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#0A84FF",
    textAlign: "center",
  },

});
