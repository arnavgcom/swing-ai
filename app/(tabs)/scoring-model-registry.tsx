import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { TabHeader } from "@/components/TabHeader";
import { fetchScoringModelRegistry } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { resolveUserTimeZone } from "@/lib/timezone";
import { ds } from "@/constants/design-system";
import { GlassCard } from "@/components/ui/GlassCard";

type VersionTrendPoint = {
  modelVersion: string;
  movementDetectionAccuracyPct: number;
  scoringAccuracyPct: number;
  sampleCount: number;
};

function formatDateTime(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export default function ScoringModelRegistryScreen() {
  const { user } = useAuth();
  const profileTimeZone = resolveUserTimeZone(user);
  const isAdmin = user?.role === "admin";

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    isError,
  } = useQuery({
    queryKey: ["scoring-model-registry"],
    queryFn: fetchScoringModelRegistry,
    enabled: isAdmin,
    retry: false,
  });

  const trendPoints: VersionTrendPoint[] = React.useMemo(() => {
    const source = data || [];
    const bucket = new Map<string, { md: number; sc: number; count: number }>();
    for (const entry of source) {
      const key = entry.modelVersion;
      const current = bucket.get(key) || { md: 0, sc: 0, count: 0 };
      current.md += Number(entry.movementDetectionAccuracyPct || 0);
      current.sc += Number(entry.scoringAccuracyPct || 0);
      current.count += 1;
      bucket.set(key, current);
    }

    return Array.from(bucket.entries())
      .map(([modelVersion, values]) => ({
        modelVersion,
        movementDetectionAccuracyPct: values.count ? Number((values.md / values.count).toFixed(1)) : 0,
        scoringAccuracyPct: values.count ? Number((values.sc / values.count).toFixed(1)) : 0,
        sampleCount: values.count,
      }))
      .sort((a, b) => a.modelVersion.localeCompare(b.modelVersion, undefined, { numeric: true }));
  }, [data]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />
      <TabHeader />

      {!isAdmin ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyTitle}>Admin only</Text>
          <Text style={styles.emptyText}>Scoring Model Registry is available to admins only.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={ds.color.success} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={ds.color.success}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Scoring Model Registry</Text>
          <Text style={styles.subtitle}>Versioned model scoring and movement detection snapshots</Text>

          {isError ? (
            <Text style={styles.emptyText}>Failed to load registry data. Pull to refresh.</Text>
          ) : null}

          {(data || []).length === 0 ? (
            <Text style={styles.emptyText}>No registry snapshots saved yet.</Text>
          ) : null}

          {trendPoints.length > 0 ? (
            <GlassCard style={styles.trendCard}>
              <Text style={styles.trendTitle}>Version Trend</Text>
              {trendPoints.map((point) => (
                <View key={point.modelVersion} style={styles.trendRow}>
                  <Text style={styles.trendVersionText}>{point.modelVersion}</Text>
                  <View style={styles.trendBarsWrap}>
                    <View style={styles.trendBarTrack}>
                      <View
                        style={[
                          styles.trendBarFillMovement,
                          { width: `${Math.max(1, Math.min(100, point.movementDetectionAccuracyPct))}%` },
                        ]}
                      />
                    </View>
                    <View style={styles.trendBarTrack}>
                      <View
                        style={[
                          styles.trendBarFillScoring,
                          { width: `${Math.max(1, Math.min(100, point.scoringAccuracyPct))}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.trendValueText}>
                    MD {point.movementDetectionAccuracyPct.toFixed(1)}% | SC {point.scoringAccuracyPct.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </GlassCard>
          ) : null}

          {(data || []).map((entry) => (
            <GlassCard key={entry.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.versionText}>Model {entry.modelVersion}</Text>
                <Text style={styles.dateText}>{formatDateTime(entry.createdAt, profileTimeZone)}</Text>
              </View>
              <Text style={styles.metaText}>Movement: {entry.movementType}</Text>
              <Text style={styles.metaText}>
                Movement Detection Accuracy: {entry.movementDetectionAccuracyPct.toFixed(1)}%
              </Text>
              <Text style={styles.metaText}>Scoring Accuracy: {entry.scoringAccuracyPct.toFixed(1)}%</Text>
              <Text style={styles.metaSubText}>{entry.modelVersionDescription}</Text>

              <View style={styles.datasetBlock}>
                <Text style={styles.datasetTitle}>Datasets</Text>
                {(entry.datasetMetrics || []).map((metric) => (
                  <GlassCard key={metric.id} style={styles.datasetRow}>
                    <Text style={styles.datasetName}>{metric.datasetName}</Text>
                    <Text style={styles.datasetMeta}>
                      {metric.movementType} | MD {metric.movementDetectionAccuracyPct.toFixed(1)}% | SC {metric.scoringAccuracyPct.toFixed(1)}%
                    </Text>
                  </GlassCard>
                ))}
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  scroll: { paddingHorizontal: ds.space.xl, paddingBottom: 120, paddingTop: ds.space.xl, gap: 14 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  trendCard: {
    borderRadius: ds.radius.md,
    padding: 12,
    gap: 8,
  },
  trendTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  trendRow: {
    gap: 6,
    paddingVertical: 4,
  },
  trendVersionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  trendBarsWrap: {
    gap: 5,
  },
  trendBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: ds.color.bgElevated,
    overflow: "hidden",
  },
  trendBarFillMovement: {
    height: "100%",
    backgroundColor: ds.color.success,
    borderRadius: 999,
  },
  trendBarFillScoring: {
    height: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 999,
  },
  trendValueText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  card: {
    borderRadius: ds.radius.md,
    padding: 12,
    gap: 6,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  versionText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: ds.color.success,
  },
  dateText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  metaSubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: 2,
  },
  datasetBlock: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: ds.color.glassBorder,
    paddingTop: 8,
    gap: 6,
  },
  datasetTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  datasetRow: {
    borderRadius: ds.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
  },
  datasetName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  datasetMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    textAlign: "center",
  },
});
