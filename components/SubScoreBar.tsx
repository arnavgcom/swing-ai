import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface SubScoreBarProps {
  label: string;
  score: number;
  delay?: number;
}

export function SubScoreBar({ label, score, delay = 0 }: SubScoreBarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      width.value = withTiming(score, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [score, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const getColor = () => {
    if (score >= 80) return "#00F5A0";
    if (score >= 60) return "#4CC9F0";
    if (score >= 40) return "#FFD93D";
    return "#FF6B6B";
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.score, { color: getColor() }]}>{score}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, animatedStyle, { backgroundColor: getColor() }]}
        />
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
    fontFamily: "Inter_500Medium",
    color: "#F8FAFC",
  },
  score: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#22224A",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
