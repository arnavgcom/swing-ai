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
    if (score >= 80) return "#30D158";
    if (score >= 60) return "#0A84FF";
    if (score >= 40) return "#FFD60A";
    return "#FF453A";
  };

  const hasChange = change !== null && change !== undefined;
  const changeColor = hasChange ? (change >= 0 ? "#30D158" : "#FF453A") : null;

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
    color: "#FFFFFF",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  score: {
    fontSize: 16,
    fontWeight: "700",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "600",
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
