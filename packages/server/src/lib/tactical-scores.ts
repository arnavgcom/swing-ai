const STANDARD_KEYS = ["power", "control", "timing", "technique"] as const;

type StandardKey = (typeof STANDARD_KEYS)[number];

function canonicalKey(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function valueToTenScale(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n == null) return null;
  if (n <= 10) return Number(Math.max(0, Math.min(10, n)).toFixed(2));
  return Number(Math.max(0, Math.min(10, n / 10)).toFixed(2));
}

function tenToApi100(value: unknown): number | null {
  const ten = valueToTenScale(value);
  if (ten == null) return null;
  return Number((ten * 10).toFixed(2));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readScoreOutputSection(node: unknown): Record<string, unknown> {
  const section = asRecord(node);
  const components = asRecord(section.components);
  return Object.keys(components).length ? components : section;
}

function extractFromScoreOutputs(scoreOutputs: Record<string, unknown> | null | undefined): Record<StandardKey, number | null> {
  const outputs = asRecord(scoreOutputs);
  const tacticalSection = readScoreOutputSection(outputs.tactical);
  const tacticalComponents = tacticalSection;

  const out: Record<StandardKey, number | null> = {
    power: null,
    control: null,
    timing: null,
    technique: null,
  };

  for (const key of STANDARD_KEYS) {
    const value = valueToTenScale(tacticalComponents[key]);
    out[key] = value;
  }

  return out;
}

export function extractStandardizedTacticalScores10(
  values: Record<string, unknown> | null | undefined,
): Record<StandardKey, number | null> {
  const byCanonical = new Map<string, number>();
  for (const [k, v] of Object.entries(values || {})) {
    const n = toNumberOrNull(v);
    if (n == null) continue;
    byCanonical.set(canonicalKey(k), n);
  }

  const out: Record<StandardKey, number | null> = {
    power: null,
    control: null,
    timing: null,
    technique: null,
  };

  for (const key of STANDARD_KEYS) {
    const hit = byCanonical.get(canonicalKey(key));
    if (hit == null) continue;
    out[key] = valueToTenScale(hit);
  }

  return out;
}

export function normalizeTacticalScoresToApi100(
  values: Record<string, unknown> | null | undefined,
): Record<StandardKey, number | null> {
  const source = extractFromScoreOutputs(values);
  const out: Record<StandardKey, number | null> = {
    power: null,
    control: null,
    timing: null,
    technique: null,
  };

  for (const key of STANDARD_KEYS) {
    const value = tenToApi100(source[key]);
    out[key] = value;
  }

  return out;
}

export function readTacticalScoreValue(
  values: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const source = extractFromScoreOutputs(values);
  const target = canonicalKey(key);
  for (const [k, v] of Object.entries(source || {})) {
    if (canonicalKey(k) !== target) continue;
    return toNumberOrNull(Number(v) * 10);
  }
  return null;
}
