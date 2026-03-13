function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function toNumberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeRuntimeScoreToHundred(value: unknown): number | null {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  if (numeric <= 10) return clamp(numeric * 10, 0, 100);
  return clamp(numeric, 0, 100);
}

export function normalizeRuntimeSubScoresToHundred(
  subScores: Record<string, unknown> | null | undefined,
): Record<string, number> {
  if (!subScores || typeof subScores !== "object") return {};

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(subScores)) {
    const numeric = normalizeRuntimeScoreToHundred(value);
    if (numeric !== null) {
      normalized[key] = numeric;
    }
  }
  return normalized;
}

export function toPersistedScoreTen(value: unknown): number | null {
  const normalizedHundred = normalizeRuntimeScoreToHundred(value);
  if (normalizedHundred === null) return null;
  return round2(clamp(normalizedHundred / 10, 0, 10));
}

export function toPersistedSubScoresTen(
  subScores: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const normalizedHundred = normalizeRuntimeSubScoresToHundred(subScores);
  const persisted: Record<string, number> = {};
  for (const [key, value] of Object.entries(normalizedHundred)) {
    persisted[key] = round2(clamp(value / 10, 0, 10));
  }
  return persisted;
}

export function persistedScoreToApiHundred(value: unknown): number | null {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  if (numeric <= 10) return round2(clamp(numeric * 10, 0, 100));
  return round2(clamp(numeric, 0, 100));
}

export function persistedSubScoresToApiHundred(
  subScores: Record<string, unknown> | null | undefined,
): Record<string, number> {
  if (!subScores || typeof subScores !== "object") return {};

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(subScores)) {
    const numeric = persistedScoreToApiHundred(value);
    if (numeric !== null) {
      normalized[key] = numeric;
    }
  }
  return normalized;
}
