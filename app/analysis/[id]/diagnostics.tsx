import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  fetchAnalysisDetail,
  fetchAnalysisDiagnostics,
  fetchAnalysisVideoMetadata,
} from "@/lib/api";

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toTitle(value: string): string {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function AnalysisDiagnosticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [videoTechnicalExpanded, setVideoTechnicalExpanded] = React.useState(false);

  const { data: detail } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
  });

  const { data: diagnostics, isLoading } = useQuery({
    queryKey: ["analysis", id, "diagnostics"],
    queryFn: () => fetchAnalysisDiagnostics(id!),
    enabled: !!id,
  });

  const { data: videoMetadata } = useQuery({
    queryKey: ["analysis", id, "video-metadata"],
    queryFn: () => fetchAnalysisVideoMetadata(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.title}>AI Diagnostics</Text>
        <View style={styles.backButton} />
      </View>

      {!diagnostics ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>Diagnostics unavailable for this analysis.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Confidence</Text>
            <Text style={styles.heroValue}>{diagnostics.aiConfidencePct.toFixed(1)}%</Text>
            <Text style={styles.heroSub}>Detected: {toTitle(diagnostics.detectedMovement)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Classification Rationale</Text>
            <Text style={styles.cardBody}>{diagnostics.classificationRationale}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scoring Basis</Text>
            <Text style={styles.rowText}>Active time: {diagnostics.activeTimeSec.toFixed(2)}s ({diagnostics.activeTimePct.toFixed(1)}%)</Text>
            <Text style={styles.rowText}>Shots considered: {diagnostics.shotsConsideredForScoring}</Text>
            <Text style={styles.rowText}>Pose coverage: {diagnostics.poseCoveragePct.toFixed(1)}%</Text>
            <Text style={styles.rowText}>Frames for scoring: {diagnostics.framesConsideredForScoring}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shot-Level Labels</Text>
            {diagnostics.shotSegments.length === 0 ? (
              <Text style={styles.rowText}>No shot segments available</Text>
            ) : (
              diagnostics.shotSegments.map((segment) => (
                <View key={`shot-${segment.index}`} style={styles.shotItem}>
                  <Text style={styles.shotTitle}>Shot {segment.index}: {toTitle(segment.label)}</Text>
                  <Text style={styles.shotSub}>Frames {segment.startFrame}-{segment.endFrame} ({segment.frames})</Text>
                  <Text style={styles.shotSub}>Used for scoring: {segment.includedForScoring ? "Yes" : "No"}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setVideoTechnicalExpanded((prev) => !prev);
              }}
              style={({ pressed }) => [styles.cardHeaderRow, { opacity: pressed ? 0.78 : 1 }]}
            >
              <Text style={styles.cardTitle}>Video Technical</Text>
              <Ionicons
                name={videoTechnicalExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color="#94A3B8"
              />
            </Pressable>
            {videoTechnicalExpanded ? (
              <>
                <Text style={styles.rowText}>Captured: {formatDate(detail?.analysis?.capturedAt)}</Text>
                <Text style={styles.rowText}>Created: {formatDate(detail?.analysis?.createdAt)}</Text>
                <Text style={styles.rowText}>Duration: {diagnostics.videoDurationSec.toFixed(2)}s</Text>
                <Text style={styles.rowText}>FPS: {diagnostics.fps.toFixed(2)}</Text>
                <Text style={styles.rowText}>Resolution: {diagnostics.resolution.width}x{diagnostics.resolution.height}</Text>
                <Text style={styles.rowText}>File size: {formatBytes(diagnostics.fileSizeBytes)}</Text>
                <Text style={styles.rowText}>Bitrate: {diagnostics.bitrateKbps.toFixed(2)} kbps</Text>
                <Text style={styles.rowText}>GPS: {videoMetadata?.gpsLat != null && videoMetadata?.gpsLng != null ? `${Number(videoMetadata.gpsLat).toFixed(6)}, ${Number(videoMetadata.gpsLng).toFixed(6)}` : "Not available"}</Text>
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  header: {
    marginTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  scroll: { paddingHorizontal: 20, paddingBottom: 26, gap: 12 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#111A37",
    padding: 14,
    gap: 4,
  },
  heroLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  heroValue: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#34D399" },
  heroSub: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#CBD5E1" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#F8FAFC" },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBody: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: "#CBD5E1" },
  rowText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#CBD5E1" },
  shotItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A80",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  shotTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#E2E8F0" },
  shotSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
});
