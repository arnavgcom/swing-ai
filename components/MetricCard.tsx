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
  color?: string;
  change?: number | null;
}

export function MetricCard({ icon, label, value, unit, color, change }: MetricCardProps) {
  const accentColor = color || "#6C5CE7";

  const changeColor =
    change !== null && change !== undefined
      ? change >= 0
        ? "#34D399"
        : "#F87171"
      : null;

  const changeIcon =
    change !== null && change !== undefined
      ? change >= 0
        ? ("caret-up" as const)
        : ("caret-down" as const)
      : null;

  return (
    <GlassCard style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: accentColor + "14" }]}>
        <Ionicons name={icon} size={16} color={accentColor} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {change !== null && change !== undefined && changeColor && changeIcon && (
        <View style={styles.changeRow}>
          <Ionicons name={changeIcon} size={11} color={changeColor} />
          <Text style={[styles.changeText, { color: changeColor }]}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: ds.space.lg,
    borderRadius: ds.radius.lg,
    gap: 6,
    minHeight: 120,
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
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  changeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
