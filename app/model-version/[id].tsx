import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fetchScoringModelRegistryEntry } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

function formatLabel(label: string): string {
  return label
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMismatchPalette(rate: number): { bg: string; border: string; text: string } {
  if (rate < 10) {
    return { bg: "#052E1A", border: "#166534", text: "#34D399" };
  }
  if (rate <= 25) {
    return { bg: "#3F2A07", border: "#92400E", text: "#FBBF24" };
  }
  return { bg: "#3F1114", border: "#7F1D1D", text: "#F87171" };
}

function getDeltaPalette(delta: number): { color: string; icon: "arrow-up" | "arrow-down" | "remove" } {
  if (delta > 0) {
    return { color: "#F87171", icon: "arrow-up" };
  }
  if (delta < 0) {
    return { color: "#34D399", icon: "arrow-down" };
  }
  return { color: "#94A3B8", icon: "remove" };
}

export default function ModelVersionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["scoring-model-registry-entry", id],
    queryFn: () => fetchScoringModelRegistryEntry(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Model Version</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorTitle}>Unable to load model version</Text>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : "Try again"}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.summaryCard}>
            <View style={styles.versionPill}>
              <Text style={styles.versionPillText}>Model {data.modelVersion}</Text>
            </View>
            {(() => {
              const summaryPalette = getMismatchPalette(data.summary.mismatchRatePct);
              return (
                <View style={styles.summaryMismatchRow}>
                  <Text style={styles.summaryMismatchLabel}>Mismatch Rate</Text>
                  <View
                    style={[
                      styles.rateBadge,
                      {
                        backgroundColor: summaryPalette.bg,
                        borderColor: summaryPalette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.rateText, { color: summaryPalette.text }]}> 
                      {data.summary.mismatchRatePct.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              );
            })()}
            <Text style={styles.summaryLine}>{formatDateTime(data.createdAt)}</Text>
            {String(data.movementType || "").trim().toLowerCase() !== "all" ? (
              <Text style={styles.summaryLine}>Movement: {formatLabel(data.movementType)}</Text>
            ) : null}
          </GlassCard>

          <GlassCard style={styles.discrepancyCard}>
            <Text style={styles.discrepancyTitle}>Training Data</Text>
            {(data.topVideos || []).map((item) => (
              <Pressable
                key={item.analysisId}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/analysis/[id]", params: { id: item.analysisId } });
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}
              >
                <GlassCard style={styles.discrepancyRow}>
                  <View style={styles.discrepancyLeft}>
                    <Text style={styles.videoName} numberOfLines={1}>
                      {String(item.userName || "Player")}
                    </Text>
                    <Text style={styles.videoMeta} numberOfLines={1}>
                      {`${String(item.sportName || "Sport")} • ${formatLabel(item.movementName)}`}
                    </Text>
                    <Text style={styles.videoMeta}>{formatDateTime(item.createdAt)}</Text>
                    <Text style={styles.videoMeta}>{`${item.mismatches}/${item.manualShots} shots mismatched`}</Text>
                  </View>
                  <View style={styles.discrepancyRight}>
                    {(() => {
                      const palette = getMismatchPalette(item.mismatchRatePct);
                      const delta = Number(item.mismatchDeltaPct || 0);
                      const deltaPalette = getDeltaPalette(delta);
                      return (
                        <>
                          <View
                            style={[
                              styles.rateBadge,
                              { backgroundColor: palette.bg, borderColor: palette.border },
                            ]}
                          >
                            <Text style={[styles.rateText, { color: palette.text }]}> 
                              {item.mismatchRatePct.toFixed(1)}%
                            </Text>
                          </View>
                          <View style={styles.deltaRow}>
                            <Ionicons name={deltaPalette.icon} size={12} color={deltaPalette.color} />
                            <Text style={[styles.deltaText, { color: deltaPalette.color }]}> 
                              {Math.abs(delta).toFixed(1)}%
                            </Text>
                          </View>
                          {item.isNewVideo ? (
                            <Text style={styles.newVideoText}>new video</Text>
                          ) : null}
                        </>
                      );
                    })()}
                  </View>
                </GlassCard>
              </Pressable>
            ))}

            {(data.topVideos || []).length === 0 ? (
              <Text style={styles.emptyText}>No videos found for this model version.</Text>
            ) : null}

            {data.labelConfusions?.length ? (
              <Text style={styles.confusionText}>
                Top confusion: {formatLabel(data.labelConfusions[0].from)} {"->"} {formatLabel(data.labelConfusions[0].to)} ({data.labelConfusions[0].count})
              </Text>
            ) : null}
          </GlassCard>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  header: {
    marginTop: 52,
    paddingHorizontal: ds.space.xl,
    paddingBottom: ds.space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.glass,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  scroll: {
    paddingHorizontal: ds.space.xl,
    paddingBottom: 30,
    gap: ds.space.md,
  },
  summaryCard: {
    borderRadius: ds.radius.lg,
    padding: 14,
    gap: 6,
  },
  summaryMismatchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryMismatchLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
  },
  versionPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#34D39966",
    backgroundColor: "#34D3991A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  versionPillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
    letterSpacing: 0.2,
  },
  summaryLine: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  discrepancyCard: {
    borderRadius: ds.radius.lg,
    padding: 12,
    gap: 10,
  },
  discrepancyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  discrepancyRow: {
    borderRadius: ds.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  discrepancyLeft: {
    flex: 1,
    gap: 2,
  },
  videoName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: ds.color.textSecondary,
  },
  videoMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  discrepancyRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  rateBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rateText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: -2,
  },
  deltaText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  newVideoText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
    marginTop: -2,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  confusionText: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
});
