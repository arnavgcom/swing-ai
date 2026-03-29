export const VIDEO_VALIDATION_MODES = ["disabled", "light", "medium", "full"] as const;

export type VideoValidationMode = (typeof VIDEO_VALIDATION_MODES)[number];

export type ValidationScreeningSnapshot = {
  uploadGuardMode: VideoValidationMode | null;
  uploadGuardApplied: boolean;
  uploadGuardSampleCount: number | null;
  pipelineValidationMode: VideoValidationMode | null;
  pipelineValidationApplied: boolean;
};

export function isVideoValidationMode(value: unknown): value is VideoValidationMode {
  return typeof value === "string" && (VIDEO_VALIDATION_MODES as readonly string[]).includes(value);
}