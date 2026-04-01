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
import { fetchR2Settings, updateR2Settings, fetchVideoStorageSettings, updateVideoStorageSettings, type R2Settings } from "@/services/api";

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

type StorageMode = "filesystem" | "r2";

const MODEL_STORAGE_OPTIONS: Array<{ mode: StorageMode; label: string; description: string }> = [
  { mode: "filesystem", label: "Filesystem", description: "Store model artifacts on local disk" },
  { mode: "r2", label: "R2 (Cloudflare)", description: "Store model artifacts in Cloudflare R2" },
];

export default function StorageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { user } = useAuth();
  const canUseAdminApis = normalizeRole(user?.role) === "admin";
  const [settings, setSettings] = useState<R2Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [videoStorageMode, setVideoStorageMode] = useState<"filesystem" | "r2">("filesystem");
  const [videoStorageLoading, setVideoStorageLoading] = useState(false);
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
        const [s, vs] = await Promise.all([fetchR2Settings(), fetchVideoStorageSettings()]);
        if (active) {
          setSettings(s);
          setVideoStorageMode(vs.mode);
        }
      } catch {
        if (active) Alert.alert("Error", "Failed to load storage settings");
      }
    })();
    return () => { active = false; };
  }, [canUseAdminApis]);

  const update = (patch: Partial<R2Settings>) => {
    if (!settings || saving) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    updateR2Settings(next)
      .then(() => { setSaving(false); })
      .catch(() => {
        setSettings(settings);
        setSaving(false);
        Alert.alert("Error", "Failed to save storage settings");
      });
  };

  const handleVideoStorageToggle = async (enabled: boolean) => {
    setVideoStorageLoading(true);
    const nextMode = enabled ? "r2" : "filesystem";
    try {
      await updateVideoStorageSettings(nextMode);
      setVideoStorageMode(nextMode);
    } catch {
      Alert.alert("Error", "Failed to update video storage mode");
    } finally {
      setVideoStorageLoading(false);
    }
  };

  if (!settings) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Storage</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: "#8E8E93" }}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Storage</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Video Storage Mode ─────────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Video Storage Mode</Text>
          <View style={styles.card}>
            <Text style={styles.cardSubtext}>
              Choose where uploaded videos are stored.
            </Text>
            <View style={styles.videoStorageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>
                  {videoStorageMode === "r2" ? "Cloudflare R2" : "Local Filesystem"}
                </Text>
                <Text style={styles.optionDescription}>
                  {videoStorageMode === "r2"
                    ? "Videos stored in Cloudflare R2"
                    : "Videos stored on the local filesystem"}
                </Text>
              </View>
              <Switch
                value={videoStorageMode === "r2"}
                disabled={videoStorageLoading}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleVideoStorageToggle(v);
                }}
                trackColor={{ false: "#39393D", true: "rgba(48,209,88,0.5)" }}
                thumbColor={videoStorageMode === "r2" ? "#30D158" : "#F4F3F4"}
              />
            </View>
          </View>
        </View>

        {/* ── R2 Connection ──────────────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Cloudflare R2 Connection</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>R2 Credentials</Text>
            <Text style={styles.cardSubtext}>
              Connection details for Cloudflare R2 object storage.
            </Text>
            <View style={styles.optionsList}>
              <SettingInput
                label="Endpoint"
                value={settings.r2Endpoint}
                onChange={(v) => update({ r2Endpoint: v })}
                placeholder="https://…r2.cloudflarestorage.com"
                disabled={saving}
              />
              <SettingInput
                label="Region"
                value={settings.r2Region}
                onChange={(v) => update({ r2Region: v })}
                placeholder="auto"
                disabled={saving}
              />
              <SettingInput
                label="Bucket"
                value={settings.r2Bucket}
                onChange={(v) => update({ r2Bucket: v })}
                placeholder="swingai"
                disabled={saving}
              />
              <SettingInput
                label="Access Key ID"
                value={settings.r2AccessKeyId}
                onChange={(v) => update({ r2AccessKeyId: v })}
                placeholder="••••••••"
                disabled={saving}
                secure
              />
              <SettingInput
                label="Secret Access Key"
                value={settings.r2SecretAccessKey}
                onChange={(v) => update({ r2SecretAccessKey: v })}
                placeholder="••••••••"
                disabled={saving}
                secure
              />
            </View>
          </View>
        </View>

        {/* ── Folder Prefixes ────────────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>R2 Folder Prefixes</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Object Key Prefixes</Text>
            <Text style={styles.cardSubtext}>
              Folder paths within the R2 bucket for each media type.
            </Text>
            <View style={styles.optionsList}>
              <SettingInput
                label="Video Folder"
                value={settings.r2PlayerVideoFolder}
                onChange={(v) => update({ r2PlayerVideoFolder: v })}
                placeholder="video"
                disabled={saving}
              />
              <SettingInput
                label="Avatar Folder"
                value={settings.r2PlayerAvatarFolder}
                onChange={(v) => update({ r2PlayerAvatarFolder: v })}
                placeholder="avatar"
                disabled={saving}
              />
              <SettingInput
                label="Model Folder"
                value={settings.r2PlayerModelFolder}
                onChange={(v) => update({ r2PlayerModelFolder: v })}
                placeholder="model"
                disabled={saving}
              />
            </View>
          </View>
        </View>

        {/* ── Model Artifact Storage ─────────────── */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Model Artifact Storage</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Storage Mode</Text>
            <Text style={styles.cardSubtext}>
              Where classifier and pose model artifacts are stored and downloaded from.
            </Text>
            <View style={styles.optionsList}>
              {MODEL_STORAGE_OPTIONS.map((opt) => {
                const selected = settings.modelArtifactStorageMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      update({ modelArtifactStorageMode: opt.mode });
                    }}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      saving && styles.optionDisabledStyle,
                      { transform: [{ scale: pressed ? 0.99 : 1 }] },
                    ]}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
                      <Text style={styles.optionDescription}>{opt.description}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color="#30D158" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── SettingInput ─────────────────────────────────────────── */

function SettingInput({
  label, value, onChange, placeholder, disabled, secure,
}: {
  label: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; secure?: boolean;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const isMasked = secure && !focused && value.includes("••••");

  useEffect(() => { if (!focused) setText(value); }, [value]);

  const handleBlur = () => {
    setFocused(false);
    if (text !== value) {
      onChange(text);
    }
  };

  return (
    <View style={styles.inputOption}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.inputField}
        value={isMasked ? "" : text}
        onChangeText={setText}
        placeholder={isMasked ? value : placeholder}
        placeholderTextColor="#636366"
        editable={!disabled}
        secureTextEntry={false}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
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
  headerSpacer: { width: 40, height: 40 },
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
  optionSelected: {
    borderColor: "rgba(48,209,88,0.4)",
    backgroundColor: "rgba(48,209,88,0.12)",
  },
  optionDisabledStyle: {
    opacity: 0.7,
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
  optionLabelSelected: {
    color: "#FFFFFF",
  },
  optionDescription: {
    fontSize: 12,
    color: "#8E8E93",
  },
  videoStorageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputOption: {
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  inputField: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    paddingVertical: 2,
  },

});
