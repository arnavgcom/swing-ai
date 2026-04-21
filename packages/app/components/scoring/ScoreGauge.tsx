import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ds } from "@/constants/design-system";
import { useSportAccent } from "@/utils/useSportAccent";

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  change?: number | null;
  changeLayout?: "leftOfScore" | "belowScore";
}

export function ScoreGauge({
  score,
  maxScore = 100,
  size = 140,
  strokeWidth = 10,
  label,
  change,
  changeLayout = "leftOfScore",
}: ScoreGaugeProps) {
  const accent = useSportAccent();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedMaxScore = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 100;
  const clampedScore = Math.max(0, Math.min(clampedMaxScore, Number.isFinite(score) ? score : 0));
  const normalizedScore = (clampedScore / clampedMaxScore) * 100;
  const strokeDashoffset = circumference * (1 - normalizedScore / 100);

  // Score band colours stay semantic for instant readability — coaches
  // need to know "good vs bad" at a glance regardless of sport. The
  // mid-band uses the active sport's accent so the gauge still feels
  // sport-aware without losing the green/yellow/red information.
  const getScoreColor = () => {
    if (normalizedScore >= 80) return ds.color.success;
    if (normalizedScore >= 60) return accent.primary;
    if (normalizedScore >= 40) return ds.color.warning;
    return ds.color.danger;
  };

  const hasChange = change !== null && change !== undefined;
  const hasRenderableChange = hasChange && Math.abs(change) >= 1e-6;
  const changeColor = hasRenderableChange
    ? Math.abs(change) < 1e-6
      ? ds.color.textSecondary
      : change > 0
        ? ds.color.success
        : ds.color.danger
    : null;
  const changeIcon = hasRenderableChange
    ? Math.abs(change) < 1e-6
      ? "remove"
      : change > 0
        ? "caret-up"
        : "caret-down"
    : null;
  const changeLabel = hasRenderableChange
    ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%`
    : null;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getScoreColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.scoreContainer, { width: size, height: size }]}>
        {changeLayout === "leftOfScore" ? (
          <View style={styles.scoreRow}>
            {hasRenderableChange && changeColor && changeIcon && changeLabel ? (
              <View style={styles.changePill}>
                <Ionicons
                  name={changeIcon as any}
                  size={Math.max(12, Math.round(size * 0.07))}
                  color={changeColor}
                />
                <Text style={[styles.changeText, { color: changeColor, fontSize: Math.max(12, Math.round(size * 0.08)) }]}>
                  {changeLabel}
                </Text>
              </View>
            ) : null}
            <Text
              style={[styles.scoreText, { color: getScoreColor(), fontSize: size * 0.25 }]}
            >
              {clampedMaxScore === 10 ? clampedScore.toFixed(1) : clampedScore}
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={[styles.scoreText, { color: getScoreColor(), fontSize: size * 0.25 }]}
            >
              {clampedMaxScore === 10 ? clampedScore.toFixed(1) : clampedScore}
            </Text>
            {label && (
              <Text
                style={[styles.label, { fontSize: size * 0.085 }]}
              >
                {label}
              </Text>
            )}
            {hasRenderableChange && changeColor && changeIcon && changeLabel ? (
              <View style={styles.changeRowBelow}>
                <Ionicons
                  name={changeIcon as any}
                  size={Math.max(12, Math.round(size * 0.07))}
                  color={changeColor}
                />
                <Text style={[styles.changeText, { color: changeColor, fontSize: Math.max(12, Math.round(size * 0.08)) }]}>
                  {changeLabel}
                </Text>
              </View>
            ) : null}
          </>
        )}
        {changeLayout === "leftOfScore" && label && (
          <Text
            style={[styles.label, { fontSize: size * 0.085 }]}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scoreText: {
    ...ds.type.bold,
    ...ds.tabularNums,
  },
  label: {
    ...ds.type.medium,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: ds.color.textTertiary,
  },
  changePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  changeRowBelow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  changeText: {
    ...ds.type.semibold,
    ...ds.tabularNums,
  },
});
