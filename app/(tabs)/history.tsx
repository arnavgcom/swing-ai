import React from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fetchAnalysesSummary, deleteAnalysis } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

function TrendChart({ data, dates }: { data: number[]; dates: string[] }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = Math.max(maxVal - minVal, 10);
  const chartHeight = 30;
  const yLabelWidth = 28;
  const chartWidth = 260;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((val, i) => ({
    x: i * stepX,
    y: chartHeight - ((val - minVal) / range) * chartHeight,
  }));

  const yMax = Math.round(maxVal);
  const yMin = Math.round(minVal);

  return (
    <View style={trendStyles.container}>
      <View style={trendStyles.chartRow}>
        <View style={trendStyles.yAxis}>
          <Text style={trendStyles.yLabel}>{yMax}</Text>
          <Text style={trendStyles.yLabel}>{yMin}</Text>
        </View>
        <View style={{ width: chartWidth, height: chartHeight, position: "relative" }}>
          <View style={trendStyles.gridLine} />
          <View style={[trendStyles.gridLine, { top: chartHeight - 1 }]} />
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
                  backgroundColor: i === points.length - 1 ? "#34D399" : "#34D39960",
                  width: i === points.length - 1 ? 8 : 6,
                  height: i === points.length - 1 ? 8 : 6,
                  borderRadius: i === points.length - 1 ? 4 : 3,
                  left: point.x - (i === points.length - 1 ? 4 : 3),
                  top: point.y - (i === points.length - 1 ? 4 : 3),
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={[trendStyles.xAxis, { marginLeft: yLabelWidth }]}>
        {dates.map((d, i) => (
          <Text key={i} style={[trendStyles.xLabel, i === 0 ? { textAlign: "left" as const } : i === dates.length - 1 ? { textAlign: "right" as const } : {}]}>
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: { paddingVertical: 8 },
  chartRow: { flexDirection: "row", alignItems: "stretch" },
  yAxis: {
    width: 28,
    justifyContent: "space-between",
    paddingRight: 4,
  },
  yLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "right" as const,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "#2A2A5020",
  },
  dot: { position: "absolute" },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  xLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    flex: 1,
    textAlign: "center" as const,
  },
});

function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s+(.)/g, (_, c) => " " + c.toUpperCase())
    .trim();
}

const HISTORY_DISPLAY_KEYS = ["power", "timing", "stability", "consistency"];

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

function findSubValue(subs: Record<string, number> | null, key: string): number | null {
  if (!subs) return null;
  for (const k of Object.keys(subs)) {
    if (k.toLowerCase() === key.toLowerCase()) return subs[k];
  }
  return null;
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
  const subEntries = Object.entries(subs).filter(([key]) =>
    HISTORY_DISPLAY_KEYS.includes(key.toLowerCase())
  );
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
          {subEntries.map(([key, val]) => {
            const prevVal = findSubValue(prevItem?.subScores || null, key);
            const subDelta = prevVal != null ? Math.round(val) - Math.round(prevVal) : null;
            return (
              <View key={key} style={summaryStyles.metricItem}>
                <Text style={summaryStyles.metricLabel} numberOfLines={1}>{toTitleCase(key)}</Text>
                <View style={summaryStyles.metricValueRow}>
                  <Text style={summaryStyles.metricValue}>{Math.round(val)}</Text>
                  {subDelta != null && subDelta !== 0 && (
                    <View style={summaryStyles.subDeltaRow}>
                      <Ionicons
                        name={subDelta > 0 ? "arrow-up" : "arrow-down"}
                        size={7}
                        color={subDelta > 0 ? "#34D399" : "#F87171"}
                      />
                      <Text style={[summaryStyles.subDeltaText, { color: subDelta > 0 ? "#34D399" : "#F87171" }]}>
                        {Math.abs(subDelta)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
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
          <Ionicons name="trash-outline" size={13} color="#F87171" />
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
    flexWrap: "wrap",
    marginTop: 12,
    gap: 6,
  },
  metricItem: {
    minWidth: "18%" as any,
    flexGrow: 1,
    flexBasis: "18%" as any,
    backgroundColor: "#0A0A1A50",
    borderRadius: 10,
    padding: 8,
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
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  subDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    paddingBottom: 1,
  },
  subDeltaText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
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
    alignItems: "flex-end",
    gap: 6,
  },
  deltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingBottom: 2,
  },
  deltaText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    padding: 4,
  },
});

export default function HistoryScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedSport, selectedMovement } = useSport();


  const { data: allAnalyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses-summary"],
    queryFn: fetchAnalysesSummary,
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  const analyses = filterBySport(allAnalyses || [], selectedSport?.name, selectedMovement?.name);

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

  const trendItems = completed
    .filter((a) => a.overallScore != null)
    .slice(0, 7)
    .reverse();
  const trendScores = trendItems.map((a) => Math.round(a.overallScore || 0));
  const trendDates = trendItems.map((a) => {
    const d = new Date(a.createdAt);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });


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
          <View style={styles.trendCardGradient}>
            <Text style={styles.trendLabel}>Overall Performance Trend</Text>
            <TrendChart data={trendScores} dates={trendDates} />
          </View>
        </View>
      )}

      <View style={styles.statsRow}>
        {[
          { label: "Total", value: totalAnalyses, color: "#6C5CE7", icon: "analytics" as const },
          { label: "In Progress", value: processing.length, color: "#60A5FA", icon: "pulse" as const },
          { label: "Done", value: completed.length, color: "#34D399", icon: "checkmark-circle" as const },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <LinearGradient
              colors={[stat.color + "14", stat.color + "06"]}
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
    marginTop: 20,
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
    backgroundColor: "#15152D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    overflow: "hidden",
    marginBottom: 16,
  },
  trendCardGradient: {
    padding: 12,
    borderRadius: 16,
  },
  trendLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  statCardGradient: {
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    backgroundColor: "#15152D",
  },
  statNumber: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
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
