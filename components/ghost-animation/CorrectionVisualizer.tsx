import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle as SvgCircle, Defs, Marker } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ds } from "@/constants/design-system";
import type { CorrectionResult } from "@/lib/ghost-correction";

interface CorrectionVisualizerProps {
  correction: CorrectionResult;
}

function formatValue(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}${unit ? ` ${unit}` : ""}`;
}

function formatRange(range: [number, number], unit: string): string {
  return `${range[0]}–${range[1]}${unit ? ` ${unit}` : ""}`;
}

export function CorrectionVisualizer({ correction }: CorrectionVisualizerProps) {
  const { label, playerValue, optimalRange, unit, recommendation, direction } = correction;

  const [lo, hi] = optimalRange;
  const rangeSpan = hi - lo;
  const allMin = Math.min(playerValue, lo) - rangeSpan * 0.3;
  const allMax = Math.max(playerValue, hi) + rangeSpan * 0.3;
  const totalSpan = Math.max(allMax - allMin, 1e-6);

  const playerPct = ((playerValue - allMin) / totalSpan) * 100;
  const rangeLoPct = ((lo - allMin) / totalSpan) * 100;
  const rangeHiPct = ((hi - allMin) / totalSpan) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.priorityBadge}>
          <Ionicons name="alert-circle" size={14} color="#F87171" />
          <Text style={styles.priorityText}>Priority Correction</Text>
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>

      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.optimalZone,
              { left: `${rangeLoPct}%`, width: `${rangeHiPct - rangeLoPct}%` },
            ]}
          />
          <View
            style={[
              styles.playerMarker,
              { left: `${Math.min(Math.max(playerPct, 2), 98)}%` },
            ]}
          />
        </View>
        <View style={styles.barLabels}>
          <Text style={styles.barValue}>
            {formatValue(playerValue, unit)}
          </Text>
          <Text style={styles.barRange}>
            Optimal: {formatRange(optimalRange, unit)}
          </Text>
        </View>
      </View>

      <View style={styles.directionRow}>
        <Ionicons
          name={direction === "increase" ? "arrow-up-circle" : "arrow-down-circle"}
          size={18}
          color={direction === "increase" ? "#34D399" : "#60A5FA"}
        />
        <Text style={styles.recommendation}>{recommendation}</Text>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#60A5FA" }]} />
          <Text style={styles.legendText}>Your Swing</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#34D399" }]} />
          <Text style={styles.legendText}>Corrected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F87171" }]} />
          <Text style={styles.legendText}>Error Joint</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priorityText: {
    color: "#F87171",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricLabel: {
    color: ds.color.textPrimary,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  barContainer: {
    gap: 6,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "visible",
    position: "relative",
  },
  optimalZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(52,211,153,0.25)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.4)",
  },
  playerMarker: {
    position: "absolute",
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F87171",
    marginLeft: -7,
    borderWidth: 2,
    borderColor: "#0A0A1A",
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barValue: {
    color: "#F87171",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  barRange: {
    color: "rgba(52,211,153,0.8)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  directionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: ds.radius.sm,
    padding: 10,
  },
  recommendation: {
    color: ds.color.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: ds.color.textTertiary,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
