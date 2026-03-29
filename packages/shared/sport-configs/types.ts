export interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  icon: string;
  category: "biomechanics" | "ball" | "timing" | "consistency" | "technique" | "power";
  color: string;
  description: string;
  optimalRange?: [number, number];
}

export interface ScoreDefinition {
  key: string;
  label: string;
  weight: number;
}

export interface SportCategoryConfig {
  sportName: string;
  movementName: string;
  configKey: string;
  overallScoreLabel: string;
  metrics: MetricDefinition[];
  scores: ScoreDefinition[];
}
