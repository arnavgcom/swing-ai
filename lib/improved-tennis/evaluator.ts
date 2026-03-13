import type { AnalysisDetail, AnalysisDiagnosticsResponse } from "@/lib/api";
import type {
  ImprovedMetricInput,
  ImprovedScoreDetail,
  ImprovedTennisReport,
  TennisStrokeType,
} from "@/lib/improved-tennis/types";

function toNum(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function norm(value: number | undefined, min: number, max: number): number {
  if (value == null || max <= min) return 0.55;
  return clamp((value - min) / (max - min), 0, 1);
}

function invNorm(value: number | undefined, min: number, max: number): number {
  if (value == null || max <= min) return 0.55;
  return 1 - norm(value, min, max);
}

function score10(raw: number): number {
  return Math.round(clamp(raw, 1, 10));
}

function scoreFromUnit(unitScore: number): number {
  return score10(1 + unitScore * 9);
}

function labelFromScore(score: number): string {
  if (score >= 8) return "strong";
  if (score >= 6) return "solid";
  return "needs work";
}

function pickMetric(metricValues: Record<string, number> | undefined, keys: string[]): number | undefined {
  if (!metricValues) return undefined;
  for (const key of keys) {
    const value = toNum(metricValues[key]);
    if (value != null) return value;
  }
  return undefined;
}

function detectStroke(
  detail: AnalysisDetail | null | undefined,
  diagnostics: AnalysisDiagnosticsResponse | null | undefined,
): TennisStrokeType {
  const detected = String(detail?.analysis?.detectedMovement || "").toLowerCase().trim();
  if (detected === "forehand" || detected === "backhand" || detected === "serve" || detected === "volley") {
    return detected;
  }

  const counts = diagnostics?.movementTypeCounts || {};
  const candidates: TennisStrokeType[] = ["forehand", "backhand", "serve", "volley"];
  let winner: TennisStrokeType = "forehand";
  let maxCount = -1;
  for (const c of candidates) {
    const count = Number(counts[c] || 0);
    if (count > maxCount) {
      maxCount = count;
      winner = c;
    }
  }
  return winner;
}

function buildInput(
  detail: AnalysisDetail | null | undefined,
  diagnostics: AnalysisDiagnosticsResponse | null | undefined,
): ImprovedMetricInput {
  const mv = detail?.metrics?.metricValues;
  return {
    stanceAngle: pickMetric(mv, ["stanceAngle", "stance_angle"]),
    hipRotationSpeed: pickMetric(mv, ["hipRotationSpeed", "hip_rotation_speed", "hipRotation"]),
    shoulderRotationSpeed: pickMetric(mv, ["shoulderRotationSpeed", "shoulder_rotation_speed", "shoulderRotation"]),
    kneeBendAngle: pickMetric(mv, ["kneeBendAngle", "knee_bend_angle"]),
    racketLagAngle: pickMetric(mv, ["racketLagAngle", "racket_lag_angle"]),
    contactDistance: pickMetric(mv, ["contactDistance", "contact_distance"]),
    contactHeight: pickMetric(mv, ["contactHeight", "contact_height"]),
    swingPathAngle: pickMetric(mv, ["swingPathAngle", "swing_path_angle", "trajectoryArc"]),
    balanceScore: pickMetric(mv, ["balanceScore", "balance_score"]),
    splitStepTime: pickMetric(mv, ["splitStepTime", "splitStepTiming", "split_step_time"]),
    reactionTime: pickMetric(mv, ["reactionTime", "reactionSpeed", "reaction_time"]),
    recoveryTime: pickMetric(mv, ["recoveryTime", "recoverySpeed", "recovery_time"]),
    ballSpeed: pickMetric(mv, ["ballSpeed", "avgBallSpeed", "ball_speed"]),
  };
}

function buildBiomech(input: ImprovedMetricInput, stroke: TennisStrokeType): ImprovedScoreDetail[] {
  const balance = scoreFromUnit(
    0.8 * norm(input.balanceScore, 55, 98) + 0.2 * invNorm(input.reactionTime, 180, 480),
  );

  const inertia = scoreFromUnit(
    0.6 * norm(input.stanceAngle, 15, 65) + 0.4 * norm(input.shoulderRotationSpeed, 300, 1100),
  );

  const momentum = scoreFromUnit(
    0.45 * norm(input.hipRotationSpeed, 250, 1100)
      + 0.35 * norm(input.shoulderRotationSpeed, 300, 1200)
      + 0.2 * norm(input.ballSpeed, 35, 140),
  );

  const oppositeForce = scoreFromUnit(
    0.4 * norm(input.kneeBendAngle, 25, 120)
      + 0.35 * norm(input.balanceScore, 55, 98)
      + 0.25 * norm(input.stanceAngle, 15, 65),
  );

  const elastic = scoreFromUnit(
    0.7 * norm(input.racketLagAngle, 15, 75) + 0.3 * norm(input.swingPathAngle, 5, 45),
  );

  const contact = scoreFromUnit(
    0.45 * norm(input.contactDistance, 0.35, 1.15)
      + 0.35 * norm(input.contactHeight, 0.75, 2.9)
      + 0.2 * invNorm(input.reactionTime, 180, 480),
  );

  const follow = scoreFromUnit(
    0.6 * norm(input.swingPathAngle, 8, 55) + 0.4 * norm(input.shoulderRotationSpeed, 300, 1200),
  );

  const contactContext =
    stroke === "serve"
      ? "Contact height supports serve geometry."
      : stroke === "volley"
        ? "Contact in front keeps volleys compact."
        : "Contact distance from the body supports cleaner strike mechanics.";

  return [
    {
      key: "balance",
      label: "Balance",
      score: balance,
      explanation:
        balance >= 8
          ? "Stable base before, through, and after contact with minimal sway."
          : balance >= 6
            ? "Base is mostly stable; occasional drift appears under speed."
            : "Base stability drops through contact; posture control should improve.",
    },
    {
      key: "inertia",
      label: "Inertia / Stance Alignment",
      score: inertia,
      explanation:
        inertia >= 8
          ? "Stance and trunk alignment match shot direction well."
          : inertia >= 6
            ? "Stance shape is usable but alignment timing is occasionally late."
            : "Stance alignment is inconsistent and limits clean energy direction.",
    },
    {
      key: "oppositeForce",
      label: "Opposite Force",
      score: oppositeForce,
      explanation:
        oppositeForce >= 8
          ? "Bracing and ground-force transfer are strong, supporting stable acceleration."
          : oppositeForce >= 6
            ? "Force transfer is usable but can improve with stronger bracing and leg drive."
            : "Insufficient bracing and push-off reduce stable power transfer.",
    },
    {
      key: "momentum",
      label: "Momentum (Kinetic Chain)",
      score: momentum,
      explanation:
        momentum >= 8
          ? "Good legs-to-racket sequencing transfers energy efficiently."
          : momentum >= 6
            ? "Partial kinetic chain use; more lower-body drive would help."
            : "Energy transfer is arm-dominant and misses lower-body contribution.",
    },
    {
      key: "elastic",
      label: "Elastic Energy",
      score: elastic,
      explanation:
        elastic >= 8
          ? "Racket lag and stretch-shortening are creating strong acceleration."
          : elastic >= 6
            ? "Elastic load is present but could be timed and released better."
            : "Limited lag/load reduces free racket-head speed.",
    },
    {
      key: "contact",
      label: "Contact",
      score: contact,
      explanation: `${contactContext} ${labelFromScore(contact) === "strong" ? "Contact timing looks repeatable." : "Timing and spacing can be cleaner."}`,
    },
    {
      key: "follow",
      label: "Follow Through",
      score: follow,
      explanation:
        follow >= 8
          ? "Finish path is complete and supports control plus spin/drive intent."
          : follow >= 6
            ? "Follow-through is mostly complete with minor deceleration."
            : "Finish path cuts off early and limits control/consistency.",
    },
  ];
}

function buildMovement(input: ImprovedMetricInput, stroke: TennisStrokeType): ImprovedScoreDetail[] {
  const ready = scoreFromUnit(
    0.6 * invNorm(input.splitStepTime, 0.12, 0.45) + 0.4 * norm(input.balanceScore, 55, 98),
  );

  const read = scoreFromUnit(
    0.55 * invNorm(input.reactionTime, 180, 480) + 0.45 * invNorm(input.splitStepTime, 0.12, 0.45),
  );

  const react = scoreFromUnit(
    0.7 * invNorm(input.reactionTime, 170, 500) + 0.3 * norm(input.balanceScore, 55, 98),
  );

  const respond = scoreFromUnit(
    0.45 * norm(input.ballSpeed, 35, 140)
      + 0.3 * norm(input.contactHeight, 0.75, 2.9)
      + 0.25 * norm(input.swingPathAngle, 8, 55),
  );

  const recover = scoreFromUnit(
    0.65 * invNorm(input.recoveryTime, 0.6, 3.2) + 0.35 * norm(input.balanceScore, 55, 98),
  );

  const respondTextByStroke: Record<TennisStrokeType, string> = {
    forehand: "Forehand response is driven by leg load, push-off timing, and clean foot positioning.",
    backhand: "Backhand response depends on base width, outside-leg drive, and balanced transfer through contact.",
    serve: "Serve response reflects knee-drive timing, vertical push, and stable landing footwork.",
    volley: "Volley response relies on quick split-step, short adjustment steps, and body control through contact.",
  };

  return [
    {
      key: "ready",
      label: "Ready",
      score: ready,
      explanation:
        ready >= 8
          ? "Split-step timing, knee flex, and base setup prepare efficient lower-body movement."
          : ready >= 6
            ? "Lower-body prep is usable, but earlier split-step and stronger base loading are needed."
            : "Late split-step and shallow leg load reduce first-move quickness.",
    },
    {
      key: "read",
      label: "Read",
      score: read,
      explanation:
        read >= 8
          ? "Early read supports efficient footwork choices and balanced body positioning."
          : read >= 6
            ? "Read timing is acceptable, but feet can organize earlier into a stronger base."
            : "Late read forces rushed footwork and unstable lower-body positioning.",
    },
    {
      key: "react",
      label: "React",
      score: react,
      explanation:
        react >= 8
          ? "First step is explosive with clean lower-body direction control."
          : react >= 6
            ? "Initial push-off is functional but needs sharper leg drive under pressure."
            : "Slow or misdirected first step limits movement efficiency.",
    },
    {
      key: "respond",
      label: "Respond",
      score: respond,
      explanation: `${respondTextByStroke[stroke]} ${respond >= 7 ? "Execution is mostly clean." : "Execution quality is inconsistent."}`,
    },
    {
      key: "recover",
      label: "Recover",
      score: recover,
      explanation:
        recover >= 8
          ? "Recovery steps are quick and balanced, restoring a strong lower-body base."
          : recover >= 6
            ? "Recovery is serviceable but needs faster feet to re-center and reload."
            : "Slow recovery footwork delays re-centering and next-shot readiness.",
    },
  ];
}

function rankStrengthsAndGaps(items: ImprovedScoreDetail[]): { strengths: string[]; gaps: string[] } {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3).map((item) => `${item.label} is a strength (${item.score}/10).`);
  const gaps = sorted.slice(-3).map((item) => `${item.label} needs improvement (${item.score}/10).`);
  return { strengths, gaps };
}

function buildTips(stroke: TennisStrokeType, movement: ImprovedScoreDetail[], biomech: ImprovedScoreDetail[]): string[] {
  const weakMove = [...movement].sort((a, b) => a.score - b.score)[0];
  const weakBiomech = [...biomech].sort((a, b) => a.score - b.score)[0];

  const strokeTips: Record<TennisStrokeType, string[]> = {
    forehand: [
      "Load on the outside leg earlier, then rotate hips before the arm accelerates.",
      "Keep contact slightly in front with a consistent arm extension window.",
      "Use shadow reps to feel racket lag before release through contact.",
    ],
    backhand: [
      "Initiate with shoulder turn and keep chest closed longer through setup.",
      "Drive weight transfer through contact instead of arming the ball.",
      "Stabilize contact height with disciplined spacing and early preparation.",
    ],
    serve: [
      "Increase knee load depth, then push up before full shoulder acceleration.",
      "Emphasize racket drop-to-contact sequencing for smoother power release.",
      "Keep toss and contact height repeatable to improve directional control.",
    ],
    volley: [
      "Time the split step just before opponent contact for earlier first move.",
      "Shorten the backswing and keep racket head in front of the body.",
      "Recover with small adjustment steps immediately after contact.",
    ],
  };

  return [
    `${weakMove.label}: prioritize this phase with focused, short-interval drills.`,
    `${weakBiomech.label}: reinforce this mechanic in slow-to-fast progression reps.`,
    ...strokeTips[stroke],
  ];
}

export function buildImprovedTennisReport(
  detail: AnalysisDetail | null | undefined,
  diagnostics: AnalysisDiagnosticsResponse | null | undefined,
): ImprovedTennisReport {
  const stroke = detectStroke(detail, diagnostics);
  const input = buildInput(detail, diagnostics);
  const biomechanics = buildBiomech(input, stroke);
  const movement = buildMovement(input, stroke);

  const bioAvg = biomechanics.reduce((sum, item) => sum + item.score, 0) / Math.max(biomechanics.length, 1);
  const movAvg = movement.reduce((sum, item) => sum + item.score, 0) / Math.max(movement.length, 1);
  const overallScore = Math.round(clamp((bioAvg * 0.6 + movAvg * 0.4) * 10, 0, 100));

  const bioSummary = rankStrengthsAndGaps(biomechanics);
  const moveSummary = rankStrengthsAndGaps(movement);

  const strengths = [...bioSummary.strengths.slice(0, 2), ...moveSummary.strengths.slice(0, 1)];
  const improvementAreas = [...moveSummary.gaps.slice(0, 2), ...bioSummary.gaps.slice(0, 1)];
  const coachingTips = buildTips(stroke, movement, biomechanics);

  return {
    stroke,
    biomechanics,
    movement,
    strengths,
    improvementAreas,
    coachingTips,
    overallScore,
  };
}
