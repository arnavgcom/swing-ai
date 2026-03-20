import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

interface MetricCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  unit?: string;
  valuePrecision?: number;
  color?: string;
  change?: number | null;
  optimalRange?: [number, number];
}

export function MetricCard({
  icon,
  label,
  value,
  unit,
  valuePrecision,
  color,
  change,
  optimalRange,
}: MetricCardProps) {
  const accentColor = color || "#6C5CE7";
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  const hasOptimalRange =
    !!optimalRange
    && Number.isFinite(optimalRange[0])
    && Number.isFinite(optimalRange[1])
    && optimalRange[1] > optimalRange[0];

  const rangeMin = hasOptimalRange ? optimalRange[0] : null;
  const rangeMax = hasOptimalRange ? optimalRange[1] : null;
  const rangeSpan = hasOptimalRange && rangeMin !== null && rangeMax !== null ? rangeMax - rangeMin : 1;
  const visualPadding = rangeSpan * 0.35;
  const visualMin = hasOptimalRange && rangeMin !== null ? Math.max(0, rangeMin - visualPadding) : 0;
  const visualMax = hasOptimalRange && rangeMax !== null ? rangeMax + visualPadding : 100;
  const visualSpan = Math.max(visualMax - visualMin, 1e-6);

  const clampPct = (raw: number) => Math.max(0, Math.min(100, raw));
  const markerPct = hasOptimalRange && numericValue !== null
    ? clampPct(((numericValue - visualMin) / visualSpan) * 100)
    : 0;
  const zoneStartPct = hasOptimalRange && rangeMin !== null
    ? clampPct(((rangeMin - visualMin) / visualSpan) * 100)
    : 0;
  const zoneEndPct = hasOptimalRange && rangeMax !== null
    ? clampPct(((rangeMax - visualMin) / visualSpan) * 100)
    : 0;
  const zoneWidthPct = Math.max(zoneEndPct - zoneStartPct, 4);

  const rangeState =
    hasOptimalRange && numericValue !== null && rangeMin !== null && rangeMax !== null
      ? numericValue < rangeMin
        ? "low"
        : numericValue > rangeMax
          ? "high"
          : "ok"
      : null;
  const rangeStatusColor =
    rangeState === "ok"
      ? ds.color.success
      : rangeState === "low"
        ? ds.color.warning
        : rangeState === "high"
          ? ds.color.warning
          : ds.color.textSecondary;
  const rangeStatusLabel =
    rangeState === "ok"
      ? "OK"
      : rangeState === "low"
        ? "LOW"
        : rangeState === "high"
          ? "HIGH"
          : null;

  const fmtRangeValue = (num: number) => {
    if (!Number.isFinite(num)) return "-";
    const rounded = Math.round(num * 10) / 10;
    return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(1);
  };

  const rangeLabel = hasOptimalRange && rangeMin !== null && rangeMax !== null
    ? `${fmtRangeValue(rangeMin)}-${fmtRangeValue(rangeMax)}`
    : null;

  const hasChangeValue = typeof change === "number" && Number.isFinite(change);

  const changeColor =
    !hasChangeValue
      ? "#64748B"
      : Math.abs(change) < 1e-6
        ? "#94A3B8"
        : change >= 0
          ? "#34D399"
          : "#F87171";

  const changeIcon =
    !hasChangeValue
      ? ("remove" as const)
      : Math.abs(change) < 1e-6
        ? ("remove" as const)
        : change >= 0
          ? ("caret-up" as const)
          : ("caret-down" as const);

  const changeLabel =
    !hasChangeValue
      ? "--"
      : `${Math.abs(change).toFixed(1)}%`;

  const displayValue =
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(valuePrecision ?? 1)
      : String(value);

  return (
    <GlassCard style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: accentColor + "14" }]}>
        <Ionicons name={icon} size={16} color={accentColor} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{displayValue}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      <View style={styles.footerBlock}>
        {hasOptimalRange && rangeMin !== null && rangeMax !== null ? (
          <View style={styles.rangeBlock}>
            <View style={styles.rangeMetaRow}>
              <View style={styles.rangeChip}>
                <Text style={styles.rangeText}>{rangeLabel}</Text>
              </View>
              {rangeStatusLabel && (
                <View style={[styles.rangeStatusChip, { borderColor: `${rangeStatusColor}66`, backgroundColor: `${rangeStatusColor}22` }]}>
                  <Text style={[styles.rangeStatusText, { color: rangeStatusColor }]}>{rangeStatusLabel}</Text>
                </View>
              )}
            </View>
            <View style={styles.rangeTrack}>
              <View
                style={[
                  styles.rangeZone,
                  {
                    left: `${zoneStartPct}%`,
                    width: `${zoneWidthPct}%`,
                    backgroundColor: `${accentColor}66`,
                  },
                ]}
              />
              {numericValue !== null && (
                <View
                  style={[
                    styles.rangeMarker,
                    {
                      left: `${markerPct}%`,
                      borderColor: accentColor,
                      backgroundColor: "#F8FAFC",
                    },
                  ]}
                />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.rangeBlockPlaceholder} />
        )}
        <View style={styles.changeRow}>
          <Ionicons name={changeIcon} size={11} color={changeColor} />
          <Text style={[styles.changeText, { color: changeColor }]}> 
            {changeLabel}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: ds.space.lg,
    borderRadius: ds.radius.lg,
    gap: 6,
    height: 186,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
    color: ds.color.textTertiary,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  unit: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  footerBlock: {
    marginTop: "auto",
    gap: 8,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minHeight: 14,
  },
  rangeBlock: {
    marginTop: 2,
    gap: 6,
    minHeight: 38,
  },
  rangeBlockPlaceholder: {
    minHeight: 38,
  },
  rangeMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rangeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
  },
  rangeChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(148, 163, 184, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  rangeStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  rangeStatusText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  rangeTrack: {
    position: "relative",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(148, 163, 184, 0.22)",
  },
  rangeZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  rangeMarker: {
    position: "absolute",
    top: -3,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  changeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
