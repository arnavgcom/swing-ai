import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SubScoreBarProps {
  label: string;
  score: number;
  change?: number | null;
}

export function SubScoreBar({ label, score, change }: SubScoreBarProps) {
  const widthPercent = `${Math.max(0, Math.min(100, score))}%`;

  const getColor = () => {
    if (score >= 80) return "#34D399";
    if (score >= 60) return "#60A5FA";
    if (score >= 40) return "#FBBF24";
    return "#F87171";
  };

  const hasChange = change !== null && change !== undefined;
  const changeColor = hasChange ? (change >= 0 ? "#34D399" : "#F87171") : null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.scoreRow}>
          {hasChange && changeColor && (
            <View style={styles.changeRow}>
              <Ionicons
                name={change >= 0 ? "caret-up" : "caret-down"}
                size={10}
                color={changeColor}
              />
              <Text style={[styles.changeText, { color: changeColor }]}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}%
              </Text>
            </View>
          )}
          <Text style={[styles.score, { color: getColor() }]}>{score}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: widthPercent, backgroundColor: getColor() }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  score: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#1E1E3F",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
