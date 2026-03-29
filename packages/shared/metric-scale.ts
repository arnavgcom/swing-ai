const TEN_POINT_METRIC_KEYS = new Set([
  "balanceScore",
  "rhythmConsistency",
  "shotConsistency",
]);

function round1(value: number): number {
  return Number(value.toFixed(1));
}

export function usesTenPointScale(metricKey: string): boolean {
  return TEN_POINT_METRIC_KEYS.has(String(metricKey || ""));
}

export function normalizeMetricUnit(metricKey: string, unit: string): string {
  if (!usesTenPointScale(metricKey)) return unit;
  return "/10";
}

export function normalizeMetricValueToTenScale(metricKey: string, value: number): number {
  if (!Number.isFinite(value)) return value;
  if (!usesTenPointScale(metricKey)) return round1(value);

  const scaled = value > 10 ? value / 10 : value;
  return round1(Math.max(0, Math.min(10, scaled)));
}

export function normalizeMetricRangeToTenScale(
  metricKey: string,
  range?: [number, number],
): [number, number] | undefined {
  if (!range || range.length !== 2) return range;

  return [
    normalizeMetricValueToTenScale(metricKey, Number(range[0])),
    normalizeMetricValueToTenScale(metricKey, Number(range[1])),
  ];
}