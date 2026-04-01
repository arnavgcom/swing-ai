import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

export interface CorrectiveRecommendation {
  key: string;
  label: string;
  currentValue: number;
  optimalRange: [number, number];
  unit?: string;
  color: string;
  gapToOptimal: number;
  direction: "increase" | "decrease";
  cue: string;
  drill: string;
}

interface CorrectiveMotionCoachProps {
  recommendations: CorrectiveRecommendation[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(1);
}

function formatRange(range: [number, number], unit?: string): string {
  const unitSuffix = unit ? ` ${unit}` : "";
  return `${fmtNumber(range[0])}-${fmtNumber(range[1])}${unitSuffix}`;
}

function formatGap(gap: number, unit?: string): string {
  const unitSuffix = unit ? ` ${unit}` : "";
  return `${fmtNumber(Math.abs(gap))}${unitSuffix}`;
}

export function CorrectiveMotionCoach({ recommendations }: CorrectiveMotionCoachProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(280);

  const active = recommendations[activeIndex];
  const canRenderNative3D = false;

  const visualBounds = useMemo(() => {
    if (!active) {
      return {
        visualMin: 0,
        visualMax: 100,
      };
    }

    const [rangeMin, rangeMax] = active.optimalRange;
    const span = Math.max(rangeMax - rangeMin, 1e-6);
    const pad = span * 0.5;
    return {
      visualMin: Math.max(0, Math.min(active.currentValue, rangeMin) - pad),
      visualMax: Math.max(active.currentValue, rangeMax) + pad,
    };
  }, [active]);

  const pct = useMemo(() => {
    if (!active) {
      return { current: 0.15, targetStart: 0.35, targetEnd: 0.65, targetCenter: 0.5 };
    }

    const span = Math.max(visualBounds.visualMax - visualBounds.visualMin, 1e-6);
    const [rangeMin, rangeMax] = active.optimalRange;

    const current = clamp01((active.currentValue - visualBounds.visualMin) / span);
    const targetStart = clamp01((rangeMin - visualBounds.visualMin) / span);
    const targetEnd = clamp01((rangeMax - visualBounds.visualMin) / span);

    return {
      current,
      targetStart,
      targetEnd,
      targetCenter: clamp01((targetStart + targetEnd) / 2),
    };
  }, [active, visualBounds]);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    if (measured > 0) {
      setTrackWidth(measured);
    }
  };

  if (!recommendations.length || !active) {
    return null;
  }

  const dotSize = 14;
  const usableWidth = Math.max(trackWidth - dotSize, 1);
  const markerX = usableWidth * pct.current;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How To Improve</Text>
      <View style={styles.chipsRow}>
        {recommendations.map((item, idx) => {
          const selected = idx === activeIndex;
          return (
            <Pressable
              key={item.key}
              onPress={() => setActiveIndex(idx)}
              style={({ pressed }) => [
                styles.metricChip,
                {
                  borderColor: selected ? `${item.color}AA` : "rgba(148, 163, 184, 0.35)",
                  backgroundColor: selected ? `${item.color}22` : "rgba(15, 23, 42, 0.6)",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.metricChipText, { color: selected ? "#FFFFFF" : ds.color.textSecondary }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${active.color}1F` }]}>
            <Ionicons name="flash-outline" size={16} color={active.color} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.metricTitle}>{active.label}</Text>
            <Text style={styles.metricSubtext}>
              {active.direction === "increase" ? "Increase" : "Reduce"} by {formatGap(active.gapToOptimal, active.unit)}
            </Text>
          </View>
        </View>

        <View style={styles.valuesRow}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Current</Text>
            <Text style={styles.valueText}>
              {fmtNumber(active.currentValue)} {active.unit || ""}
            </Text>
          </View>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Optimal</Text>
            <Text style={styles.valueText}>{formatRange(active.optimalRange, active.unit)}</Text>
          </View>
        </View>

        <View style={styles.animationPanel}>
          <Text style={styles.animationLabel}>3D Correction Preview</Text>
          <View style={styles.preview3DStage}>
            {!canRenderNative3D ? (
              <>
                <View style={styles.stageGrid} />
                <View style={styles.ghostFigure}>
                  <View style={[styles.figureHead, { borderColor: `${active.color}AA`, backgroundColor: `${active.color}33` }]} />
                  <View style={[styles.figureTorso, { backgroundColor: `${active.color}88` }]} />
                  <View style={[styles.figureArm, styles.figureArmLeft, { backgroundColor: `${active.color}88` }]} />
                  <View style={[styles.figureArm, styles.figureArmRight, { backgroundColor: `${active.color}88` }]} />
                  <View style={[styles.figureLeg, styles.figureLegLeft, { backgroundColor: `${active.color}88` }]} />
                  <View style={[styles.figureLeg, styles.figureLegRight, { backgroundColor: `${active.color}88` }]} />
                </View>

                <View
                  style={[
                    styles.playerFigure,
                    {
                      transform: [
                        { translateX: 8 },
                        { perspective: 700 },
                        { rotateY: "-8deg" },
                        { rotateX: "6deg" },
                      ],
                    },
                  ]}
                >
                  <View style={styles.figureHead} />
                  <View style={styles.figureTorso} />
                  <View style={[styles.figureArm, styles.figureArmLeft]} />
                  <View style={[styles.figureArm, styles.figureArmRight]} />
                  <View style={[styles.figureLeg, styles.figureLegLeft]} />
                  <View style={[styles.figureLeg, styles.figureLegRight]} />
                </View>
              </>
            ) : null}
          </View>
          <View style={styles.track} onLayout={onTrackLayout}>
            <View
              style={[
                styles.targetZone,
                {
                  left: `${pct.targetStart * 100}%`,
                  width: `${Math.max((pct.targetEnd - pct.targetStart) * 100, 5)}%`,
                  backgroundColor: `${active.color}66`,
                },
              ]}
            />
            <View
              style={[
                styles.marker,
                {
                  borderColor: active.color,
                  transform: [{ translateX: markerX }],
                },
              ]}
            />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FFFFFF", borderColor: active.color }]} />
              <Text style={styles.legendText}>Your movement path</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: `${active.color}66`, borderColor: `${active.color}AA` }]} />
              <Text style={styles.legendText}>Target zone</Text>
            </View>
          </View>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.copyTitle}>Cue</Text>
          <Text style={styles.copyText}>{active.cue}</Text>
          <Text style={styles.copyTitle}>Drill</Text>
          <Text style={styles.copyText}>{active.drill}</Text>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metricChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderRadius: ds.radius.lg,
    padding: ds.space.lg,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  metricTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  metricSubtext: {
    fontSize: 12,
    fontWeight: "500",
    color: ds.color.warning,
  },
  valuesRow: {
    flexDirection: "row",
    gap: 10,
  },
  valueBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    borderRadius: 12,
    backgroundColor: "rgba(10, 14, 28, 0.7)",
    padding: 10,
    gap: 4,
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: ds.color.textTertiary,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  animationPanel: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    borderRadius: 12,
    padding: 10,
    gap: 10,
    backgroundColor: "rgba(10, 14, 28, 0.62)",
  },
  animationLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: ds.color.textSecondary,
  },
  preview3DStage: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    backgroundColor: "rgba(2, 6, 23, 0.8)",
    overflow: "hidden",
    justifyContent: "flex-end",
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  stageGrid: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    opacity: 0.24,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  ghostFigure: {
    position: "absolute",
    left: 28,
    bottom: 12,
    width: 42,
    height: 88,
    opacity: 0.7,
  },
  playerFigure: {
    position: "absolute",
    left: 28,
    bottom: 12,
    width: 42,
    height: 88,
  },
  figureHead: {
    position: "absolute",
    top: 0,
    left: 13,
    width: 16,
    height: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7C7CC",
    backgroundColor: "#0F172A",
  },
  figureTorso: {
    position: "absolute",
    top: 17,
    left: 18,
    width: 6,
    height: 33,
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },
  figureArm: {
    position: "absolute",
    top: 25,
    width: 4,
    height: 22,
    borderRadius: 99,
    backgroundColor: "#AEAEB2",
  },
  figureArmLeft: {
    left: 11,
    transform: [{ rotate: "28deg" }],
  },
  figureArmRight: {
    left: 27,
    transform: [{ rotate: "-28deg" }],
  },
  figureLeg: {
    position: "absolute",
    top: 49,
    width: 4,
    height: 28,
    borderRadius: 99,
    backgroundColor: "#8E8E93",
  },
  figureLegLeft: {
    left: 15,
    transform: [{ rotate: "18deg" }],
  },
  figureLegRight: {
    left: 23,
    transform: [{ rotate: "-14deg" }],
  },
  track: {
    position: "relative",
    height: 16,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    justifyContent: "center",
  },
  targetZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  marker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    top: 1,
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 11,
    color: ds.color.textTertiary,
  },
  copyBlock: {
    gap: 6,
  },
  copyTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: ds.color.textSecondary,
    marginTop: 2,
  },
  copyText: {
    fontSize: 13,
    lineHeight: 20,
    color: ds.color.textSecondary,
  },
});
