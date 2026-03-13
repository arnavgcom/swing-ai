export type MetricDefinition = {
  key: string;
  label: string;
  unit: string;
  icon: string;
  category: string;
  color: string;
  description: string;
  optimalRange?: [number, number];
};

const CANONICAL_25_METRICS: MetricDefinition[] = [
  { key: "backswingDuration", label: "Backswing Duration", unit: "s", icon: "time-outline", category: "technique", color: "#60A5FA", description: "Time spent in backswing phase." },
  { key: "balanceScore", label: "Balance Score", unit: "/100", icon: "body-outline", category: "biomechanics", color: "#FBBF24", description: "Stability through setup and strike." },
  { key: "ballSpeed", label: "Ball Speed", unit: "mph", icon: "speedometer-outline", category: "power", color: "#34D399", description: "Average outgoing ball speed." },
  { key: "contactDistance", label: "Contact Distance", unit: "ratio", icon: "resize-outline", category: "technique", color: "#60A5FA", description: "Contact spacing relative to shoulder width." },
  { key: "contactHeight", label: "Contact Height", unit: "m", icon: "resize-outline", category: "technique", color: "#A78BFA", description: "Average contact point height." },
  { key: "contactTiming", label: "Contact Timing", unit: "ms", icon: "pulse-outline", category: "timing", color: "#F87171", description: "Timing quality at contact." },
  { key: "elbowAngle", label: "Elbow Angle", unit: "deg", icon: "git-branch-outline", category: "biomechanics", color: "#60A5FA", description: "Average elbow angle around strike." },
  { key: "followThroughDuration", label: "Follow Through Duration", unit: "s", icon: "trending-up-outline", category: "technique", color: "#34D399", description: "Time spent in follow-through." },
  { key: "hipRotationSpeed", label: "Hip Rotation Speed", unit: "deg/s", icon: "sync-outline", category: "biomechanics", color: "#60A5FA", description: "Hip angular speed during swing." },
  { key: "kneeBendAngle", label: "Knee Bend Angle", unit: "deg", icon: "walk-outline", category: "movement", color: "#FBBF24", description: "Lower-body loading knee angle." },
  { key: "racketLagAngle", label: "Racket Lag Angle", unit: "deg", icon: "flash-outline", category: "technique", color: "#FBBF24", description: "Lag angle proxy during acceleration." },
  { key: "reactionTime", label: "Reaction Time", unit: "ms", icon: "timer-outline", category: "timing", color: "#F87171", description: "Time-to-react metric from movement onset." },
  { key: "recoveryTime", label: "Recovery Time", unit: "s", icon: "refresh-outline", category: "movement", color: "#34D399", description: "Time to recover after stroke." },
  { key: "rhythmConsistency", label: "Rhythm Consistency", unit: "%", icon: "musical-notes-outline", category: "timing", color: "#A78BFA", description: "Temporal consistency across reps." },
  { key: "shoulderRotation", label: "Shoulder Rotation", unit: "deg", icon: "repeat-outline", category: "biomechanics", color: "#60A5FA", description: "Shoulder turn amount." },
  { key: "shoulderRotationSpeed", label: "Shoulder Rotation Speed", unit: "deg/s", icon: "repeat-outline", category: "biomechanics", color: "#60A5FA", description: "Shoulder angular speed." },
  { key: "shotConsistency", label: "Shot Consistency", unit: "%", icon: "stats-chart-outline", category: "technique", color: "#34D399", description: "Consistency across detected shots." },
  { key: "shotCount", label: "Shot Count", unit: "count", icon: "list-outline", category: "movement", color: "#A78BFA", description: "Number of detected shots." },
  { key: "shotSpeed", label: "Shot Speed", unit: "mph", icon: "speedometer-outline", category: "power", color: "#34D399", description: "Average shot speed metric." },
  { key: "spinRate", label: "Spin Rate", unit: "rpm", icon: "disc-outline", category: "technique", color: "#A78BFA", description: "Estimated spin generation." },
  { key: "splitStepTime", label: "Split Step Time", unit: "s", icon: "footsteps-outline", category: "movement", color: "#FBBF24", description: "Pre-contact split-step timing." },
  { key: "stanceAngle", label: "Stance Angle", unit: "deg", icon: "body-outline", category: "movement", color: "#60A5FA", description: "Foot stance orientation angle." },
  { key: "swingPathAngle", label: "Swing Path Angle", unit: "deg", icon: "analytics-outline", category: "technique", color: "#60A5FA", description: "Swing path direction angle." },
  { key: "trajectoryArc", label: "Trajectory Arc", unit: "deg", icon: "trending-up-outline", category: "technique", color: "#A78BFA", description: "Arc shape of shot trajectory." },
  { key: "wristSpeed", label: "Wrist Speed", unit: "m/s", icon: "flash-outline", category: "power", color: "#34D399", description: "Wrist speed during acceleration." },
];

const LEGACY_TO_CANONICAL: Record<string, string> = {
  avgballspeed: "ballSpeed",
  hiprotation: "hipRotationSpeed",
  reactionspeed: "reactionTime",
  recoverspeed: "recoveryTime",
  splitsteptiming: "splitStepTime",
};

const CANONICAL_BY_LOWER: Record<string, string> = CANONICAL_25_METRICS.reduce<Record<string, string>>((acc, metric) => {
  acc[metric.key.toLowerCase()] = metric.key;
  return acc;
}, {});

function metricSort(a: MetricDefinition, b: MetricDefinition): number {
  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

export function normalizeMetricSelectionKey(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const canonicalLower = LEGACY_TO_CANONICAL[lower] || lower;
  return CANONICAL_BY_LOWER[canonicalLower] || trimmed;
}

export function getCanonical25MetricOptions(): MetricDefinition[] {
  return [...CANONICAL_25_METRICS].sort(metricSort);
}

export function buildMetricOptionsWithCatalog(
  configMetrics: Array<Partial<MetricDefinition>> | undefined,
): MetricDefinition[] {
  const map = new Map<string, MetricDefinition>();

  for (const metric of CANONICAL_25_METRICS) {
    map.set(metric.key, metric);
  }

  for (const raw of configMetrics || []) {
    const key = normalizeMetricSelectionKey(String(raw.key || ""));
    if (!key) continue;

    const existing = map.get(key);
    const merged: MetricDefinition = {
      key,
      label: String(raw.label || existing?.label || key),
      unit: String(raw.unit || existing?.unit || ""),
      icon: String(raw.icon || existing?.icon || "analytics-outline"),
      category: String(raw.category || existing?.category || "technique"),
      color: String(raw.color || existing?.color || "#60A5FA"),
      description: String(raw.description || existing?.description || ""),
      optimalRange:
        Array.isArray(raw.optimalRange) && raw.optimalRange.length === 2
          ? [Number(raw.optimalRange[0]), Number(raw.optimalRange[1])]
          : existing?.optimalRange,
    };

    map.set(key, merged);
  }

  return Array.from(map.values()).sort(metricSort);
}
