import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
        ? "#00F5A0"
        : "#FF6B6B"
      : null;

  const changeIcon =
    change !== null && change !== undefined
      ? change >= 0
        ? ("caret-up" as const)
        : ("caret-down" as const)
      : null;

  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: accentColor + "18" }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {change !== null && change !== undefined && changeColor && changeIcon && (
        <View style={styles.changeRow}>
          <Ionicons name={changeIcon} size={12} color={changeColor} />
          <Text style={[styles.changeText, { color: changeColor }]}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    gap: 6,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#CBD5E1",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  unit: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  changeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
