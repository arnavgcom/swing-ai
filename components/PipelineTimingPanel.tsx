import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatDurationMs,
  type PipelineTiming,
  type PipelineTimingStage,
} from "@shared/pipeline-timing";
import { ds } from "@/constants/design-system";

type PipelineTimingPanelProps = {
  timing: PipelineTiming | null | undefined;
  compact?: boolean;
  showDescriptions?: boolean;
  emptyText?: string;
};

function computeStageElapsed(stage: PipelineTimingStage, nowMs: number): number | null {
  if (typeof stage.elapsedMs === "number" && Number.isFinite(stage.elapsedMs) && stage.elapsedMs >= 0) {
    return stage.elapsedMs;
  }

  const startedMs = stage.startedAt ? Date.parse(stage.startedAt) : NaN;
  if (!Number.isFinite(startedMs)) return null;

  if (stage.completedAt) {
    const completedMs = Date.parse(stage.completedAt);
    if (Number.isFinite(completedMs)) {
      return Math.max(completedMs - startedMs, 0);
    }
  }

  if (stage.status === "running") {
    return Math.max(nowMs - startedMs, 0);
  }

  return null;
}

function getStageStatusMeta(status: PipelineTimingStage["status"]) {
  switch (status) {
    case "completed":
      return { icon: "checkmark-circle", color: ds.color.success, label: "Completed" } as const;
    case "running":
      return { icon: "time", color: "#60A5FA", label: "Running" } as const;
    case "failed":
      return { icon: "alert-circle", color: ds.color.danger, label: "Failed" } as const;
    default:
      return { icon: "ellipse-outline", color: ds.color.textTertiary, label: "Pending" } as const;
  }
}

export function PipelineTimingPanel({
  timing,
  compact = false,
  showDescriptions = true,
  emptyText = "Pipeline timing is not available yet.",
}: PipelineTimingPanelProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const visibleStages = useMemo(
    () => (timing?.stages || []).filter((stage) => stage.key !== "upload"),
    [timing],
  );

  useEffect(() => {
    if (!visibleStages.some((stage) => stage.status === "running")) return;

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [visibleStages]);

  const totalElapsed = useMemo(() => {
    const values = visibleStages
      .map((stage) => computeStageElapsed(stage, nowMs))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0);
  }, [visibleStages, nowMs]);

  if (!visibleStages.length) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.summaryRow, compact && styles.summaryRowCompact]}>
        <Text style={styles.summaryLabel}>Total elapsed</Text>
        <Text style={styles.summaryValue}>{formatDurationMs(totalElapsed)}</Text>
      </View>

      <View style={styles.stageList}>
        {visibleStages.map((stage) => {
          const statusMeta = getStageStatusMeta(stage.status);
          const elapsed = computeStageElapsed(stage, nowMs);

          return (
            <View key={stage.key} style={[styles.stageCard, compact && styles.stageCardCompact]}>
              <View style={styles.stageTopRow}>
                <View style={styles.stageLabelWrap}>
                  <Text style={styles.stageLabel}>{stage.label}</Text>
                  {showDescriptions && !compact && stage.description ? (
                    <Text style={styles.stageDescription}>{stage.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.stageDuration}>{formatDurationMs(elapsed)}</Text>
              </View>

              <View style={styles.stageBottomRow}>
                <View style={[styles.statusBadge, { borderColor: `${statusMeta.color}33`, backgroundColor: `${statusMeta.color}14` }]}>
                  <Ionicons name={statusMeta.icon} size={12} color={statusMeta.color} />
                  <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                </View>
                {stage.note ? <Text style={styles.noteText}>{stage.note}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: ds.space.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  summaryRowCompact: {
    paddingBottom: 0,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  stageList: {
    gap: ds.space.sm,
  },
  stageCard: {
    gap: 8,
    padding: ds.space.sm,
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
  },
  stageCardCompact: {
    paddingVertical: 10,
  },
  stageTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  stageLabelWrap: {
    flex: 1,
    gap: 3,
  },
  stageLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  stageDescription: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  stageDuration: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: ds.color.textSecondary,
  },
  stageBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  noteText: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
});