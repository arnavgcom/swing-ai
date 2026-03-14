import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Svg from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";
import { SkeletonRenderer } from "./SkeletonRenderer";
import { SwingPathRenderer } from "./SwingPathRenderer";
import { PlaybackControls } from "./PlaybackControls";
import { JointHeatmapRenderer } from "./JointHeatmapRenderer";
import { CorrectionArrowRenderer } from "./CorrectionArrowRenderer";
import type { CorrectionResult, SkeletonFrame } from "@/lib/ghost-correction";
import { generateCorrectedFrames } from "@/lib/ghost-correction";
import {
  calculateDeviationScores,
  buildJointDeviationMap,
  type PlayerMetrics,
  type OptimalRanges,
  type JointDeviationMap,
} from "@/lib/joint-heatmap";

interface GhostSwingAnimationProps {
  playerFrames: SkeletonFrame[];
  correction: CorrectionResult;
  corrections?: CorrectionResult[];
  playerMetrics?: PlayerMetrics;
  optimalRanges?: OptimalRanges;
}

const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 400;
const TARGET_FPS = 60;

export function GhostSwingAnimation({
  playerFrames,
  correction,
  corrections,
  playerMetrics,
  optimalRanges,
}: GhostSwingAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [showPaths, setShowPaths] = useState(true);
  const [showCorrectionArrow, setShowCorrectionArrow] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [viewMode, setViewMode] = useState<"fit" | "zoom">("fit");
  const [selectedCorrectionIndex, setSelectedCorrectionIndex] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const correctionChips = useMemo(() => {
    if (Array.isArray(corrections) && corrections.length > 0) {
      return corrections;
    }
    return [correction];
  }, [corrections, correction]);

  const activeCorrection = correctionChips[selectedCorrectionIndex] || correction;

  useEffect(() => {
    if (!correctionChips.length) {
      setSelectedCorrectionIndex(0);
      return;
    }
    const preferredIndex = correctionChips.findIndex(
      (item) => item.metricKey === correction.metricKey,
    );
    setSelectedCorrectionIndex(preferredIndex >= 0 ? preferredIndex : 0);
  }, [correction.metricKey, correctionChips]);

  const correctedFrames = useMemo(
    () => generateCorrectedFrames(playerFrames, activeCorrection),
    [playerFrames, activeCorrection],
  );

  const jointDeviationMap = useMemo<JointDeviationMap>(() => {
    if (!playerMetrics || !optimalRanges) return new Map();
    const scores = calculateDeviationScores(playerMetrics, optimalRanges);
    return buildJointDeviationMap(scores);
  }, [playerMetrics, optimalRanges]);

  const heatmapAvailable = jointDeviationMap.size > 0;

  const totalFrames = playerFrames.length;
  const frameDuration = (1000 / TARGET_FPS) / speed;

  const animate = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= frameDuration) {
        lastTimeRef.current = timestamp;
        setCurrentFrame((prev) => {
          if (prev >= totalFrames - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [frameDuration, totalFrames],
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, animate]);

  const handleTogglePlay = useCallback(() => {
    if (currentFrame >= totalFrames - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying((prev) => !prev);
  }, [currentFrame, totalFrames]);

  const handleSeek = useCallback((frame: number) => {
    setCurrentFrame(Math.max(0, Math.min(frame, totalFrames - 1)));
    setIsPlaying(false);
  }, [totalFrames]);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
  }, []);

  if (totalFrames === 0) return null;

  const playerLandmarks = playerFrames[currentFrame]?.landmarks || [];
  const correctedLandmarks = correctedFrames[currentFrame]?.landmarks || [];

  const correctionLabel = useMemo(() => {
    if (activeCorrection.correctionType === "rotation") return "Rotate";
    if (activeCorrection.correctionType === "angle") return "Adjust angle";
    if (activeCorrection.correctionType === "position") return "Reposition";
    return "Adjust";
  }, [activeCorrection.correctionType]);

  const canvasScale = viewMode === "zoom" ? 1.35 : 1;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.correctionChipRow}>
        {correctionChips.map((item, index) => {
          const isActive = index === selectedCorrectionIndex;
          return (
            <Pressable
              key={`${item.metricKey}-${index}`}
              style={[styles.correctionChip, isActive && styles.correctionChipActive]}
              onPress={() => {
                setSelectedCorrectionIndex(index);
                setCurrentFrame(0);
                setIsPlaying(false);
              }}
              hitSlop={6}
            >
              <Text
                style={[styles.correctionChipText, isActive && styles.correctionChipTextActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.titleRow}>
        <View style={styles.viewModeGroup}>
          <Pressable
            style={[styles.pathToggle, viewMode === "fit" && styles.pathToggleActive]}
            onPress={() => setViewMode("fit")}
            hitSlop={8}
          >
            <Text style={[styles.pathToggleText, viewMode === "fit" && styles.pathToggleTextActive]}>Fit</Text>
          </Pressable>
          <Pressable
            style={[styles.pathToggle, viewMode === "zoom" && styles.pathToggleActive]}
            onPress={() => setViewMode("zoom")}
            hitSlop={8}
          >
            <Text style={[styles.pathToggleText, viewMode === "zoom" && styles.pathToggleTextActive]}>Zoom</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.pathToggle, showPaths && styles.pathToggleActive]}
          onPress={() => setShowPaths((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="analytics" size={14} color={showPaths ? "#fff" : ds.color.textTertiary} />
          <Text style={[styles.pathToggleText, showPaths && styles.pathToggleTextActive]}>Path</Text>
        </Pressable>
        <Pressable
          style={[styles.pathToggle, showCorrectionArrow && styles.arrowToggleActive]}
          onPress={() => setShowCorrectionArrow((v) => !v)}
          hitSlop={8}
        >
          <Ionicons
            name="arrow-forward"
            size={14}
            color={showCorrectionArrow ? "#fff" : ds.color.textTertiary}
          />
          <Text style={[styles.pathToggleText, showCorrectionArrow && styles.pathToggleTextActive]}>Arrow</Text>
        </Pressable>
        {heatmapAvailable && (
          <Pressable
            style={[styles.pathToggle, showHeatmap && styles.heatmapToggleActive]}
            onPress={() => setShowHeatmap((v) => !v)}
            hitSlop={8}
          >
            <Ionicons name="body" size={14} color={showHeatmap ? "#fff" : ds.color.textTertiary} />
            <Text style={[styles.pathToggleText, showHeatmap && styles.heatmapToggleTextActive]}>Heat</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.canvasContainer}>
        <View style={[styles.canvasScaleWrap, { transform: [{ scale: canvasScale }] }]}>
          <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={styles.canvas}>
            {showPaths && (
              <SwingPathRenderer
                playerFrames={playerFrames}
                correctedFrames={correctedFrames}
                currentFrame={currentFrame}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              />
            )}

            <SkeletonRenderer
              landmarks={correctedLandmarks}
              color="#34D399"
              opacity={0.55}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            />

            <SkeletonRenderer
              landmarks={playerLandmarks}
              color="#60A5FA"
              highlightJoints={activeCorrection.jointIndices}
              highlightColor="#F87171"
              opacity={0.9}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            />

            {showCorrectionArrow && (
              <CorrectionArrowRenderer
                correction={activeCorrection}
                landmarks={playerLandmarks}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              />
            )}

            {showHeatmap && (
              <JointHeatmapRenderer
                landmarks={playerLandmarks}
                jointDeviationMap={jointDeviationMap}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              />
            )}
          </Svg>
        </View>

        <View style={styles.floatingLabelBottom}>
          <Text style={styles.floatingLabelText}>
            {correctionLabel}: {activeCorrection.label}
          </Text>
        </View>
      </View>

      {showPaths && (
        <View style={styles.pathLegend}>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#F87171" }]} />
            <Text style={styles.pathLegendLabel}>Your Path</Text>
          </View>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#34D399" }]} />
            <Text style={styles.pathLegendLabel}>Optimal Path</Text>
          </View>
          {showCorrectionArrow && (
            <View style={styles.pathLegendItem}>
              <View style={[styles.pathLegendDot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.pathLegendLabel}>Correction Arrow</Text>
            </View>
          )}
        </View>
      )}

      {showHeatmap && (
        <View style={styles.pathLegend}>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#34D399" }]} />
            <Text style={styles.pathLegendLabel}>Good</Text>
          </View>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#FBBF24" }]} />
            <Text style={styles.pathLegendLabel}>Small deviation</Text>
          </View>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#F87171" }]} />
            <Text style={styles.pathLegendLabel}>Large deviation</Text>
          </View>
        </View>
      )}

      <PlaybackControls
        isPlaying={isPlaying}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        speed={speed}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: "hidden",
  },
  correctionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  correctionChip: {
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  correctionChipActive: {
    borderColor: "rgba(248,113,113,0.55)",
    backgroundColor: "rgba(248,113,113,0.2)",
  },
  correctionChipText: {
    color: ds.color.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  correctionChipTextActive: {
    color: "#FECACA",
    fontFamily: "Inter_600SemiBold",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexWrap: "wrap",
  },
  viewModeGroup: {
    flexDirection: "row",
    gap: 6,
    marginRight: "auto",
  },
  pathToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pathToggleActive: {
    backgroundColor: "rgba(248,113,113,0.2)",
    borderColor: "rgba(248,113,113,0.4)",
  },
  arrowToggleActive: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderColor: "rgba(245,158,11,0.4)",
  },
  heatmapToggleActive: {
    backgroundColor: "rgba(251,191,36,0.2)",
    borderColor: "rgba(251,191,36,0.4)",
  },
  heatmapToggleTextActive: {
    color: "#FBBF24",
  },
  pathToggleText: {
    color: ds.color.textTertiary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  pathToggleTextActive: {
    color: "#fff",
  },
  canvasContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 18, 34, 0.72)",
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    position: "relative",
  },
  canvas: {
    backgroundColor: "transparent",
  },
  canvasScaleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  floatingLabelBottom: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  floatingLabelText: {
    color: "#F8FAFC",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  pathLegend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 6,
    marginHorizontal: 12,
  },
  pathLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pathLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pathLegendLabel: {
    color: ds.color.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
