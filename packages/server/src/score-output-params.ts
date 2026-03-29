import type { ScoreOutputsPayload } from "@swing-ai/shared/schema";

type TennisStrokeType = "forehand" | "backhand" | "serve" | "volley";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNum(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function norm(value: number | undefined, min: number, max: number): number | null {
  if (value == null || max <= min) return null;
  return clamp((value - min) / (max - min), 0, 1);
}

function invNorm(value: number | undefined, min: number, max: number): number | null {
  const normalized = norm(value, min, max);
  if (normalized == null) return null;
  return 1 - normalized;
}

function score10(raw: number): number {
  return Math.round(clamp(raw, 1, 10));
}

function scoreFromUnit(unitScore: number | null): number | null {
  if (unitScore == null || !Number.isFinite(unitScore)) return null;
  return score10(1 + unitScore * 9);
}

function weightedUnit(entries: Array<{ value: number | null; weight: number }>): number | null {
  const valid = entries.filter(
    (entry): entry is { value: number; weight: number } => entry.value != null && Number.isFinite(entry.value),
  );
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return null;
  const weighted = valid.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
  return weighted / totalWeight;
}

function pickMetric(metricValues: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNum(metricValues?.[key]);
    if (value != null) return value;
  }
  return undefined;
}

function asStroke(detectedMovement: unknown): TennisStrokeType {
  const detected = String(detectedMovement || "").toLowerCase().trim();
  if (detected === "backhand" || detected === "serve" || detected === "volley") return detected;
  return "forehand";
}

function canonicalKey(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readTacticalScore(values: Record<string, unknown>, key: string): number | null {
  const target = canonicalKey(key);
  for (const [k, v] of Object.entries(values || {})) {
    if (canonicalKey(k) !== target) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return Number(Math.max(0, Math.min(10, n)).toFixed(2));
  }
  return null;
}

function average(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => Number.isFinite(value));
  if (!validValues.length) return null;
  return Number((validValues.reduce((sum, value) => sum + value, 0) / validValues.length).toFixed(1));
}

function computeTacticalScore(components: {
  power: number | null;
  control: number | null;
  timing: number | null;
  technique: number | null;
}): number | null {
  const weightedKeys: Array<{ key: string; weight: number }> = [
    { key: "power", weight: 0.3 },
    { key: "control", weight: 0.25 },
    { key: "timing", weight: 0.25 },
    { key: "technique", weight: 0.2 },
  ];

  const contributors = weightedKeys
    .map((item) => {
      const value = Number((components as Record<string, number | null>)[item.key]);
      if (!Number.isFinite(value)) return null;
      return { value, weight: item.weight };
    })
    .filter((item): item is { value: number; weight: number } => item !== null);

  if (!contributors.length) return null;

  const weightedSum = contributors.reduce((sum, item) => sum + item.value * item.weight, 0);
  const totalWeight = contributors.reduce((sum, item) => sum + item.weight, 0);
  return Number((weightedSum / Math.max(totalWeight, 1)).toFixed(1));
}

function computeTennisTechnicalAndMovement(
  detectedMovement: unknown,
  metricValues: Record<string, unknown>,
): {
  technicalOverall: number | null;
  movementOverall: number | null;
  technicalComponents: ScoreOutputsPayload["technical"]["components"];
  movementComponents: ScoreOutputsPayload["movement"]["components"];
} {
  const stroke = asStroke(detectedMovement);

  const stanceAngle = pickMetric(metricValues, ["stanceAngle", "stance_angle"]);
  const hipRotationSpeed = pickMetric(metricValues, ["hipRotationSpeed", "hip_rotation_speed", "hipRotation"]);
  const shoulderRotationSpeed = pickMetric(metricValues, [
    "shoulderRotationSpeed",
    "shoulder_rotation_speed",
    "shoulderRotation",
  ]);
  const kneeBendAngle = pickMetric(metricValues, ["kneeBendAngle", "knee_bend_angle"]);
  const racketLagAngle = pickMetric(metricValues, ["racketLagAngle", "racket_lag_angle"]);
  const contactDistance = pickMetric(metricValues, ["contactDistance", "contact_distance"]);
  const contactHeight = pickMetric(metricValues, ["contactHeight", "contact_height"]);
  const swingPathAngle = pickMetric(metricValues, ["swingPathAngle", "swing_path_angle", "trajectoryArc"]);
  const balanceScore = pickMetric(metricValues, ["balanceScore", "balance_score"]);
  const splitStepTime = pickMetric(metricValues, ["splitStepTime", "splitStepTiming", "split_step_time"]);
  const reactionTime = pickMetric(metricValues, ["reactionTime", "reactionSpeed", "reaction_time"]);
  const recoveryTime = pickMetric(metricValues, ["recoveryTime", "recoverySpeed", "recovery_time"]);
  const ballSpeed = pickMetric(metricValues, ["ballSpeed", "avgBallSpeed", "ball_speed"]);

  const balance = scoreFromUnit(
    weightedUnit([
      { value: norm(balanceScore, 55, 98), weight: 0.8 },
      { value: invNorm(reactionTime, 180, 480), weight: 0.2 },
    ]),
  );
  const inertia = scoreFromUnit(
    weightedUnit([
      { value: norm(stanceAngle, 15, 65), weight: 0.6 },
      { value: norm(shoulderRotationSpeed, 300, 1100), weight: 0.4 },
    ]),
  );
  const momentum = scoreFromUnit(
    weightedUnit([
      { value: norm(hipRotationSpeed, 250, 1100), weight: 0.45 },
      { value: norm(shoulderRotationSpeed, 300, 1200), weight: 0.35 },
      { value: norm(ballSpeed, 35, 140), weight: 0.2 },
    ]),
  );
  const oppositeForce = scoreFromUnit(
    weightedUnit([
      { value: norm(kneeBendAngle, 25, 120), weight: 0.4 },
      { value: norm(balanceScore, 55, 98), weight: 0.35 },
      { value: norm(stanceAngle, 15, 65), weight: 0.25 },
    ]),
  );
  const elastic = scoreFromUnit(
    weightedUnit([
      { value: norm(racketLagAngle, 15, 75), weight: 0.7 },
      { value: norm(swingPathAngle, 5, 45), weight: 0.3 },
    ]),
  );
  const contact = scoreFromUnit(
    weightedUnit([
      { value: norm(contactDistance, 0.35, 1.15), weight: 0.45 },
      { value: norm(contactHeight, 0.75, 2.9), weight: 0.35 },
      { value: invNorm(reactionTime, 180, 480), weight: 0.2 },
    ]),
  );

  const ready = scoreFromUnit(
    weightedUnit([
      { value: invNorm(splitStepTime, 0.12, 0.45), weight: 0.6 },
      { value: norm(balanceScore, 55, 98), weight: 0.4 },
    ]),
  );
  const read = scoreFromUnit(
    weightedUnit([
      { value: invNorm(reactionTime, 180, 480), weight: 0.55 },
      { value: invNorm(splitStepTime, 0.12, 0.45), weight: 0.45 },
    ]),
  );
  const react = scoreFromUnit(
    weightedUnit([
      { value: invNorm(reactionTime, 170, 500), weight: 0.7 },
      { value: norm(balanceScore, 55, 98), weight: 0.3 },
    ]),
  );

  const respondWeights: Record<TennisStrokeType, [number, number, number]> = {
    forehand: [0.45, 0.3, 0.25],
    backhand: [0.45, 0.3, 0.25],
    serve: [0.45, 0.3, 0.25],
    volley: [0.45, 0.3, 0.25],
  };
  const [wBall, wHeight, wPath] = respondWeights[stroke];
  const respond = scoreFromUnit(
    weightedUnit([
      { value: norm(ballSpeed, 35, 140), weight: wBall },
      { value: norm(contactHeight, 0.75, 2.9), weight: wHeight },
      { value: norm(swingPathAngle, 8, 55), weight: wPath },
    ]),
  );
  const recover = scoreFromUnit(
    weightedUnit([
      { value: invNorm(recoveryTime, 0.6, 3.2), weight: 0.65 },
      { value: norm(balanceScore, 55, 98), weight: 0.35 },
    ]),
  );

  const technical = average([balance, inertia, oppositeForce, momentum, elastic, contact]);
  const movement = average([ready, read, react, respond, recover]);

  return {
    technicalOverall: technical,
    movementOverall: movement,
    technicalComponents: {
      balance,
      inertia,
      oppositeForce,
      momentum,
      elastic,
      contact,
    },
    movementComponents: {
      ready,
      read,
      react,
      respond,
      recover,
    },
  };
}

export function buildScoreOutputsPayload(input: {
  configKey: string;
  detectedMovement?: string | null;
  tacticalComponents: Record<string, unknown>;
  metricValues: Record<string, unknown>;
  overallScore: number | null;
}): ScoreOutputsPayload {
  const tacticalComponents: ScoreOutputsPayload["tactical"]["components"] = {
    power: readTacticalScore(input.tacticalComponents || {}, "power"),
    control: readTacticalScore(input.tacticalComponents || {}, "control"),
    timing: readTacticalScore(input.tacticalComponents || {}, "timing"),
    technique: readTacticalScore(input.tacticalComponents || {}, "technique"),
  };
  const tactical = computeTacticalScore(tacticalComponents);

  let technicalOverall: number | null = null;
  let movementOverall: number | null = null;
  let technicalComponents: ScoreOutputsPayload["technical"]["components"] = {
    balance: null,
    inertia: null,
    oppositeForce: null,
    momentum: null,
    elastic: null,
    contact: null,
  };
  let movementComponents: ScoreOutputsPayload["movement"]["components"] = {
    ready: null,
    read: null,
    react: null,
    respond: null,
    recover: null,
  };

  if (String(input.configKey || "").toLowerCase().startsWith("tennis-")) {
    const computed = computeTennisTechnicalAndMovement(input.detectedMovement, input.metricValues || {});
    technicalOverall = computed.technicalOverall;
    movementOverall = computed.movementOverall;
    technicalComponents = computed.technicalComponents;
    movementComponents = computed.movementComponents;
  }

  return {
    technical: {
      overall: technicalOverall,
      components: technicalComponents,
    },
    tactical: {
      overall: tactical,
      components: tacticalComponents,
    },
    movement: {
      overall: movementOverall,
      components: movementComponents,
    },
    overall: input.overallScore,
    metadata: {
      configKey: input.configKey,
      generatedAt: new Date().toISOString(),
      scale: "0-10",
    },
  };
}
