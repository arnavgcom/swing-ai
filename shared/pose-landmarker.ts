export const POSE_LANDMARKER_MODELS = ["lite", "full", "heavy"] as const;

export type PoseLandmarkerModel = (typeof POSE_LANDMARKER_MODELS)[number];

export function isPoseLandmarkerModel(value: unknown): value is PoseLandmarkerModel {
  return value === "lite" || value === "full" || value === "heavy";
}
