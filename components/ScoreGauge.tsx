import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { ds } from "@/constants/design-system";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  change?: number | null;
}

export function ScoreGauge({
  score,
  size = 140,
  strokeWidth = 10,
  label,
  change,
}: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const getScoreColor = () => {
    if (score >= 80) return ds.color.success;
    if (score >= 60) return "#60A5FA";
    if (score >= 40) return ds.color.warning;
    return ds.color.danger;
  };

  const hasChange = change !== null && change !== undefined;
  const changeColor = hasChange ? (change >= 0 ? ds.color.success : ds.color.danger) : null;

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
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getScoreColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.scoreContainer, { width: size, height: size }]}>
        <Text
          style={[styles.scoreText, { color: getScoreColor(), fontSize: size * 0.25 }]}
        >
          {score}
        </Text>
        {label && (
          <Text
            style={[styles.label, { fontSize: size * 0.085 }]}
          >
            {label}
          </Text>
        )}
        {hasChange && changeColor && (
          <View style={styles.changeRow}>
            <Ionicons
              name={change >= 0 ? "caret-up" : "caret-down"}
              size={11}
              color={changeColor}
            />
            <Text style={[styles.changeText, { color: changeColor }]}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </Text>
          </View>
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
  scoreText: {
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: ds.color.textTertiary,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
  },
  changeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
