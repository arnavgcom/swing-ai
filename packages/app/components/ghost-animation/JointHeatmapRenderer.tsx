import React, { useEffect, useMemo, useRef, useState } from "react";
import { Circle, G } from "react-native-svg";
import type { Landmark } from "@/features/ghost-correction";
import type { JointDeviationMap } from "@/utils/joint-heatmap";
import { getHeatmapColor } from "@/utils/joint-heatmap";

const RADIUS = 6;
const PULSE_MIN = 6;
const PULSE_MAX = 11;
const PULSE_PERIOD = 1200; // ms for one full pulse cycle

interface JointHeatmapRendererProps {
  landmarks: Landmark[];
  jointDeviationMap: JointDeviationMap;
  width: number;
  height: number;
}

/**
 * Single pulsing radius value shared by all red joints in this renderer.
 * Runs a requestAnimationFrame loop only when there are red joints to animate.
 */
function usePulseRadius(active: boolean): number {
  const [pulseR, setPulseR] = useState(RADIUS);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setPulseR(RADIUS);
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) % PULSE_PERIOD;
      const t = elapsed / PULSE_PERIOD; // 0–1
      // triangle wave: 0→1→0
      const phase = t < 0.5 ? t * 2 : 2 - t * 2;
      setPulseR(PULSE_MIN + phase * (PULSE_MAX - PULSE_MIN));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active]);

  return pulseR;
}

export function JointHeatmapRenderer({
  landmarks,
  jointDeviationMap,
  width,
  height,
}: JointHeatmapRendererProps) {
  const visibleLandmarks = useMemo(
    () => landmarks.filter((lm) => lm.visibility >= 0.3 && jointDeviationMap.has(lm.id)),
    [landmarks, jointDeviationMap],
  );

  const hasRedJoints = useMemo(
    () => visibleLandmarks.some((lm) => (jointDeviationMap.get(lm.id) ?? 0) > 0.5),
    [visibleLandmarks, jointDeviationMap],
  );

  const pulseR = usePulseRadius(hasRedJoints);

  if (!visibleLandmarks.length) return null;

  return (
    <G>
      {visibleLandmarks.map((lm) => {
        const score = jointDeviationMap.get(lm.id)!;
        const color = getHeatmapColor(score);
        const cx = lm.x * width;
        const cy = lm.y * height;
        const isRed = color === "#F87171";

        return (
          <G key={lm.id}>
            {/* Pulsing outer glow for red (large deviation) joints */}
            {isRed && (
              <Circle
                cx={cx}
                cy={cy}
                r={pulseR}
                fill={color}
                opacity={0.28}
              />
            )}
            {/* Solid heatmap dot */}
            <Circle
              cx={cx}
              cy={cy}
              r={RADIUS}
              fill={color}
              opacity={0.92}
            />
          </G>
        );
      })}
    </G>
  );
}
