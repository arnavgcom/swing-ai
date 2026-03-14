import React from "react";
import { GhostSwingAnimation } from "./GhostSwingAnimation";
import type { CorrectionResult, SkeletonFrame } from "@/lib/ghost-correction";
import type { PlayerMetrics, OptimalRanges } from "@/lib/joint-heatmap";

interface SwingAnimationTabsProps {
  playerFrames: SkeletonFrame[];
  correction: CorrectionResult;
  corrections?: CorrectionResult[];
  accentColor?: string;
  playerMetrics?: PlayerMetrics;
  optimalRanges?: OptimalRanges;
}

export function SwingAnimationTabs({
  playerFrames,
  correction,
  corrections,
  playerMetrics,
  optimalRanges,
}: SwingAnimationTabsProps) {
  return (
    <GhostSwingAnimation
      playerFrames={playerFrames}
      correction={correction}
      corrections={corrections}
      playerMetrics={playerMetrics}
      optimalRanges={optimalRanges}
    />
  );
}
