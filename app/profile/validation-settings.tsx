import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
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
  fetchVideoValidationSettings,
  type VideoValidationMode,
  updateVideoValidationSettings,
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

export default function ValidationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canUseAdminApis = normalizeRole(user?.role) === "admin";
  const [videoValidationMode, setVideoValidationMode] = useState<VideoValidationMode>("disabled");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canUseAdminApis) {
      router.replace("/profile");
      return;
    }

    let active = true;
    (async () => {
      try {
        const settings = await fetchVideoValidationSettings();
        if (!active) return;
        setVideoValidationMode(settings.mode);
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  const handleVideoValidationChange = async (mode: VideoValidationMode) => {
    if (!canUseAdminApis || loading || mode === videoValidationMode) return;
    setLoading(true);
    try {
      await updateVideoValidationSettings(mode);
      setVideoValidationMode(mode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update validation mode");
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
        <Text style={styles.headerTitle}>Validation</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}> 
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Upload/Pipeline Validation Mode</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Validation</Text>
            <Text style={styles.cardSubtext}>
              Disabled is the persisted default, so no validation is currently performed.
            </Text>
            <View style={styles.optionsList}>
              {VIDEO_VALIDATION_OPTIONS.map((option) => {
                const selected = videoValidationMode === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleVideoValidationChange(option.mode);
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
});
