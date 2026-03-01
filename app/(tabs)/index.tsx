import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { fetchAnalyses } from "@/lib/api";
import { AnalysisCard } from "@/components/AnalysisCard";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { selectedSport, selectedMovement, setSport } = useSport();

  const sportColor = selectedSport?.color || colors.tint;

  const { data: analyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses"],
    queryFn: fetchAnalyses,
    refetchInterval: 5000,
  });

  const completed = analyses?.filter((a) => a.status === "completed") || [];
  const processing = analyses?.filter(
    (a) => a.status === "processing" || a.status === "pending",
  ) || [];
  const totalAnalyses = analyses?.length || 0;

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const firstName = user?.name?.split(" ")[0] || "Athlete";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16 + webTopInset, paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Hey, {firstName}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              AceX AI
            </Text>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSport(null);
              }}
              style={[styles.sportPill, { backgroundColor: sportColor + "18", borderColor: sportColor + "40" }]}
            >
              <Ionicons
                name={selectedSport?.icon as any || "fitness-outline"}
                size={14}
                color={sportColor}
              />
              <Text style={[styles.sportPillText, { color: sportColor }]}>
                {selectedSport?.name || "Sport"}
              </Text>
              <Ionicons name="swap-horizontal" size={12} color={sportColor} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                logout();
              }}
              style={[styles.avatarCircle, { backgroundColor: colors.surfaceAlt }]}
            >
              <Ionicons name="person" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {selectedMovement && (
          <View style={[styles.movementBanner, { backgroundColor: sportColor + "10", borderColor: sportColor + "25" }]}>
            <Ionicons name={selectedMovement.icon as any} size={16} color={sportColor} />
            <Text style={[styles.movementBannerText, { color: sportColor }]}>
              Analyzing: {selectedMovement.name}
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: sportColor + "15", borderColor: sportColor + "30" },
            ]}
          >
            <Ionicons name="analytics" size={20} color={sportColor} />
            <Text style={[styles.statNumber, { color: sportColor }]}>
              {totalAnalyses}
            </Text>
            <Text style={[styles.statLabel, { color: sportColor }]}>
              Total
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.blue + "15", borderColor: colors.blue + "30" },
            ]}
          >
            <Ionicons name="sync" size={20} color={colors.blue} />
            <Text style={[styles.statNumber, { color: colors.blue }]}>
              {processing.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.blue }]}>
              Active
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.accent + "15", borderColor: colors.accent + "30" },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            <Text style={[styles.statNumber, { color: colors.accent }]}>
              {completed.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.accent }]}>
              Done
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={sportColor} />
          </View>
        ) : !analyses || analyses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={selectedSport?.icon as any || "fitness-outline"} size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No analyses yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Upload a {selectedMovement?.name?.toLowerCase() || selectedSport?.name?.toLowerCase() || "sport"} video to get started
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/upload");
              }}
              style={({ pressed }) => [
                styles.ctaButton,
                {
                  backgroundColor: sportColor,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.ctaText}>Upload Video</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Analyses
            </Text>
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
  container: { flex: 1 },
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
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  sportPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  sportPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    marginBottom: 16,
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
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
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
  },
  loadingWrap: {
    paddingTop: 60,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
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
  },
  list: { gap: 10 },
});
