export type TennisStrokeType = "forehand" | "backhand" | "serve" | "volley";

export interface ImprovedScoreDetail {
  key: string;
  label: string;
  score: number; // 1-10
  explanation: string;
}

export interface ImprovedTennisReport {
  stroke: TennisStrokeType;
  biomechanics: ImprovedScoreDetail[];
  movement: ImprovedScoreDetail[];
  strengths: string[];
  improvementAreas: string[];
  coachingTips: string[];
  overallScore: number; // 0-100
}

export interface ImprovedMetricInput {
  stanceAngle?: number;
  hipRotationSpeed?: number;
  shoulderRotationSpeed?: number;
  kneeBendAngle?: number;
  racketLagAngle?: number;
  contactDistance?: number;
  contactHeight?: number;
  swingPathAngle?: number;
  balanceScore?: number;
  splitStepTime?: number;
  reactionTime?: number;
  recoveryTime?: number;
  ballSpeed?: number;
}
