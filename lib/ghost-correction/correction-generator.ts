import type { CorrectionResult } from "./correction-detector";

export interface Landmark {
  id: number;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface SkeletonFrame {
  frame_number: number;
  timestamp: number;
  landmarks: Landmark[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pivotPoint(landmarks: Landmark[], jointIds: number[]): { x: number; y: number } {
  let sx = 0, sy = 0, count = 0;
  for (const id of jointIds) {
    const lm = landmarks.find((l) => l.id === id);
    if (lm) { sx += lm.x; sy += lm.y; count++; }
  }
  if (count === 0) return { x: 0.5, y: 0.5 };
  return { x: sx / count, y: sy / count };
}

function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angle: number,
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function computeCorrectionFactor(correction: CorrectionResult): number {
  const { playerValue, optimalRange, direction } = correction;
  const [lo, hi] = optimalRange;
  const midOptimal = (lo + hi) / 2;
  const rangeSpan = Math.max(hi - lo, 1e-6);

  if (direction === "increase") {
    return Math.min((midOptimal - playerValue) / rangeSpan, 1.0);
  } else {
    return Math.min((playerValue - midOptimal) / rangeSpan, 1.0);
  }
}

function applyRotationCorrection(
  landmarks: Landmark[],
  correction: CorrectionResult,
  factor: number,
): Landmark[] {
  const result = landmarks.map((l) => ({ ...l }));
  const jointSet = new Set(correction.jointIndices);

  const pivotJoints = correction.metricKey.includes("hip")
    ? [23, 24]
    : [11, 12];
  const pivot = pivotPoint(result, pivotJoints);

  const maxAngle = 0.12;
  const angle = correction.direction === "increase"
    ? factor * maxAngle
    : -factor * maxAngle;

  for (const lm of result) {
    if (!jointSet.has(lm.id)) continue;
    const rotated = rotatePoint(lm.x, lm.y, pivot.x, pivot.y, angle);
    lm.x = clamp01(rotated.x);
    lm.y = clamp01(rotated.y);
  }

  return result;
}

function applyAngleCorrection(
  landmarks: Landmark[],
  correction: CorrectionResult,
  factor: number,
): Landmark[] {
  const result = landmarks.map((l) => ({ ...l }));
  const jointSet = new Set(correction.jointIndices);

  const strength = factor * 0.04;

  for (const lm of result) {
    if (!jointSet.has(lm.id)) continue;

    if (correction.direction === "increase") {
      const centerY = pivotPoint(result, correction.jointIndices).y;
      const diff = lm.y - centerY;
      lm.y = clamp01(lm.y + diff * strength);
    } else {
      const centerY = pivotPoint(result, correction.jointIndices).y;
      const diff = lm.y - centerY;
      lm.y = clamp01(lm.y - diff * strength);
    }
  }

  return result;
}

function applyPositionCorrection(
  landmarks: Landmark[],
  correction: CorrectionResult,
  factor: number,
): Landmark[] {
  const result = landmarks.map((l) => ({ ...l }));
  const jointSet = new Set(correction.jointIndices);
  const shift = factor * 0.03;

  for (const lm of result) {
    if (!jointSet.has(lm.id)) continue;
    if (correction.direction === "increase") {
      lm.y = clamp01(lm.y - shift);
    } else {
      lm.y = clamp01(lm.y + shift);
    }
  }

  return result;
}

function applySpeedCorrection(
  landmarks: Landmark[],
  correction: CorrectionResult,
  factor: number,
  frameProgress: number,
): Landmark[] {
  const result = landmarks.map((l) => ({ ...l }));
  const jointSet = new Set(correction.jointIndices);

  const timingShift = factor * 0.06 * Math.sin(frameProgress * Math.PI);

  for (const lm of result) {
    if (!jointSet.has(lm.id)) continue;
    if (correction.direction === "increase") {
      lm.x = clamp01(lm.x + timingShift * 0.5);
    } else {
      lm.x = clamp01(lm.x - timingShift * 0.5);
    }
  }

  return result;
}

export function generateCorrectedFrames(
  playerFrames: SkeletonFrame[],
  correction: CorrectionResult,
): SkeletonFrame[] {
  const factor = computeCorrectionFactor(correction);
  const totalFrames = playerFrames.length;

  return playerFrames.map((frame, index) => {
    const progress = totalFrames > 1 ? index / (totalFrames - 1) : 0;

    const easedFactor = factor * (0.5 + 0.5 * Math.sin(progress * Math.PI));

    let correctedLandmarks: Landmark[];

    switch (correction.correctionType) {
      case "rotation":
        correctedLandmarks = applyRotationCorrection(frame.landmarks, correction, easedFactor);
        break;
      case "angle":
        correctedLandmarks = applyAngleCorrection(frame.landmarks, correction, easedFactor);
        break;
      case "position":
        correctedLandmarks = applyPositionCorrection(frame.landmarks, correction, easedFactor);
        break;
      case "speed":
        correctedLandmarks = applySpeedCorrection(frame.landmarks, correction, easedFactor, progress);
        break;
      default:
        correctedLandmarks = frame.landmarks.map((l) => ({ ...l }));
    }

    return {
      frame_number: frame.frame_number,
      timestamp: frame.timestamp,
      landmarks: correctedLandmarks,
    };
  });
}
