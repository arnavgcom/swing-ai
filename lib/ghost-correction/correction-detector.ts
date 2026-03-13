import type { MetricDefinition } from "@/shared/sport-configs/types";

export interface CorrectionResult {
  metricKey: string;
  label: string;
  unit: string;
  playerValue: number;
  optimalRange: [number, number];
  deviation: number;
  direction: "increase" | "decrease";
  recommendation: string;
  jointIndices: number[];
  correctionType: "rotation" | "angle" | "speed" | "position";
}

const METRIC_JOINT_MAP: Record<string, { joints: number[]; type: "rotation" | "angle" | "speed" | "position" }> = {
  shoulderRotation: { joints: [11, 12, 13, 14, 15, 16], type: "rotation" },
  shoulderRotationSpeed: { joints: [11, 12, 13, 14, 15, 16], type: "rotation" },
  hipRotation: { joints: [23, 24, 11, 12], type: "rotation" },
  hipRotationSpeed: { joints: [23, 24, 11, 12], type: "rotation" },
  kneeBendAngle: { joints: [23, 24, 25, 26], type: "angle" },
  elbowAngle: { joints: [11, 12, 13, 14], type: "angle" },
  wristSpeed: { joints: [15, 16, 13, 14], type: "speed" },
  contactHeight: { joints: [15, 16], type: "position" },
  contactDistance: { joints: [15, 16, 11, 12], type: "position" },
  balanceScore: { joints: [23, 24, 25, 26, 27, 28], type: "position" },
  stanceAngle: { joints: [23, 24, 25, 26, 27, 28], type: "angle" },
  racketLagAngle: { joints: [11, 12, 13, 14, 15, 16], type: "angle" },
  swingPathAngle: { joints: [13, 14, 15, 16], type: "angle" },
  headStability: { joints: [0, 7, 8], type: "position" },
  spineAngle: { joints: [11, 12, 23, 24], type: "angle" },
  splitStepTime: { joints: [27, 28, 25, 26], type: "position" },
  backswingDuration: { joints: [11, 12, 13, 14, 15, 16], type: "rotation" },
  followThroughDuration: { joints: [11, 12, 13, 14, 15, 16], type: "rotation" },
};

const CORRECTION_TEMPLATES: Record<string, { increase: string; decrease: string }> = {
  shoulderRotation: {
    increase: "Start shoulder rotation earlier during the unit turn",
    decrease: "Reduce over-rotation of shoulders to maintain control",
  },
  shoulderRotationSpeed: {
    increase: "Accelerate trunk rotation through the hitting zone",
    decrease: "Slow down shoulder rotation for better control",
  },
  hipRotation: {
    increase: "Drive hips forward more aggressively to generate power",
    decrease: "Reduce hip over-rotation to maintain balance",
  },
  hipRotationSpeed: {
    increase: "Initiate hip rotation earlier in the kinetic chain",
    decrease: "Control hip rotation speed for better accuracy",
  },
  kneeBendAngle: {
    increase: "Bend knees deeper for a lower base and more power",
    decrease: "Straighten legs slightly — too much knee bend reduces mobility",
  },
  elbowAngle: {
    increase: "Extend the elbow more through the swing arc",
    decrease: "Keep the elbow tighter for better racket control",
  },
  wristSpeed: {
    increase: "Accelerate wrist snap through contact for more racket speed",
    decrease: "Reduce wrist speed for more accuracy and consistency",
  },
  contactHeight: {
    increase: "Make contact higher — aim for waist to chest height",
    decrease: "Lower the contact point for better control",
  },
  contactDistance: {
    increase: "Step into the ball to create more separation at contact",
    decrease: "Move contact point closer to the body for control",
  },
  balanceScore: {
    increase: "Maintain a more stable base throughout the stroke",
    decrease: "Allow more dynamic movement — being too rigid limits power",
  },
  racketLagAngle: {
    increase: "Create more lag angle for better whip effect",
    decrease: "Reduce excessive lag to improve timing consistency",
  },
  stanceAngle: {
    increase: "Widen stance for a more stable foundation",
    decrease: "Narrow stance slightly for better footwork",
  },
};

function getRecommendation(metricKey: string, direction: "increase" | "decrease"): string {
  const template = CORRECTION_TEMPLATES[metricKey];
  if (template) return template[direction];
  return direction === "increase"
    ? `Increase ${metricKey} to reach the optimal range`
    : `Decrease ${metricKey} to stay within the optimal range`;
}

export function detectPriorityCorrection(
  metricValues: Record<string, number>,
  metricDefinitions: MetricDefinition[],
): CorrectionResult | null {
  let bestCorrection: CorrectionResult | null = null;
  let maxDeviation = 0;

  for (const def of metricDefinitions) {
    if (!def.optimalRange) continue;
    const value = metricValues[def.key];
    if (value == null || !Number.isFinite(value)) continue;

    const [lo, hi] = def.optimalRange;
    const rangeSpan = Math.max(hi - lo, 1e-6);
    let deviation = 0;
    let direction: "increase" | "decrease" = "increase";

    if (value < lo) {
      deviation = (lo - value) / rangeSpan;
      direction = "increase";
    } else if (value > hi) {
      deviation = (value - hi) / rangeSpan;
      direction = "decrease";
    }

    if (deviation <= 0) continue;

    const jointMapping = METRIC_JOINT_MAP[def.key];
    if (!jointMapping) continue;

    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      bestCorrection = {
        metricKey: def.key,
        label: def.label,
        unit: def.unit,
        playerValue: value,
        optimalRange: def.optimalRange,
        deviation,
        direction,
        recommendation: getRecommendation(def.key, direction),
        jointIndices: jointMapping.joints,
        correctionType: jointMapping.type,
      };
    }
  }

  return bestCorrection;
}
