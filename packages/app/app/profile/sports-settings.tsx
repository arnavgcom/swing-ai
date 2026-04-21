import React, { useEffect, useState } from "react";
import {
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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/contexts/auth-context";
import { fetchSportsSettings, updateSportEnabled, type SportAvailabilityResponse } from "@/services/api";

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

export default function SportsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { user } = useAuth();
  const canUseAdminApis = normalizeRole(user?.role) === "admin";
  const [sports, setSports] = useState<SportAvailabilityResponse[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
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
        const response = await fetchSportsSettings();
        if (!active) return;
        setSports(response.sports);
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  const handleToggle = async (sport: SportAvailabilityResponse, enabled: boolean) => {
    if (!canUseAdminApis || loadingId) return;
    const previousSports = sports;
    setLoadingId(sport.id);
    setSports((current) => current.map((item) => (
      item.id === sport.id ? { ...item, enabled, isActive: enabled } : item
    )));

    try {
      await updateSportEnabled(sport.id, enabled);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setSports(previousSports);
      const message = error instanceof Error ? error.message : "Failed to update sport";
      Alert.alert("Error", message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}> 
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Sports</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}> 
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sport Availability</Text>
          <Text style={styles.sectionHint}>Enable or disable sports shown as active in the app and analysis pipeline.</Text>
        </View>

        {sports.map((sport) => {
          const isLoading = loadingId === sport.id;
          return (
            <View key={sport.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name={(sport.icon as any) || "tennisball-outline"} size={18} color={sport.enabled ? sport.color || "#34D399" : "#94A3B8"} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{sport.name}</Text>
                  <Text style={styles.cardDescription}>{sport.description}</Text>
                </View>
                <Switch
                  value={Boolean(sport.enabled)}
                  disabled={isLoading}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleToggle(sport, value);
                  }}
                  trackColor={{ false: "#2A2A50", true: "#34D39940" }}
                  thumbColor={sport.enabled ? "#34D399" : "#64748B"}
                />
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, sport.enabled ? styles.badgeEnabled : styles.badgeDisabled]}>
                  <Text style={[styles.badgeText, sport.enabled ? styles.badgeTextEnabled : styles.badgeTextDisabled]}>
                    {sport.enabled ? "Enabled" : "Disabled"}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
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
    gap: 14,
  },
  section: {
    marginBottom: 6,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 12,
    color: "#64748B",
  },
  card: {
    gap: 10,
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A36",
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
  },
  badgeRow: {
    flexDirection: "row",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeEnabled: {
    backgroundColor: "#10B98120",
    borderColor: "#10B98140",
  },
  badgeDisabled: {
    backgroundColor: "#33415520",
    borderColor: "#33415540",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  badgeTextEnabled: {
    color: "#34D399",
  },
  badgeTextDisabled: {
    color: "#94A3B8",
  },
});