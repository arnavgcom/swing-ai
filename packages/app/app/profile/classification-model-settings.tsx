import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDriveMovementClassificationModelSettings,
  type DriveMovementClassificationModelOptionResponse,
  updateDriveMovementClassificationModelSettings,
} from "@/lib/api";

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

export default function DriveMovementClassificationModelSettingsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { user } = useAuth();
  const canUseAdminApis = normalizeRole(user?.role) === "admin";
  const [modelOptions, setModelOptions] = useState<DriveMovementClassificationModelOptionResponse[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState<string>("tennis-active");
  const [loading, setLoading] = useState(false);
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const selectedModel = useMemo(() => {
    return modelOptions.find((option) => option.key === selectedModelKey) || modelOptions[0] || null;
  }, [modelOptions, selectedModelKey]);

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
        const settings = await fetchDriveMovementClassificationModelSettings();
        if (!active) return;
        setModelOptions(settings.options || []);
        setSelectedModelKey(settings.selectedModelKey || "tennis-active");
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  const handleModelChange = async (nextModelKey: string) => {
    if (!canUseAdminApis || loading || nextModelKey === selectedModelKey) return;

    const previousModelKey = selectedModelKey;
    setLoading(true);
    setSelectedModelKey(nextModelKey);
    try {
      await updateDriveMovementClassificationModelSettings(nextModelKey);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSelectedModelKey(previousModelKey);
      Alert.alert("Error", "Failed to update drive movement classification model");
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headerTitle}>Drive Movement Classification Model</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Drive Movement Classification Model</Text>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>Drive Movement Runtime Model Selection</Text>
            <Text style={styles.cardSubtext}>
              This selection is saved in app settings and used for future drive movement classification runs.
            </Text>
            {selectedModel ? (
              <View style={styles.summaryPill}>
                <Text style={styles.summaryPillText}>
                  {selectedModel.modelVersion ? `Selected: v${selectedModel.modelVersion}` : `Selected: ${selectedModel.label}`}
                </Text>
              </View>
            ) : null}
            <View style={styles.optionsList}>
              {modelOptions.map((option) => {
                const selected = selectedModelKey === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      void handleModelChange(option.key);
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
                      <View style={styles.optionTitleRow}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                        {option.badge ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{option.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                      {option.modelVersion ? (
                        <Text style={styles.optionMeta}>Version: v{option.modelVersion}</Text>
                      ) : null}
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
  summaryPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
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
  optionDisabled: {
    opacity: 0.7,
  },
  optionTextWrap: {
    flex: 1,
    gap: 3,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  optionMeta: {
    fontSize: 11,
    fontWeight: "500",
    color: "#AEAEB2",
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#312E81",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#E9D5FF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});