import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dimensions, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Svg from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";
import { SkeletonRenderer } from "./SkeletonRenderer";
import { SwingPathRenderer } from "./SwingPathRenderer";
import { PlaybackControls } from "./PlaybackControls";
import { JointHeatmapRenderer } from "./JointHeatmapRenderer";
import { CorrectionArrowRenderer } from "./CorrectionArrowRenderer";
import type { CorrectionResult, SkeletonFrame } from "@/features/ghost-correction";
import { generateCorrectedFrames } from "@/features/ghost-correction";
import {
  calculateDeviationScores,
  buildJointDeviationMap,
  type PlayerMetrics,
  type OptimalRanges,
  type JointDeviationMap,
} from "@/utils/joint-heatmap";

interface GhostSwingAnimationProps {
  playerFrames: SkeletonFrame[];
  correction: CorrectionResult;
  corrections?: CorrectionResult[];
  playerMetrics?: PlayerMetrics;
  optimalRanges?: OptimalRanges;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CANVAS_WIDTH = Math.min(380, SCREEN_WIDTH - 42);
const CANVAS_HEIGHT = 400;
const TARGET_FPS = 60;
const TRAIL_STEPS = 8;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function interpolateLandmarks(
  current: SkeletonFrame["landmarks"],
  next: SkeletonFrame["landmarks"] | undefined,
  t: number,
): SkeletonFrame["landmarks"] {
  if (!next || !current.length) return current;
  const alpha = clamp01(t);
  if (alpha <= 0) return current;

  const nextById = new Map<number, SkeletonFrame["landmarks"][number]>();
  for (const landmark of next) {
    nextById.set(landmark.id, landmark);
  }

  return current.map((landmark) => {
    const target = nextById.get(landmark.id);
    if (!target) return landmark;
    return {
      ...landmark,
      x: landmark.x + (target.x - landmark.x) * alpha,
      y: landmark.y + (target.y - landmark.y) * alpha,
      z: landmark.z + (target.z - landmark.z) * alpha,
      visibility: landmark.visibility + (target.visibility - landmark.visibility) * alpha,
    };
  });
}

function formatMetricValue(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return unit ? `${rounded} ${unit}` : `${rounded}`;
}

function formatRangeValue(range: [number, number], unit: string): string {
  const lo = Math.round(range[0] * 10) / 10;
  const hi = Math.round(range[1] * 10) / 10;
  return unit ? `${lo}-${hi} ${unit}` : `${lo}-${hi}`;
}

function correctionTypeIcon(type: CorrectionResult["correctionType"]): keyof typeof Ionicons.glyphMap {
  if (type === "rotation") return "refresh-circle";
  if (type === "angle") return "git-compare";
  if (type === "speed") return "speedometer";
  return "move";
}

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
  const [showPaths, setShowPaths] = useState(false);
  const [showCorrectionArrow, setShowCorrectionArrow] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [viewMode, setViewMode] = useState<"fit" | "zoom">("fit");
  const [selectedCorrectionIndex, setSelectedCorrectionIndex] = useState(0);
  const [frameBlend, setFrameBlend] = useState(0);
  const [showTrail, setShowTrail] = useState(true);
  const [splitMode, setSplitMode] = useState(true);
  const [isWalkthrough, setIsWalkthrough] = useState(false);
  const animationRef = useRef<number | null>(null);
  const correctionChipsScrollRef = useRef<ScrollView | null>(null);
  const correctionChipLayoutsRef = useRef<Array<{ x: number; width: number }>>([]);
  const correctionChipsViewportWidthRef = useRef(0);
  const correctionChipsContentWidthRef = useRef(0);
  const lastTimeRef = useRef<number>(0);

  const scrollToCorrectionChip = useCallback((index: number) => {
    const layout = correctionChipLayoutsRef.current[index];
    if (!layout || !correctionChipsScrollRef.current) return;

    const viewportWidth = correctionChipsViewportWidthRef.current;
    const contentWidth = correctionChipsContentWidthRef.current;

    if (viewportWidth <= 0) {
      correctionChipsScrollRef.current.scrollTo({
        x: Math.max(layout.x - 14, 0),
        animated: true,
      });
      return;
    }

    const centeredX = layout.x + (layout.width / 2) - (viewportWidth / 2);
    const maxScrollX = Math.max(contentWidth - viewportWidth, 0);

    correctionChipsScrollRef.current.scrollTo({
      x: Math.min(Math.max(centeredX, 0), maxScrollX),
      animated: true,
    });
  }, []);

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

  useEffect(() => {
    scrollToCorrectionChip(selectedCorrectionIndex);
  }, [selectedCorrectionIndex, scrollToCorrectionChip]);

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
        setFrameBlend(0);
        setCurrentFrame((prev) => {
          if (prev >= totalFrames - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      } else {
        setFrameBlend(elapsed / frameDuration);
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

  // Auto walkthrough: advance to next chip when an animation loop ends
  useEffect(() => {
    if (!isWalkthrough || isPlaying) return;
    if (currentFrame < totalFrames - 1) return;

    const nextIndex = selectedCorrectionIndex + 1;
    if (nextIndex < correctionChips.length) {
      const timer = setTimeout(() => {
        setSelectedCorrectionIndex(nextIndex);
        setCurrentFrame(0);
        setFrameBlend(0);
        setIsPlaying(true);
      }, 700);
      return () => clearTimeout(timer);
    }
    // finished all chips
    setIsWalkthrough(false);
  }, [isWalkthrough, isPlaying, currentFrame, totalFrames, selectedCorrectionIndex, correctionChips.length]);

  const handleStartWalkthrough = useCallback(() => {
    setSplitMode(false);
    setSelectedCorrectionIndex(0);
    setCurrentFrame(0);
    setFrameBlend(0);
    setIsWalkthrough(true);
    setIsPlaying(true);
  }, []);

  const handleStopWalkthrough = useCallback(() => {
    setIsWalkthrough(false);
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (currentFrame >= totalFrames - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying((prev) => !prev);
  }, [currentFrame, totalFrames]);

  const handleSeek = useCallback((frame: number) => {
    setCurrentFrame(Math.max(0, Math.min(frame, totalFrames - 1)));
    setFrameBlend(0);
    setIsPlaying(false);
    setIsWalkthrough(false);
  }, [totalFrames]);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
  }, []);

  if (totalFrames === 0) return null;

  const effectiveBlend = isPlaying ? frameBlend : 0;
  const playerLandmarks = useMemo(
    () => interpolateLandmarks(
      playerFrames[currentFrame]?.landmarks || [],
      playerFrames[currentFrame + 1]?.landmarks,
      effectiveBlend,
    ),
    [playerFrames, currentFrame, effectiveBlend],
  );
  const correctedLandmarks = useMemo(
    () => interpolateLandmarks(
      correctedFrames[currentFrame]?.landmarks || [],
      correctedFrames[currentFrame + 1]?.landmarks,
      effectiveBlend,
    ),
    [correctedFrames, currentFrame, effectiveBlend],
  );
  const playerTrailFrames = useMemo(() => {
    const trail: Array<{ landmarks: SkeletonFrame["landmarks"]; opacity: number }> = [];

    for (let step = TRAIL_STEPS; step >= 1; step -= 1) {
      const frameIndex = currentFrame - step;
      if (frameIndex < 0) continue;

      const landmarks = interpolateLandmarks(
        playerFrames[frameIndex]?.landmarks || [],
        playerFrames[frameIndex + 1]?.landmarks,
        effectiveBlend,
      );

      if (!landmarks.length) continue;

      trail.push({
        landmarks,
        opacity: 0.03 + (TRAIL_STEPS - step + 1) * 0.025,
      });
    }

    return trail;
  }, [playerFrames, currentFrame, effectiveBlend]);

  const canvasScale = viewMode === "zoom" ? 1.35 : 1;

  return (
    <GlassCard style={styles.card}>
      {isWalkthrough && (
        <View style={styles.walkthroughBanner}>
          <Ionicons name="walk" size={14} color="#BF5AF2" />
          <Text style={styles.walkthroughBannerText}>
            Tour · {selectedCorrectionIndex + 1} / {correctionChips.length}
          </Text>
          <Pressable onPress={handleStopWalkthrough} style={styles.walkthroughStop} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#FECACA" />
          </Pressable>
        </View>
      )}

      <ScrollView
        ref={correctionChipsScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.correctionChipRow}
        onLayout={(event) => {
          correctionChipsViewportWidthRef.current = event.nativeEvent.layout.width;
          scrollToCorrectionChip(selectedCorrectionIndex);
        }}
        onContentSizeChange={(width) => {
          correctionChipsContentWidthRef.current = width;
          scrollToCorrectionChip(selectedCorrectionIndex);
        }}
      >
        {correctionChips.map((item, index) => {
          const isActive = index === selectedCorrectionIndex;
          return (
            <Pressable
              key={`${item.metricKey}-${index}`}
              style={[styles.correctionChip, isActive && styles.correctionChipActive]}
              onLayout={(event) => {
                correctionChipLayoutsRef.current[index] = event.nativeEvent.layout;
                if (index === selectedCorrectionIndex) {
                  scrollToCorrectionChip(index);
                }
              }}
              onPress={() => {
                setSelectedCorrectionIndex(index);
                setCurrentFrame(0);
                setFrameBlend(0);
                setIsPlaying(false);
              }}
              hitSlop={6}
            >
              <Ionicons
                name={correctionTypeIcon(item.correctionType)}
                size={12}
                color={isActive ? "#FECACA" : "#A7B7D2"}
              />
              <Text
                style={[styles.correctionChipText, isActive && styles.correctionChipTextActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
        <Pressable
          style={[styles.pathToggle, showTrail && styles.trailToggleActive]}
          onPress={() => setShowTrail((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="footsteps" size={14} color={showTrail ? "#fff" : ds.color.textTertiary} />
          <Text style={[styles.pathToggleText, showTrail && styles.pathToggleTextActive]}>Trail</Text>
        </Pressable>
        <Pressable
          style={[styles.pathToggle, splitMode && styles.splitToggleActive]}
          onPress={() => setSplitMode((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="albums" size={14} color={splitMode ? "#fff" : ds.color.textTertiary} />
          <Text style={[styles.pathToggleText, splitMode && styles.pathToggleTextActive]}>Split</Text>
        </Pressable>
        {correctionChips.length > 1 && (
          <Pressable
            style={[styles.pathToggle, isWalkthrough && styles.tourToggleActive]}
            onPress={isWalkthrough ? handleStopWalkthrough : handleStartWalkthrough}
            hitSlop={8}
          >
            <Ionicons
              name={isWalkthrough ? "stop-circle" : "play-skip-forward"}
              size={14}
              color={isWalkthrough ? "#BF5AF2" : ds.color.textTertiary}
            />
            <Text style={[styles.pathToggleText, isWalkthrough && styles.tourToggleTextActive]}>Tour</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.canvasContainer}>
        <View style={styles.canvasGlowOne} />
        <View style={styles.canvasGlowTwo} />
        {splitMode ? (
          <View style={styles.splitRow}>
            <View style={styles.splitPanel}>
              <Text style={styles.splitPanelLabel}>Your Swing</Text>
              <Svg
                width={CANVAS_WIDTH / 2}
                height={CANVAS_HEIGHT}
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              >
                {showPaths && (
                  <SwingPathRenderer
                    playerFrames={playerFrames}
                    correctedFrames={correctedFrames}
                    currentFrame={currentFrame}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                  />
                )}
                {showTrail && playerTrailFrames.map((trailItem, index) => (
                  <SkeletonRenderer
                    key={`trail-s-${index}`}
                    landmarks={trailItem.landmarks}
                    color="#0A84FF"
                    opacity={trailItem.opacity}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                  />
                ))}
                <SkeletonRenderer
                  landmarks={playerLandmarks}
                  color="#0A84FF"
                  highlightJoints={activeCorrection.jointIndices}
                  highlightColor="#FF453A"
                  opacity={0.9}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                />
              </Svg>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitPanel}>
              <Text style={styles.splitPanelLabel}>Corrected</Text>
              <Svg
                width={CANVAS_WIDTH / 2}
                height={CANVAS_HEIGHT}
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              >
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
                  color="#30D158"
                  opacity={0.9}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                />
                {showCorrectionArrow && (
                  <CorrectionArrowRenderer
                    correction={activeCorrection}
                    landmarks={correctedLandmarks}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    splitMode
                  />
                )}
              </Svg>
            </View>
          </View>
        ) : (
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
              {showTrail && playerTrailFrames.map((trailItem, index) => (
                <SkeletonRenderer
                  key={`trail-${index}`}
                  landmarks={trailItem.landmarks}
                  color="#0A84FF"
                  opacity={trailItem.opacity}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                />
              ))}
              <SkeletonRenderer
                landmarks={correctedLandmarks}
                color="#30D158"
                opacity={0.55}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              />
              <SkeletonRenderer
                landmarks={playerLandmarks}
                color="#0A84FF"
                highlightJoints={activeCorrection.jointIndices}
                highlightColor="#FF453A"
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
        )}
      </View>

      {showPaths && (
        <View style={styles.pathLegend}>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#FF453A" }]} />
            <Text style={styles.pathLegendLabel}>Your Path</Text>
          </View>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#30D158" }]} />
            <Text style={styles.pathLegendLabel}>Optimal Path</Text>
          </View>
          {showCorrectionArrow && (
            <View style={styles.pathLegendItem}>
              <View style={[styles.pathLegendDot, { backgroundColor: "#FF9F0A" }]} />
              <Text style={styles.pathLegendLabel}>Correction Arrow</Text>
            </View>
          )}
        </View>
      )}

      {showHeatmap && (
        <View style={styles.pathLegend}>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#30D158" }]} />
            <Text style={styles.pathLegendLabel}>Good</Text>
          </View>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#FFD60A" }]} />
            <Text style={styles.pathLegendLabel}>Small deviation</Text>
          </View>
          <View style={styles.pathLegendItem}>
            <View style={[styles.pathLegendDot, { backgroundColor: "#FF453A" }]} />
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
    width: "100%",
    alignSelf: "stretch",
    marginHorizontal: 0,
    marginVertical: 12,
    overflow: "hidden",
  },
  correctionChipRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  correctionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(148,163,184,0.14)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  correctionChipActive: {
    borderColor: "rgba(248,113,113,0.55)",
    backgroundColor: "rgba(248,113,113,0.2)",
  },
  correctionChipText: {
    color: ds.color.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  correctionChipTextActive: {
    color: "#FECACA",
    fontWeight: "600",
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
    color: "#FFD60A",
  },
  pathToggleText: {
    color: ds.color.textTertiary,
    fontSize: 11,
    fontWeight: "500",
  },
  pathToggleTextActive: {
    color: "#fff",
  },
  canvasContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 15, 30, 0.9)",
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.25)",
    overflow: "hidden",
    position: "relative",
  },
  canvasGlowOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(34,197,94,0.16)",
    top: -60,
    right: -20,
  },
  canvasGlowTwo: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(96,165,250,0.16)",
    bottom: -70,
    left: -30,
  },
  canvas: {
    backgroundColor: "transparent",
  },
  canvasScaleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pathLegend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 6,
    marginHorizontal: 4,
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
  },
  trailToggleActive: {
    backgroundColor: "rgba(96,165,250,0.2)",
    borderColor: "rgba(96,165,250,0.4)",
  },
  splitToggleActive: {
    backgroundColor: "rgba(167,139,250,0.2)",
    borderColor: "rgba(167,139,250,0.4)",
  },
  tourToggleActive: {
    backgroundColor: "rgba(167,139,250,0.22)",
    borderColor: "rgba(167,139,250,0.5)",
  },
  tourToggleTextActive: {
    color: "#C4B5FD",
  },
  walkthroughBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167,139,250,0.25)",
    backgroundColor: "rgba(109,40,217,0.15)",
  },
  walkthroughBannerText: {
    flex: 1,
    color: "#C4B5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  walkthroughStop: {
    padding: 4,
  },
  splitRow: {
    flexDirection: "row",
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  splitPanel: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  splitPanelLabel: {
    position: "absolute",
    top: 8,
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    zIndex: 1,
  },
  splitDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
