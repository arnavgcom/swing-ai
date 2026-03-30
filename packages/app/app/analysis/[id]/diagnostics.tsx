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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  getAnalysisRefreshIntervalMs,
  getCompletedAnalysisEnrichmentMessage,
} from "@/lib/analysis-refresh";
import {
  fetchAnalysisDetail,
  fetchAnalysisDiagnostics,
  fetchAnalysisVideoMetadata,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTimeInTimeZone, resolveUserTimeZone } from "@/lib/timezone";
import { GlassCard } from "@/components/ui/GlassCard";
import { PipelineTimingPanel } from "@/components/PipelineTimingPanel";
import { ds } from "@/constants/design-system";

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

function formatDate(value?: string | null, timeZone?: string): string {
  if (!value) return "-";
  return formatDateTimeInTimeZone(value, timeZone);
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

function formatFpsStep(step?: string | null): string {
  if (!step) return "Not captured";
  return toTitle(step);
}

function formatSamplingRule(step?: number | null): string {
  if (!step || step <= 1) return "Every frame";
  if (step === 2) return "1 out of 2 frames";
  if (step === 3) return "1 out of 3 frames";
  return `1 out of ${step} frames`;
}

function formatOptionalToggle(value?: boolean | null): string {
  if (typeof value !== "boolean") return "Not captured";
  return value ? "On" : "Off";
}

function formatRoutingReason(reason?: string | null): string {
  if (!reason) return "Not captured";
  return toTitle(reason);
}

function formatValidationMode(value?: string | null): string {
  if (!value) return "Not captured";
  return toTitle(value);
}

export default function AnalysisDiagnosticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileTimeZone = resolveUserTimeZone(user);
  const [pipelineTimingExpanded, setPipelineTimingExpanded] = React.useState(false);
  const [videoTechnicalExpanded, setVideoTechnicalExpanded] = React.useState(false);
  const enrichmentPendingRef = React.useRef(false);

  const { data: detail } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysisDetail(id!),
    enabled: !!id,
    refetchInterval: (query) => getAnalysisRefreshIntervalMs(
      query.state.data?.analysis?.status,
      query.state.data?.metrics?.aiDiagnostics,
    ),
  });

  const { data: diagnostics, isLoading } = useQuery({
    queryKey: ["analysis", id, "diagnostics"],
    queryFn: () => fetchAnalysisDiagnostics(id!),
    enabled: !!id,
    refetchInterval: (query) => getAnalysisRefreshIntervalMs(
      detail?.analysis?.status,
      query.state.data?.pipelineTiming ?? detail?.metrics?.aiDiagnostics,
    ),
  });

  const enrichmentMessage = React.useMemo(
    () => getCompletedAnalysisEnrichmentMessage(
      detail?.analysis?.status,
      diagnostics?.pipelineTiming ?? detail?.metrics?.aiDiagnostics,
    ),
    [detail?.analysis?.status, detail?.metrics?.aiDiagnostics, diagnostics?.pipelineTiming],
  );

  React.useEffect(() => {
    const enrichmentPending = Boolean(enrichmentMessage);
    const shouldRefetchDiagnostics = enrichmentPendingRef.current && !enrichmentPending && !!id;

    if (shouldRefetchDiagnostics) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analysis", id] }),
        queryClient.invalidateQueries({ queryKey: ["analysis", id, "diagnostics"] }),
      ]);
    }

    enrichmentPendingRef.current = enrichmentPending;
  }, [enrichmentMessage, id, queryClient]);

  const { data: videoMetadata } = useQuery({
    queryKey: ["analysis", id, "video-metadata"],
    queryFn: () => fetchAnalysisVideoMetadata(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#0A84FF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>AI-Powered Analysis</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!diagnostics ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>Diagnostics unavailable for this analysis.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {enrichmentMessage ? (
            <GlassCard style={styles.statusCard}>
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color="#64D2FF" />
                <Text style={styles.statusText}>{enrichmentMessage}</Text>
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.heroCard}>
            <Text style={styles.heroLabel}>Confidence</Text>
            <Text style={styles.heroValue}>{diagnostics.aiConfidencePct.toFixed(1)}%</Text>
            <Text style={styles.heroSub}>Detected: {toTitle(diagnostics.detectedMovement)}</Text>
          </GlassCard>

          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Classification Rationale</Text>
            <Text style={styles.cardBody}>{diagnostics.classificationRationale}</Text>
          </GlassCard>

          {diagnostics.validationScreening ? (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Validation Screening</Text>
              <Text style={styles.rowText}>Upload guard mode: {formatValidationMode(diagnostics.validationScreening.uploadGuardMode)}</Text>
              <Text style={styles.rowText}>Upload guard applied: {diagnostics.validationScreening.uploadGuardApplied ? "Yes" : "No"}</Text>
              <Text style={styles.rowText}>Upload guard sample count: {diagnostics.validationScreening.uploadGuardSampleCount ?? "Not used"}</Text>
              <Text style={styles.rowText}>Pipeline validation mode: {formatValidationMode(diagnostics.validationScreening.pipelineValidationMode)}</Text>
              <Text style={styles.rowText}>Pipeline validation applied: {diagnostics.validationScreening.pipelineValidationApplied ? "Yes" : "No"}</Text>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Scoring Basis</Text>
            <Text style={styles.rowText}>Active time: {diagnostics.activeTimeSec.toFixed(2)}s ({diagnostics.activeTimePct.toFixed(1)}%)</Text>
            <Text style={styles.rowText}>Shots considered: {diagnostics.shotsConsideredForScoring}</Text>
            <Text style={styles.rowText}>Pose coverage: {diagnostics.poseCoveragePct.toFixed(1)}%</Text>
            <Text style={styles.rowText}>Frames for scoring: {diagnostics.framesConsideredForScoring}</Text>
          </GlassCard>

          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Shot-Level Labels</Text>
            {diagnostics.analysisFps ? (
              <GlassCard style={styles.shotItem}>
                <Text style={styles.shotTitle}>Analysis FPS Snapshot</Text>
                <Text style={styles.shotSub}>Effective step: {formatFpsStep(diagnostics.analysisFps.effectiveStep)}</Text>
                <Text style={styles.shotSub}>Frame sampling: {formatSamplingRule(diagnostics.analysisFps.sampleStep)}</Text>
                <Text style={styles.shotSub}>Effective sampled FPS: {diagnostics.analysisFps.effectiveFps.toFixed(2)}</Text>
                <Text style={styles.shotSub}>Source FPS: {diagnostics.analysisFps.sourceFps.toFixed(2)}</Text>
                <Text style={styles.shotSub}>Configured low impact: {formatFpsStep(diagnostics.analysisFps.lowImpactStep)}</Text>
                <Text style={styles.shotSub}>Configured high impact: {formatFpsStep(diagnostics.analysisFps.highImpactStep)}</Text>
                <Text style={styles.shotSub}>Tennis auto-detect high impact: {formatOptionalToggle(diagnostics.analysisFps.tennisAutoDetectUsesHighImpact)}</Text>
                <Text style={styles.shotSub}>Tennis match play high impact: {formatOptionalToggle(diagnostics.analysisFps.tennisMatchPlayUsesHighImpact)}</Text>
                <Text style={styles.shotSub}>Routing reason: {formatRoutingReason(diagnostics.analysisFps.routingReason)}</Text>
              </GlassCard>
            ) : (
              <Text style={styles.rowText}>FPS snapshot not available for this analysis.</Text>
            )}
            {diagnostics.shotSegments.length === 0 ? (
              <Text style={styles.rowText}>No shot segments available</Text>
            ) : (
              diagnostics.shotSegments.map((segment) => (
                <GlassCard key={`shot-${segment.index}`} style={styles.shotItem}>
                  <Text style={styles.shotTitle}>Shot {segment.index}: {toTitle(segment.label)}</Text>
                  <Text style={styles.shotSub}>Frames {segment.startFrame}-{segment.endFrame} ({segment.frames})</Text>
                  <Text style={styles.shotSub}>Used for scoring: {segment.includedForScoring ? "Yes" : "No"}</Text>
                </GlassCard>
              ))
            )}
          </GlassCard>

          <GlassCard style={styles.card}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPipelineTimingExpanded((prev) => !prev);
              }}
              style={({ pressed }) => [styles.cardHeaderRow, { opacity: pressed ? 0.78 : 1 }]}
            >
              <Text style={styles.cardTitle}>Pipeline Timing</Text>
              <Ionicons
                name={pipelineTimingExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={ds.color.textTertiary}
              />
            </Pressable>
            {pipelineTimingExpanded ? (
              <PipelineTimingPanel timing={diagnostics.pipelineTiming || null} />
            ) : null}
          </GlassCard>

          <GlassCard style={styles.card}>
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
                color={ds.color.textTertiary}
              />
            </Pressable>
            {videoTechnicalExpanded ? (
              <>
                <Text style={styles.rowText}>Session: {formatDate(detail?.analysis?.capturedAt, profileTimeZone)}</Text>
                <Text style={styles.rowText}>Uploaded: {formatDate(detail?.analysis?.createdAt, profileTimeZone)}</Text>
                <Text style={styles.rowText}>Duration: {diagnostics.videoDurationSec.toFixed(2)}s</Text>
                <Text style={styles.rowText}>FPS: {diagnostics.fps.toFixed(2)}</Text>
                <Text style={styles.rowText}>Resolution: {diagnostics.resolution.width}x{diagnostics.resolution.height}</Text>
                <Text style={styles.rowText}>File size: {formatBytes(diagnostics.fileSizeBytes)}</Text>
                <Text style={styles.rowText}>Bitrate: {diagnostics.bitrateKbps.toFixed(2)} kbps</Text>
                <Text style={styles.rowText}>GPS: {videoMetadata?.gpsLat != null && videoMetadata?.gpsLng != null ? `${Number(videoMetadata.gpsLat).toFixed(6)}, ${Number(videoMetadata.gpsLng).toFixed(6)}` : "Not available"}</Text>
              </>
            ) : null}
          </GlassCard>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  header: {
    marginTop: 52,
    paddingHorizontal: ds.space.xl,
    paddingBottom: ds.space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ds.color.glass,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  emptyText: { fontSize: 13, fontWeight: "500", color: ds.color.textTertiary },
  scroll: { paddingHorizontal: ds.space.xl, paddingBottom: 26, gap: ds.space.md },
  heroCard: {
    borderRadius: ds.radius.lg,
    padding: ds.space.lg,
    gap: 4,
  },
  heroLabel: { fontSize: 12, fontWeight: "500", color: ds.color.textTertiary },
  heroValue: { fontSize: 30, fontWeight: "700", color: ds.color.success },
  heroSub: { fontSize: 13, fontWeight: "500", color: ds.color.textSecondary },
  card: {
    borderRadius: ds.radius.md,
    padding: ds.space.md,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: ds.color.textPrimary },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: 12, fontWeight: "500", color: ds.color.textSecondary },
  statusCard: {
    borderRadius: ds.radius.md,
    padding: ds.space.md,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ds.space.sm,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "#BFDBFE",
  },
  shotItem: {
    borderRadius: ds.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  shotTitle: { fontSize: 12, fontWeight: "600", color: ds.color.textSecondary },
  shotSub: { fontSize: 12, fontWeight: "500", color: ds.color.textTertiary },
  cardBody: { fontSize: 13, fontWeight: "500", color: ds.color.textSecondary, lineHeight: 19 },
  headerSpacer: { width: 40, height: 40 },
});
