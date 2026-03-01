import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { sportColors } from "@/constants/colors";
import { fetchAnalysesSummary } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

const DISPLAY_KEYS = ["consistency", "timing", "stability"];

function findSubScore(subs: Record<string, number>, target: string): number | null {
  const lower = target.toLowerCase();
  for (const k of Object.keys(subs)) {
    if (k.toLowerCase() === lower) return subs[k];
  }
  return null;
}

function filterBySport(analyses: AnalysisSummary[], sportName: string | undefined, movementName: string | undefined): AnalysisSummary[] {
  if (!sportName) return analyses;
  const sportLower = sportName.toLowerCase();
  return analyses.filter((a) => {
    if (!a.configKey) return false;
    const keyLower = a.configKey.toLowerCase();
    if (!keyLower.startsWith(sportLower)) return false;
    if (movementName) {
      const movLower = movementName.toLowerCase().replace(/\s+/g, "");
      if (!keyLower.includes(movLower)) return false;
    }
    return true;
  });
}

function computeScores(analyses: AnalysisSummary[]) {
  const completed = analyses.filter((a) => a.status === "completed" && a.overallScore != null);
  if (completed.length === 0) {
    return { overall: null, category: null, subs: [] as { key: string; value: number; delta: number | null }[], overallDelta: null };
  }

  const latest = completed[0];
  const prev = completed.length > 1 ? completed[1] : null;
  const overall = Math.round(latest.overallScore || 0);
  const category = latest.detectedMovement || null;

  let overallDelta: number | null = null;
  if (prev?.overallScore != null) {
    overallDelta = overall - Math.round(prev.overallScore);
  }

  const latestSubs = latest.subScores || {};
  const prevSubs = prev?.subScores || {};

  const subs = DISPLAY_KEYS.map((key) => {
    const value = findSubScore(latestSubs, key);
    if (value == null) return null;
    const prevVal = findSubScore(prevSubs, key);
    const delta = prevVal != null ? Math.round(value) - Math.round(prevVal) : null;
    return { key, value: Math.round(value), delta };
  }).filter((s): s is { key: string; value: number; delta: number | null } => s != null);

  return { overall, category, subs, overallDelta };
}

function DeltaBadge({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value == null || value === 0) return null;
  const isUp = value > 0;
  return (
    <View style={[deltaStyles.badge, { backgroundColor: isUp ? "#34D39915" : "#F8717115" }]}>
      <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={10} color={isUp ? "#34D399" : "#F87171"} />
      <Text style={[deltaStyles.text, { color: isUp ? "#34D399" : "#F87171" }]}>
        {Math.abs(value)}{suffix || ""}
      </Text>
    </View>
  );
}

const deltaStyles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { selectedSport, selectedMovement } = useSport();

  const sc = sportColors[selectedSport?.name || ""] || { primary: "#6C5CE7", gradient: "#5A4BD1" };

  const { data: allAnalyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses-summary"],
    queryFn: fetchAnalysesSummary,
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  const analyses = filterBySport(allAnalyses || [], selectedSport?.name, selectedMovement?.name);
  const firstName = user?.name?.split(" ")[0] || "Athlete";
  const scores = computeScores(analyses);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <TabHeader />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6C5CE7" />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
          <Text style={styles.sportLine}>Your {selectedSport?.name || "Sport"} Performance</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6C5CE7" />
          </View>
        ) : (
          <>
            <View style={styles.glassCard}>
              <LinearGradient
                colors={[sc.primary + "12", sc.gradient + "08", "#15152D"]}
                style={styles.glassCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.glassLabel}>Overall Score</Text>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreLeft}>
                    <Text style={styles.scoreBig}>
                      {scores.overall != null ? scores.overall : "—"}
                    </Text>
                    <DeltaBadge value={scores.overallDelta} suffix=" pts" />
                  </View>
                  {scores.category && (
                    <View style={[styles.categoryBadge, { backgroundColor: sc.primary + "18", borderColor: sc.primary + "30" }]}>
                      <Text style={[styles.categoryText, { color: sc.primary }]} numberOfLines={1}>
                        {scores.category}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </View>

            {scores.subs.length > 0 && (
              <View style={styles.subsRow}>
                {scores.subs.map((sub) => (
                  <View key={sub.key} style={styles.subCard}>
                    <LinearGradient
                      colors={[sc.primary + "14", sc.primary + "06"]}
                      style={styles.subCardGradient}
                    >
                      <Text style={styles.subLabel}>{toTitleCase(sub.key)}</Text>
                      <View style={styles.subValueRow}>
                        <Text style={[styles.subValue, { color: sc.primary }]}>{sub.value}</Text>
                        <DeltaBadge value={sub.delta} />
                      </View>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/upload");
              }}
              style={({ pressed }) => [
                styles.uploadButton,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={["#6C5CE7", "#A29BFE"]}
                style={styles.uploadGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.uploadText}>Upload Video</Text>
              </LinearGradient>
            </Pressable>

            {(!analyses || analyses.length === 0) && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name={(selectedSport?.icon as any) || "fitness-outline"} size={36} color="#475569" />
                </View>
                <Text style={styles.emptyTitle}>No analyses yet</Text>
                <Text style={styles.emptyText}>
                  Upload a {selectedSport?.name?.toLowerCase() || "sport"} video to get started
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  greetingSection: { marginTop: 20, marginBottom: 28 },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  sportLine: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 10,
  },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  glassCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6C5CE730",
    overflow: "hidden",
    marginBottom: 16,
  },
  glassCardGradient: {
    padding: 24,
    borderRadius: 20,
  },
  glassLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  scoreLeft: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  scoreBig: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    lineHeight: 62,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  subsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  subCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  subCardGradient: {
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5030",
  },
  subLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: "#64748B",
  },
  subValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  uploadButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  uploadGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  uploadText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 20,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#15152D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A5060",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
    lineHeight: 21,
    paddingHorizontal: 20,
    color: "#64748B",
  },
});
