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

function computeScores(analyses: AnalysisSummary[]) {
  const completed = analyses.filter((a) => a.status === "completed" && a.overallScore != null);
  if (completed.length === 0) {
    return { overall: null, consistency: null, power: null, focus: null, overallDelta: null, consistencyDelta: null, powerDelta: null };
  }

  const latest = completed[0];
  const overall = Math.round(latest.overallScore || 0);
  const subs = latest.subScores || {};

  const subKeys = Object.keys(subs);
  const consistency = subs["Consistency"] ?? subs["consistency"] ?? (subKeys.length > 0 ? subs[subKeys[0]] : null);
  const power = subs["Power"] ?? subs["power"] ?? subs["Technique"] ?? subs["technique"] ?? (subKeys.length > 1 ? subs[subKeys[1]] : null);

  let lowestKey = "";
  let lowestVal = Infinity;
  for (const k of subKeys) {
    if (subs[k] < lowestVal) {
      lowestVal = subs[k];
      lowestKey = k;
    }
  }
  const focus = lowestKey || null;

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const olderThanWeek = completed.filter((a) => new Date(a.createdAt).getTime() < oneWeekAgo);

  let overallDelta: number | null = null;
  let consistencyDelta: number | null = null;
  let powerDelta: number | null = null;

  if (olderThanWeek.length > 0) {
    const avgOld = olderThanWeek.reduce((s, a) => s + (a.overallScore || 0), 0) / olderThanWeek.length;
    overallDelta = Math.round(overall - avgOld);

    if (consistency != null) {
      const oldConsVals = olderThanWeek.map((a) => {
        const s = a.subScores || {};
        return s["Consistency"] ?? s["consistency"] ?? (Object.keys(s).length > 0 ? s[Object.keys(s)[0]] : null);
      }).filter((v): v is number => v != null);
      if (oldConsVals.length > 0) {
        consistencyDelta = Math.round(consistency - oldConsVals.reduce((a, b) => a + b, 0) / oldConsVals.length);
      }
    }
    if (power != null) {
      const oldPowVals = olderThanWeek.map((a) => {
        const s = a.subScores || {};
        return s["Power"] ?? s["power"] ?? s["Technique"] ?? s["technique"] ?? (Object.keys(s).length > 1 ? s[Object.keys(s)[1]] : null);
      }).filter((v): v is number => v != null);
      if (oldPowVals.length > 0) {
        powerDelta = Math.round(power - oldPowVals.reduce((a, b) => a + b, 0) / oldPowVals.length);
      }
    }
  }

  return {
    overall,
    consistency: consistency != null ? Math.round(consistency) : null,
    power: power != null ? Math.round(power) : null,
    focus,
    overallDelta,
    consistencyDelta,
    powerDelta,
  };
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const isUp = value >= 0;
  return (
    <View style={[deltaStyles.badge, { backgroundColor: isUp ? "#34D39915" : "#F8717115" }]}>
      <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={10} color={isUp ? "#34D399" : "#F87171"} />
      <Text style={[deltaStyles.text, { color: isUp ? "#34D399" : "#F87171" }]}>
        {Math.abs(value)}
      </Text>
    </View>
  );
}

const deltaStyles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

export default function DashboardScreen() {
  const { user } = useAuth();
  const { selectedSport } = useSport();

  const sc = sportColors[selectedSport?.name || ""] || { primary: "#6C5CE7", gradient: "#5A4BD1" };

  const { data: analyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses-summary"],
    queryFn: fetchAnalysesSummary,
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  const firstName = user?.name?.split(" ")[0] || "Athlete";
  const scores = computeScores(analyses || []);

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
                  <Text style={styles.scoreBig}>
                    {scores.overall != null ? scores.overall : "—"}
                  </Text>
                  {scores.overallDelta != null && (
                    <View style={styles.deltaInline}>
                      <Ionicons
                        name={scores.overallDelta >= 0 ? "arrow-up" : "arrow-down"}
                        size={14}
                        color={scores.overallDelta >= 0 ? "#34D399" : "#F87171"}
                      />
                      <Text style={[styles.deltaText, { color: scores.overallDelta >= 0 ? "#34D399" : "#F87171" }]}>
                        {Math.abs(scores.overallDelta)} this week
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.subRow}>
                  <View style={styles.subItem}>
                    <Text style={styles.subLabel}>Consistency</Text>
                    <View style={styles.subValueRow}>
                      <Text style={styles.subValue}>
                        {scores.consistency != null ? scores.consistency : "—"}
                      </Text>
                      <DeltaBadge value={scores.consistencyDelta} />
                    </View>
                  </View>
                  <View style={[styles.subDivider, { backgroundColor: sc.primary + "20" }]} />
                  <View style={styles.subItem}>
                    <Text style={styles.subLabel}>Power</Text>
                    <View style={styles.subValueRow}>
                      <Text style={styles.subValue}>
                        {scores.power != null ? scores.power : "—"}
                      </Text>
                      <DeltaBadge value={scores.powerDelta} />
                    </View>
                  </View>
                  <View style={[styles.subDivider, { backgroundColor: sc.primary + "20" }]} />
                  <View style={styles.subItem}>
                    <Text style={styles.subLabel}>Today's Focus</Text>
                    <Text style={[styles.focusText, { color: sc.primary }]} numberOfLines={2}>
                      {scores.focus || "—"}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

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
  greetingSection: { marginBottom: 24 },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  sportLine: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 4,
  },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  glassCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6C5CE730",
    overflow: "hidden",
    marginBottom: 24,
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
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 20,
  },
  scoreBig: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    lineHeight: 62,
  },
  deltaInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 10,
  },
  deltaText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  subRow: {
    flexDirection: "row",
    backgroundColor: "#0A0A1A60",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A5030",
  },
  subItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  subValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  subValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  subDivider: {
    width: 1,
    marginVertical: -4,
  },
  focusText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center" as const,
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
