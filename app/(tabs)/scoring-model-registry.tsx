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

type VersionTrendPoint = {
  modelVersion: string;
  movementDetectionAccuracyPct: number;
  scoringAccuracyPct: number;
  sampleCount: number;
};

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

export default function ScoringModelRegistryScreen() {
  const { user } = useAuth();
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
          <ActivityIndicator size="large" color="#34D399" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#34D399"
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
            <View style={styles.trendCard}>
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
            </View>
          ) : null}

          {(data || []).map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.versionText}>Model {entry.modelVersion}</Text>
                <Text style={styles.dateText}>{formatDateTime(entry.createdAt)}</Text>
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
                  <View key={metric.id} style={styles.datasetRow}>
                    <Text style={styles.datasetName}>{metric.datasetName}</Text>
                    <Text style={styles.datasetMeta}>
                      {metric.movementType} | MD {metric.movementDetectionAccuracyPct.toFixed(1)}% | SC {metric.scoringAccuracyPct.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 20, gap: 14 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  trendCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    padding: 12,
    gap: 8,
  },
  trendTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  trendRow: {
    gap: 6,
    paddingVertical: 4,
  },
  trendVersionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  trendBarsWrap: {
    gap: 5,
  },
  trendBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    overflow: "hidden",
  },
  trendBarFillMovement: {
    height: "100%",
    backgroundColor: "#22C55E",
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
    color: "#94A3B8",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
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
    color: "#34D399",
  },
  dateText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#E2E8F0",
  },
  metaSubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  datasetBlock: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#2A2A5060",
    paddingTop: 8,
    gap: 6,
  },
  datasetTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  datasetRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A80",
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
  },
  datasetName: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  datasetMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
});
