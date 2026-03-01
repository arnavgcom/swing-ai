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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors, { sportColors } from "@/constants/colors";
import { fetchAnalyses } from "@/lib/api";
import { AnalysisCard } from "@/components/AnalysisCard";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";

export default function DashboardScreen() {
  const colors = Colors.dark;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedSport, selectedMovement, setSport } = useSport();

  const sc = sportColors[selectedSport?.name || ""] || { primary: "#6C5CE7", gradient: "#5A4BD1" };

  const { data: analyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses"],
    queryFn: fetchAnalyses,
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  const completed = analyses?.filter((a) => a.status === "completed") || [];
  const processing = analyses?.filter(
    (a) => a.status === "processing" || a.status === "pending",
  ) || [];
  const totalAnalyses = analyses?.length || 0;

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const firstName = user?.name?.split(" ")[0] || "Athlete";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16 + webTopInset, paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6C5CE7" />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Text style={styles.greeting}>Hey, {firstName}</Text>
            <Text style={styles.title}>
              Ace<Text style={styles.titleAccent}>X</Text> AI
            </Text>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSport(null);
              }}
              style={[styles.sportPill, { borderColor: sc.primary + "50" }]}
            >
              <LinearGradient
                colors={[sc.primary + "20", sc.gradient + "10"]}
                style={styles.sportPillGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons
                  name={selectedSport?.icon as any || "fitness-outline"}
                  size={14}
                  color={sc.primary}
                />
                <Text style={[styles.sportPillText, { color: sc.primary }]}>
                  {selectedSport?.name || "Sport"}
                </Text>
                <Ionicons name="swap-horizontal" size={11} color={sc.primary} />
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/profile");
              }}
              style={styles.avatarCircle}
            >
              <Ionicons name="person" size={15} color="#94A3B8" />
            </Pressable>
          </View>
        </View>

        {selectedMovement && (
          <View style={[styles.movementBanner, { borderColor: sc.primary + "30" }]}>
            <View style={[styles.movementDot, { backgroundColor: sc.primary }]} />
            <Text style={[styles.movementBannerText, { color: sc.primary }]}>
              {selectedMovement.name} Analysis
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          {[
            { label: "Total", value: totalAnalyses, color: "#6C5CE7", icon: "analytics" as const },
            { label: "Active", value: processing.length, color: "#4CC9F0", icon: "pulse" as const },
            { label: "Done", value: completed.length, color: "#00F5A0", icon: "checkmark-circle" as const },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <LinearGradient
                colors={[stat.color + "18", stat.color + "08"]}
                style={styles.statCardGradient}
              >
                <Ionicons name={stat.icon} size={18} color={stat.color} />
                <Text style={[styles.statNumber, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </LinearGradient>
            </View>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6C5CE7" />
          </View>
        ) : !analyses || analyses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name={selectedSport?.icon as any || "fitness-outline"} size={40} color="#64748B" />
            </View>
            <Text style={styles.emptyTitle}>No analyses yet</Text>
            <Text style={styles.emptyText}>
              Upload a {selectedMovement?.name?.toLowerCase() || selectedSport?.name?.toLowerCase() || "sport"} video to get started
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/upload");
              }}
              style={({ pressed }) => [
                styles.ctaButton,
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={["#6C5CE7", "#A29BFE"]}
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.ctaText}>Upload Video</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Recent Analyses</Text>
            <View style={styles.list}>
              {analyses.slice(0, 10).map((analysis) => (
                <AnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  onPress={() =>
                    router.push({
                      pathname: "/analysis/[id]",
                      params: { id: analysis.id },
                    })
                  }
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  scroll: { paddingHorizontal: 20 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  topBarLeft: {},
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    marginTop: 2,
  },
  titleAccent: { color: "#00F5A0" },
  sportPill: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  sportPillGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sportPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1A1A36",
    borderWidth: 1,
    borderColor: "#2A2A50",
    alignItems: "center",
    justifyContent: "center",
  },
  movementBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#131328",
    marginBottom: 16,
  },
  movementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  movementBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  statCardGradient: {
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A5030",
  },
  statNumber: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: "#64748B",
  },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#131328",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A50",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 20,
    color: "#64748B",
  },
  ctaButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  listSection: { gap: 14 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  list: { gap: 10 },
});
