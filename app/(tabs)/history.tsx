import React from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { fetchAnalysesSummary, deleteAnalysis } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { sportColors } from "@/constants/colors";
import { TabHeader } from "@/components/TabHeader";

function TrendChart({ data }: { data: number[] }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = Math.max(maxVal - minVal, 10);
  const chartHeight = 100;
  const chartWidth = 280;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((val, i) => ({
    x: i * stepX,
    y: chartHeight - ((val - minVal) / range) * chartHeight,
  }));

  return (
    <View style={trendStyles.container}>
      <View style={trendStyles.gridLine} />
      <View style={[trendStyles.gridLine, { top: "50%" }]} />
      <View style={{ width: chartWidth, height: chartHeight, position: "relative" }}>
        {points.map((point, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = point.x - prev.x;
          const dy = point.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`line-${i}`}
              style={{
                position: "absolute",
                left: prev.x,
                top: prev.y,
                width: length,
                height: 2,
                backgroundColor: "#34D399",
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: "left center",
                opacity: 0.8,
              }}
            />
          );
        })}
        {points.map((point, i) => (
          <View
            key={`dot-${i}`}
            style={[
              trendStyles.dot,
              {
                left: point.x - 4,
                top: point.y - 4,
                backgroundColor: i === points.length - 1 ? "#34D399" : "#34D39960",
                width: i === points.length - 1 ? 10 : 8,
                height: i === points.length - 1 ? 10 : 8,
                borderRadius: i === points.length - 1 ? 5 : 4,
                left: point.x - (i === points.length - 1 ? 5 : 4),
                top: point.y - (i === points.length - 1 ? 5 : 4),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: { position: "relative", alignItems: "center", paddingVertical: 12 },
  gridLine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "25%",
    height: 1,
    backgroundColor: "#2A2A5020",
  },
  dot: { position: "absolute" },
});

function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s+(.)/g, (_, c) => " " + c.toUpperCase())
    .trim();
}

function SummaryCard({
  item,
  isOwner,
  onPress,
  onDelete,
  allAnalyses,
}: {
  item: AnalysisSummary;
  isOwner: boolean;
  onPress: () => void;
  onDelete: () => void;
  allAnalyses: AnalysisSummary[];
}) {
  const date = new Date(item.createdAt);
  const timeStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const score = item.overallScore != null ? Math.round(item.overallScore) : null;
  const subs = item.subScores || {};
  const subEntries = Object.entries(subs).slice(0, 3);
  const movement = item.detectedMovement || item.videoFilename?.split("-")[1] || "";

  const currentIndex = allAnalyses.findIndex((a) => a.id === item.id);
  const prevItem = currentIndex >= 0 && currentIndex < allAnalyses.length - 1 ? allAnalyses[currentIndex + 1] : null;
  let scoreDelta: number | null = null;
  if (score != null && prevItem?.overallScore != null) {
    scoreDelta = score - Math.round(prevItem.overallScore);
  }

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: "#FBBF24", label: "Pending" },
    processing: { color: "#60A5FA", label: "Processing" },
    completed: { color: "#34D399", label: "Completed" },
    failed: { color: "#F87171", label: "Failed" },
  };
  const status = statusConfig[item.status] || statusConfig.pending;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        summaryStyles.card,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={[summaryStyles.accentBar, { backgroundColor: status.color }]} />
      <View style={summaryStyles.cardTop}>
        <View style={summaryStyles.cardTopLeft}>
          <Text style={summaryStyles.timeText}>{timeStr}</Text>
          {movement ? (
            <Text style={summaryStyles.movementText}>{toTitleCase(movement)}</Text>
          ) : null}
        </View>
        <View style={summaryStyles.cardTopRight}>
          {score != null ? (
            <View style={summaryStyles.scoreWrap}>
              <Text style={summaryStyles.scoreLabel}>Score</Text>
              <View style={summaryStyles.scoreDeltaRow}>
                <Text style={summaryStyles.scoreText}>{score}</Text>
                {scoreDelta != null && scoreDelta !== 0 && (
                  <View style={summaryStyles.deltaWrap}>
                    <Ionicons
                      name={scoreDelta > 0 ? "arrow-up" : "arrow-down"}
                      size={10}
                      color={scoreDelta > 0 ? "#34D399" : "#F87171"}
                    />
                    <Text style={[summaryStyles.deltaText, { color: scoreDelta > 0 ? "#34D399" : "#F87171" }]}>
                      {Math.abs(scoreDelta)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={[summaryStyles.statusBadge, { backgroundColor: status.color + "14" }]}>
              <Text style={[summaryStyles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="#475569" />
        </View>
      </View>

      {subEntries.length > 0 && (
        <View style={summaryStyles.metricsRow}>
          {subEntries.map(([key, val]) => (
            <View key={key} style={summaryStyles.metricItem}>
              <Text style={summaryStyles.metricLabel} numberOfLines={1}>{toTitleCase(key)}</Text>
              <Text style={summaryStyles.metricValue}>{Math.round(val)}</Text>
            </View>
          ))}
        </View>
      )}

      {isOwner && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete();
          }}
          style={({ pressed }) => [
            summaryStyles.deleteBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color="#F87171" />
        </Pressable>
      )}
    </Pressable>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: "#15152D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    padding: 16,
    overflow: "hidden",
    position: "relative",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTopLeft: { flex: 1, gap: 2 },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  movementText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  scoreText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  metricsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: "#0A0A1A50",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#2A2A5020",
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  scoreWrap: {
    alignItems: "flex-end",
  },
  scoreLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  scoreDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  deltaText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    padding: 6,
  },
});

export default function HistoryScreen() {
  const colors = Colors.dark;
  const queryClient = useQueryClient();
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

  const deleteMutation = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleDelete = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Analysis", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const isAdmin = user?.role === "admin";
  const isOwner = (item: AnalysisSummary) => item.userId === user?.id;

  const totalAnalyses = analyses?.length || 0;
  const completed = analyses?.filter((a) => a.status === "completed") || [];
  const processing = analyses?.filter((a) => a.status === "processing" || a.status === "pending") || [];

  const trendScores = completed
    .filter((a) => a.overallScore != null)
    .slice(0, 7)
    .reverse()
    .map((a) => Math.round(a.overallScore || 0));

  const latestScore = completed.length > 0 && completed[0].overallScore != null
    ? Math.round(completed[0].overallScore)
    : null;

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const olderThanWeek = completed.filter((a) => a.overallScore != null && new Date(a.createdAt).getTime() < oneWeekAgo);
  let scoreDelta: number | null = null;
  if (latestScore != null && olderThanWeek.length > 0) {
    const avgOld = olderThanWeek.reduce((s, a) => s + (a.overallScore || 0), 0) / olderThanWeek.length;
    scoreDelta = Math.round(latestScore - avgOld);
  }

  const renderItem = ({ item }: { item: AnalysisSummary }) => (
    <SummaryCard
      item={item}
      isOwner={isOwner(item)}
      allAnalyses={analyses || []}
      onPress={() =>
        router.push({
          pathname: "/analysis/[id]",
          params: { id: item.id },
        })
      }
      onDelete={() => handleDelete(item.id, item.videoFilename)}
    />
  );

  const ListHeader = () => (
    <View>
      <View style={styles.headerSection}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Track your progress over time</Text>
      </View>

      {trendScores.length > 1 && (
        <View style={styles.trendCard}>
          <LinearGradient
            colors={[sc.primary + "12", sc.gradient + "08", "#15152D"]}
            style={styles.trendCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.trendHeader}>
              <Text style={styles.trendLabel}>Overall Score</Text>
              <View style={styles.trendScoreRow}>
                <Text style={styles.trendScore}>
                  {latestScore != null ? latestScore : "—"}
                </Text>
                {scoreDelta != null && (
                  <View style={styles.trendDelta}>
                    <Ionicons
                      name={scoreDelta >= 0 ? "arrow-up" : "arrow-down"}
                      size={12}
                      color={scoreDelta >= 0 ? "#34D399" : "#F87171"}
                    />
                    <Text style={[styles.trendDeltaText, { color: scoreDelta >= 0 ? "#34D399" : "#F87171" }]}>
                      {Math.abs(scoreDelta)} this week
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TrendChart data={trendScores} />
          </LinearGradient>
        </View>
      )}

      {completed.length > 0 && completed[0].subScores && Object.keys(completed[0].subScores).length > 0 && (
        <View style={styles.breakdownCard}>
          <LinearGradient
            colors={[sc.primary + "10", sc.gradient + "06", "#15152D"]}
            style={styles.breakdownGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.breakdownTitle}>Performance Breakdown</Text>
            {Object.entries(completed[0].subScores).map(([key, val]) => {
              const prevSubs = completed.length > 1 ? completed[1].subScores : null;
              const prevVal = prevSubs?.[key];
              const delta = prevVal != null ? Math.round(val) - Math.round(prevVal) : null;
              return (
                <View key={key} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{toTitleCase(key)}</Text>
                  <View style={styles.breakdownRight}>
                    <Text style={styles.breakdownScore}>{Math.round(val)}</Text>
                    {delta != null && delta !== 0 && (
                      <View style={[styles.breakdownDelta, { backgroundColor: delta > 0 ? "#34D39914" : "#F8717114" }]}>
                        <Ionicons
                          name={delta > 0 ? "arrow-up" : "arrow-down"}
                          size={10}
                          color={delta > 0 ? "#34D399" : "#F87171"}
                        />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: delta > 0 ? "#34D399" : "#F87171" }}>
                          {Math.abs(delta)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </LinearGradient>
        </View>
      )}

      {analyses && analyses.length > 0 && (
        <Text style={styles.recentTitle}>Recent Sessions</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <TabHeader />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      ) : (
        <FlatList
          data={analyses || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6C5CE7" />
          }
          scrollEnabled={true}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="folder-open-outline" size={36} color="#475569" />
              </View>
              <Text style={styles.emptyTitle}>No analysis history</Text>
              <Text style={styles.emptyText}>
                Upload and analyze videos to see them here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  headerSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    color: "#94A3B8",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  trendCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6C5CE730",
    overflow: "hidden",
    marginBottom: 16,
  },
  trendCardGradient: {
    padding: 20,
    borderRadius: 20,
  },
  trendHeader: {
    marginBottom: 4,
  },
  trendLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  trendScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  trendScore: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    lineHeight: 42,
  },
  trendDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingBottom: 6,
  },
  trendDeltaText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  breakdownCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6C5CE720",
    overflow: "hidden",
    marginBottom: 24,
  },
  breakdownGradient: {
    padding: 20,
    borderRadius: 20,
  },
  breakdownTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A5015",
  },
  breakdownLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  breakdownRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownScore: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  breakdownDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
    paddingHorizontal: 40,
    color: "#64748B",
  },
});
