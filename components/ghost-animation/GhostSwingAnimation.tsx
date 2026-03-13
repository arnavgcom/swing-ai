import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Svg from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";
import { SkeletonRenderer } from "./SkeletonRenderer";
import { SwingPathRenderer } from "./SwingPathRenderer";
import { PlaybackControls } from "./PlaybackControls";
import { CorrectionVisualizer } from "./CorrectionVisualizer";
import type { CorrectionResult, SkeletonFrame } from "@/lib/ghost-correction";
import { generateCorrectedFrames } from "@/lib/ghost-correction";

interface GhostSwingAnimationProps {
  playerFrames: SkeletonFrame[];
  correction: CorrectionResult;
}

const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 400;
const TARGET_FPS = 60;

export function GhostSwingAnimation({
  playerFrames,
  correction,
}: GhostSwingAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [showPaths, setShowPaths] = useState(true);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const correctedFrames = useMemo(
    () => generateCorrectedFrames(playerFrames, correction),
    [playerFrames, correction],
  );

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
    if (correction.correctionType === "rotation") return "Rotate";
    if (correction.correctionType === "angle") return "Adjust angle";
    if (correction.correctionType === "position") return "Reposition";
    return "Adjust";
  }, [correction.correctionType]);

  const labelJoint = useMemo(() => {
    if (!correction.jointIndices.length || !correctedLandmarks.length) return null;
    const targetId = correction.jointIndices[0];
    const lm = correctedLandmarks.find((l) => l.id === targetId);
    if (!lm) return null;
    return { x: lm.x * CANVAS_WIDTH, y: lm.y * CANVAS_HEIGHT };
  }, [correction.jointIndices, correctedLandmarks]);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="body" size={18} color="#60A5FA" />
        <Text style={styles.title}>Swing Correction</Text>
        <Pressable
          style={[styles.pathToggle, showPaths && styles.pathToggleActive]}
          onPress={() => setShowPaths((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="analytics" size={14} color={showPaths ? "#fff" : ds.color.textTertiary} />
          <Text style={[styles.pathToggleText, showPaths && styles.pathToggleTextActive]}>Path</Text>
        </Pressable>
      </View>

      <View style={styles.canvasContainer}>
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
            highlightJoints={correction.jointIndices}
            highlightColor="#F87171"
            opacity={0.9}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
          />
        </Svg>

        {labelJoint && (
          <View
            style={[
              styles.floatingLabel,
              {
                left: Math.min(Math.max(labelJoint.x - 60, 4), CANVAS_WIDTH - 130),
                top: Math.max(labelJoint.y - 32, 4),
              },
            ]}
          >
            <Text style={styles.floatingLabelText}>
              {correctionLabel}: {correction.label}
            </Text>
          </View>
        )}
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

      <CorrectionVisualizer correction={correction} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: "hidden",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    color: ds.color.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  pathToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pathToggleActive: {
    backgroundColor: "rgba(248,113,113,0.2)",
    borderColor: "rgba(248,113,113,0.4)",
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
    backgroundColor: "rgba(0,0,0,0.3)",
    marginHorizontal: 12,
    borderRadius: ds.radius.md,
    overflow: "hidden",
    position: "relative",
  },
  canvas: {
    backgroundColor: "transparent",
  },
  floatingLabel: {
    position: "absolute",
    backgroundColor: "rgba(248,113,113,0.9)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  floatingLabelText: {
    color: "#fff",
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
