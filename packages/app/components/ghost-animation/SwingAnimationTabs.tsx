import React from "react";
import { StyleSheet, View } from "react-native";
import { GhostSwingAnimation } from "./GhostSwingAnimation";
import type { CorrectionResult, SkeletonFrame } from "@/features/ghost-correction";
import type { PlayerMetrics, OptimalRanges } from "@/utils/joint-heatmap";

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
    <View style={styles.container}>
      <GhostSwingAnimation
        playerFrames={playerFrames}
        correction={correction}
        corrections={corrections}
        playerMetrics={playerMetrics}
        optimalRanges={optimalRanges}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "stretch",
  },
});
