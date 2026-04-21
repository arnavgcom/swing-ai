import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ds } from "@/constants/design-system";
import { useSportAccent } from "@/utils/useSportAccent";

interface SubScoreBarProps {
  label: string;
  score: number;
  change?: number | null;
}

export function SubScoreBar({ label, score, change }: SubScoreBarProps) {
  const accent = useSportAccent();
  const widthPercent = `${Math.max(0, Math.min(100, score))}%`;

  // Mid-band uses the active sport's accent so the bars feel sport-aware
  // while the green/yellow/red bands remain semantically meaningful.
  const getColor = () => {
    if (score >= 80) return ds.color.success;
    if (score >= 60) return accent.primary;
    if (score >= 40) return ds.color.warning;
    return ds.color.danger;
  };

  const hasChange = change !== null && change !== undefined;
  const changeColor = hasChange ? (change >= 0 ? ds.color.success : ds.color.danger) : null;

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
    ...ds.type.regular,
    fontSize: ds.font.subhead,
    color: ds.color.textPrimary,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  score: {
    ...ds.type.bold,
    ...ds.tabularNums,
    fontSize: ds.font.body,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  changeText: {
    ...ds.type.semibold,
    ...ds.tabularNums,
    fontSize: ds.font.caption,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: ds.color.bgTertiary,
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
