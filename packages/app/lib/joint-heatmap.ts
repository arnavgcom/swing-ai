export type PlayerMetrics = Record<string, number>;
export type OptimalRanges = Record<string, [number, number]>;
// Maps joint ID → worst deviation score (0–1) across all metrics that affect it
export type JointDeviationMap = Map<number, number>;

/**
 * MediaPipe Pose landmark IDs affected by each biomechanics metric.
 * Supports both camelCase and snake_case keys as the server may return either.
 */
const METRIC_JOINT_IDS: Record<string, number[]> = {
  // ── camelCase ─────────────────────────────────────────────────────────────
  shoulderRotation:      [11, 12, 13, 14, 15, 16],
  shoulderRotationSpeed: [11, 12, 13, 14, 15, 16],
  hipRotation:           [23, 24, 11, 12],
  hipRotationSpeed:      [23, 24, 11, 12],
  kneeBendAngle:         [23, 24, 25, 26],
  elbowAngle:            [11, 12, 13, 14],
  wristSpeed:            [15, 16, 13, 14],
  contactHeight:         [15, 16],
  contactDistance:       [15, 16, 11, 12],
  balanceScore:          [23, 24, 25, 26, 27, 28],
  stanceAngle:           [23, 24, 25, 26, 27, 28],
  racketLagAngle:        [11, 12, 13, 14, 15, 16],
  swingPathAngle:        [13, 14, 15, 16],
  headStability:         [0, 7, 8],
  spineAngle:            [11, 12, 23, 24],
  splitStepTime:         [27, 28, 25, 26],
  backswingDuration:     [11, 12, 13, 14, 15, 16],
  followThroughDuration: [11, 12, 13, 14, 15, 16],
  // ── snake_case aliases ────────────────────────────────────────────────────
  shoulder_rotation:     [11, 12, 13, 14, 15, 16],
  hip_rotation:          [23, 24, 11, 12],
  knee_bend:             [23, 24, 25, 26],
  knee_bend_angle:       [23, 24, 25, 26],
  elbow_angle:           [11, 12, 13, 14],
  wrist_speed:           [15, 16, 13, 14],
  balance_score:         [23, 24, 25, 26, 27, 28],
  stance_angle:          [23, 24, 25, 26, 27, 28],
  head_stability:        [0, 7, 8],
  spine_angle:           [11, 12, 23, 24],
};

/**
 * Values deviating more than this many degrees from the optimal range boundary
 * are normalised to score 1.0.
 */
const MAX_DEVIATION = 40;

/**
 * For each metric present in both playerMetrics and optimalRanges, compute a
 * normalised deviation score in [0, 1]:
 *   0 = perfectly within range
 *   1 = at or beyond MAX_DEVIATION from the nearest boundary
 */
export function calculateDeviationScores(
  playerMetrics: PlayerMetrics,
  optimalRanges: OptimalRanges,
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(playerMetrics)) {
    const range = optimalRanges[key];
    if (!range) continue;
    const [lo, hi] = range;
    let deviation = 0;
    if (value < lo) deviation = lo - value;
    else if (value > hi) deviation = value - hi;
    scores[key] = Math.min(deviation / MAX_DEVIATION, 1);
  }
  return scores;
}

/**
 * Combine per-metric deviation scores into a per-joint map.
 * Each joint keeps the highest (worst) score from across all metrics that
 * reference it.
 */
export function buildJointDeviationMap(
  deviationScores: Record<string, number>,
): JointDeviationMap {
  const map: JointDeviationMap = new Map();
  for (const [metricKey, score] of Object.entries(deviationScores)) {
    const jointIds = METRIC_JOINT_IDS[metricKey];
    if (!jointIds) continue;
    for (const id of jointIds) {
      const current = map.get(id) ?? 0;
      if (score > current) map.set(id, score);
    }
  }
  return map;
}

/** Return a hex color corresponding to a normalised deviation score. */
export function getHeatmapColor(score: number): "#34D399" | "#FBBF24" | "#F87171" {
  if (score <= 0.2) return "#34D399"; // green  – within range
  if (score <= 0.5) return "#FBBF24"; // yellow – small deviation
  return "#F87171";                   // red    – large deviation
}
