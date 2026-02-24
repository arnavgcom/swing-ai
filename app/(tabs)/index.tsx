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

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

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
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            Tennis Forehand
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            CourtVision
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.tint + "15", borderColor: colors.tint + "30" },
            ]}
          >
            <Ionicons name="analytics" size={20} color={colors.tint} />
            <Text style={[styles.statNumber, { color: colors.tint }]}>
              {totalAnalyses}
            </Text>
            <Text style={[styles.statLabel, { color: colors.tint }]}>
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
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : !analyses || analyses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="tennisball-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No analyses yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Upload a forehand video to get started with your performance analysis
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/upload");
              }}
              style={({ pressed }) => [
                styles.ctaButton,
                {
                  backgroundColor: colors.tint,
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
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
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
    textTransform: "uppercase",
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
  listSection: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  list: {
    gap: 10,
  },
});
