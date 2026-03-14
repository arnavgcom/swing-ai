import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Line, G } from "react-native-svg";
import type { Landmark } from "@/lib/ghost-correction";

interface SkeletonRendererProps {
  landmarks: Landmark[];
  color: string;
  highlightJoints?: number[];
  highlightColor?: string;
  opacity?: number;
  width: number;
  height: number;
}

const CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [0, 11], [0, 12],
];

const JOINT_RADIUS = 2.5;
const HIGHLIGHT_RADIUS = 4.5;
const LINE_WIDTH = 2.5;

export function SkeletonRenderer({
  landmarks,
  color,
  highlightJoints,
  highlightColor = "#F87171",
  opacity = 1,
  width,
  height,
}: SkeletonRendererProps) {
  const highlightSet = useMemo(
    () => new Set(highlightJoints || []),
    [highlightJoints],
  );

  const landmarkMap = useMemo(() => {
    const map = new Map<number, Landmark>();
    for (const lm of landmarks) {
      map.set(lm.id, lm);
    }
    return map;
  }, [landmarks]);

  const toX = (v: number) => v * width;
  const toY = (v: number) => v * height;

  return (
    <G opacity={opacity}>
      {CONNECTIONS.map(([a, b]) => {
        const lmA = landmarkMap.get(a);
        const lmB = landmarkMap.get(b);
        if (!lmA || !lmB) return null;
        if (lmA.visibility < 0.3 || lmB.visibility < 0.3) return null;

        const isHighlighted = highlightSet.has(a) && highlightSet.has(b);

        return (
          <Line
            key={`${a}-${b}`}
            x1={toX(lmA.x)}
            y1={toY(lmA.y)}
            x2={toX(lmB.x)}
            y2={toY(lmB.y)}
            stroke={isHighlighted ? highlightColor : color}
            strokeWidth={isHighlighted ? LINE_WIDTH + 1 : LINE_WIDTH}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}

      {landmarks.map((lm) => {
        if (lm.visibility < 0.3) return null;
        const isHighlighted = highlightSet.has(lm.id);

        return (
          <Circle
            key={lm.id}
            cx={toX(lm.x)}
            cy={toY(lm.y)}
            r={isHighlighted ? HIGHLIGHT_RADIUS : JOINT_RADIUS}
            fill={isHighlighted ? highlightColor : color}
            opacity={isHighlighted ? 1 : opacity}
          />
        );
      })}
    </G>
  );
}
