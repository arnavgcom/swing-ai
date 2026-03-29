import React, { useMemo } from "react";
import { G, Polyline } from "react-native-svg";
import type { Landmark, SkeletonFrame } from "@/lib/ghost-correction";

interface PathConfig {
  jointIds: number[];
  aggregate?: boolean;
  strokeWidth: number;
  opacity: number;
}

const TRACKED_JOINTS: PathConfig[] = [
  { jointIds: [16], strokeWidth: 2.8, opacity: 0.95 },
  { jointIds: [14], strokeWidth: 1.8, opacity: 0.65 },
  { jointIds: [23, 24], aggregate: true, strokeWidth: 1.8, opacity: 0.55 },
];

const PLAYER_COLOR = "#FF453A";
const OPTIMAL_COLOR = "#30D158";

function extractPoint(
  landmarks: Landmark[],
  config: PathConfig,
): { x: number; y: number } | null {
  if (config.aggregate) {
    let sx = 0, sy = 0, count = 0;
    for (const id of config.jointIds) {
      const lm = landmarks.find((l) => l.id === id);
      if (lm && lm.visibility >= 0.3) { sx += lm.x; sy += lm.y; count++; }
    }
    if (count === 0) return null;
    return { x: sx / count, y: sy / count };
  }

  const lm = landmarks.find((l) => l.id === config.jointIds[0]);
  if (!lm || lm.visibility < 0.3) return null;
  return { x: lm.x, y: lm.y };
}

function buildTrajectory(
  frames: SkeletonFrame[],
  config: PathConfig,
): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  for (const frame of frames) {
    const pt = extractPoint(frame.landmarks, config);
    if (pt) path.push(pt);
    else if (path.length > 0) path.push(path[path.length - 1]);
  }
  return path;
}

function toPointsString(
  path: Array<{ x: number; y: number }>,
  endIndex: number,
  w: number,
  h: number,
): string {
  const sliced = path.slice(0, endIndex + 1);
  return sliced.map((p) => `${p.x * w},${p.y * h}`).join(" ");
}

interface SwingPathRendererProps {
  playerFrames: SkeletonFrame[];
  correctedFrames: SkeletonFrame[];
  currentFrame: number;
  width: number;
  height: number;
}

export function SwingPathRenderer({
  playerFrames,
  correctedFrames,
  currentFrame,
  width,
  height,
}: SwingPathRendererProps) {
  const trajectories = useMemo(() => {
    return TRACKED_JOINTS.map((config) => ({
      config,
      player: buildTrajectory(playerFrames, config),
      optimal: buildTrajectory(correctedFrames, config),
    }));
  }, [playerFrames, correctedFrames]);

  return (
    <G>
      {trajectories.map(({ config, player, optimal }, i) => {
        if (player.length < 2 && optimal.length < 2) return null;

        const playerPts = toPointsString(player, currentFrame, width, height);
        const optimalPts = toPointsString(optimal, currentFrame, width, height);

        return (
          <G key={i}>
            {playerPts.length > 0 && (
              <Polyline
                points={playerPts}
                fill="none"
                stroke={PLAYER_COLOR}
                strokeWidth={config.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={config.opacity}
              />
            )}
            {optimalPts.length > 0 && (
              <Polyline
                points={optimalPts}
                fill="none"
                stroke={OPTIMAL_COLOR}
                strokeWidth={config.strokeWidth + 0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={Math.min(config.opacity + 0.2, 1)}
              />
            )}
          </G>
        );
      })}
    </G>
  );
}
