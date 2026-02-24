import { db } from "./db";
import { analyses, metrics, coachingInsights } from "@shared/schema";
import { eq } from "drizzle-orm";

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function normalize(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 100) / 100;
}

function generateMetrics() {
  const wristSpeed = randomInRange(18, 42);
  const elbowAngle = randomInRange(90, 165);
  const shoulderRotationVelocity = randomInRange(400, 900);
  const balanceStabilityScore = randomInRange(55, 95);
  const shotConsistencyScore = randomInRange(50, 95);
  const ballSpeed = randomInRange(45, 120);
  const ballTrajectoryArc = randomInRange(8, 25);
  const spinEstimation = randomInRange(600, 3200);
  const backswingDuration = randomInRange(0.3, 0.8);
  const contactTiming = randomInRange(0.02, 0.12);
  const followThroughDuration = randomInRange(0.4, 1.0);
  const rhythmConsistency = randomInRange(60, 95);
  const contactHeight = randomInRange(0.7, 1.2);

  const normalizedRacketSpeed = normalize(wristSpeed, 18, 42);
  const normalizedRotation = normalize(shoulderRotationVelocity, 400, 900);
  const contactConsistency = normalize(shotConsistencyScore, 50, 95);
  const followThroughQuality = normalize(followThroughDuration, 0.4, 1.0);
  const balanceNorm = normalize(balanceStabilityScore, 55, 95);

  const forehandPerformanceScore = Math.round(
    (0.3 * normalizedRacketSpeed +
      0.2 * normalizedRotation +
      0.2 * contactConsistency +
      0.15 * balanceNorm +
      0.15 * followThroughQuality) *
      100,
  );

  const powerScore = Math.round(
    (normalize(ballSpeed, 45, 120) * 0.5 +
      normalizedRacketSpeed * 0.3 +
      normalize(spinEstimation, 600, 3200) * 0.2) *
      100,
  );
  const stabilityScore = Math.round(
    (balanceNorm * 0.5 +
      normalize(rhythmConsistency, 60, 95) * 0.3 +
      contactConsistency * 0.2) *
      100,
  );
  const timingScore = Math.round(
    (normalize(0.12 - contactTiming, 0, 0.1) * 0.4 +
      normalize(backswingDuration, 0.3, 0.8) * 0.3 +
      normalize(rhythmConsistency, 60, 95) * 0.3) *
      100,
  );
  const followThroughScore = Math.round(
    (followThroughQuality * 0.5 +
      normalizedRotation * 0.3 +
      normalize(contactHeight, 0.7, 1.2) * 0.2) *
      100,
  );

  return {
    wristSpeed,
    elbowAngle,
    shoulderRotationVelocity,
    balanceStabilityScore,
    forehandPerformanceScore,
    shotConsistencyScore,
    ballSpeed,
    ballTrajectoryArc,
    spinEstimation,
    backswingDuration,
    contactTiming,
    followThroughDuration,
    rhythmConsistency,
    contactHeight,
    powerScore,
    stabilityScore,
    timingScore,
    followThroughScore,
    normalizedRacketSpeed,
    normalizedRotation,
    contactConsistency,
    followThroughQuality,
  };
}

function generateCoachingInsights(m: ReturnType<typeof generateMetrics>) {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const suggestions: string[] = [];

  if (m.normalizedRacketSpeed > 0.7) {
    strengths.push(
      "Your racket acceleration is excellent, generating strong power through the hitting zone.",
    );
  } else if (m.normalizedRacketSpeed > 0.4) {
    strengths.push(
      "Your racket speed is solid and provides a good foundation for power generation.",
    );
  } else {
    improvements.push(
      "Your racket speed could be improved. Focus on generating more acceleration through the contact zone.",
    );
    suggestions.push(
      "Practice shadow swings focusing on explosive acceleration from the slot position to contact point.",
    );
  }

  if (m.normalizedRotation > 0.65) {
    strengths.push(
      "Your shoulder rotation is strong, contributing excellent rotational power to your forehand.",
    );
  } else {
    improvements.push(
      "Your shoulder rotation is below optimal. This limits the kinetic chain transfer from your body to the racket.",
    );
    suggestions.push(
      "Try rotating your shoulder earlier during swing preparation. Practice the unit turn drill to improve trunk rotation.",
    );
  }

  if (m.contactConsistency > 0.6) {
    strengths.push(
      "Your contact point consistency is reliable, showing good hand-eye coordination.",
    );
  } else {
    improvements.push(
      "Your contact point varies between shots, reducing power transfer and shot predictability.",
    );
    suggestions.push(
      "Use a ball machine at moderate speed and focus on making contact at the same point relative to your front foot each time.",
    );
  }

  if (m.balanceStabilityScore < 70) {
    improvements.push(
      "Your balance during the stroke is unstable. This affects consistency and recovery for the next shot.",
    );
    suggestions.push(
      "Work on wider stance drills and practice hitting while maintaining a low center of gravity throughout the swing.",
    );
  }

  if (m.followThroughQuality < 0.5) {
    improvements.push(
      "Your follow-through is shortened, which can reduce topspin and depth on your shots.",
    );
    suggestions.push(
      "Focus on finishing your swing over the opposite shoulder. Imagine wrapping a towel around your neck with the racket.",
    );
  }

  if (m.contactTiming > 0.08) {
    improvements.push(
      "Your contact timing window is wide, suggesting the ball is not being struck cleanly at the sweet spot.",
    );
    suggestions.push(
      "Practice the drop-and-hit drill: drop the ball from waist height and focus on timing a clean strike at the optimal contact point.",
    );
  }

  const keyStrength =
    strengths.length > 0
      ? strengths.join(" ")
      : "Your overall technique shows a solid foundation with room for targeted improvements.";

  const improvementArea =
    improvements.length > 0
      ? improvements.join(" ")
      : "Your metrics are well-balanced. Focus on maintaining consistency across all areas.";

  const trainingSuggestion =
    suggestions.length > 0
      ? suggestions.join(" ")
      : "Continue your current training regimen while focusing on match play to test your technique under pressure.";

  const simpleExplanation = `Your forehand scored ${m.forehandPerformanceScore}/100 overall. ${
    m.forehandPerformanceScore >= 75
      ? "This is an advanced level stroke with strong fundamentals."
      : m.forehandPerformanceScore >= 50
        ? "Your stroke shows intermediate technique with clear areas for growth."
        : "Your stroke is developing. Focus on the suggested drills to build a stronger foundation."
  } Power: ${m.powerScore}, Stability: ${m.stabilityScore}, Timing: ${m.timingScore}, Follow-through: ${m.followThroughScore}.`;

  return { keyStrength, improvementArea, trainingSuggestion, simpleExplanation };
}

export async function processAnalysis(analysisId: string): Promise<void> {
  try {
    await db
      .update(analyses)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));

    await new Promise((resolve) =>
      setTimeout(resolve, 2000 + Math.random() * 3000),
    );

    const metricsData = generateMetrics();

    await db.insert(metrics).values({
      analysisId,
      ...metricsData,
    });

    const insightsData = generateCoachingInsights(metricsData);

    await db.insert(coachingInsights).values({
      analysisId,
      ...insightsData,
    });

    await db
      .update(analyses)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));
  } catch (error) {
    console.error("Analysis processing error:", error);
    await db
      .update(analyses)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(analyses.id, analysisId));
  }
}
