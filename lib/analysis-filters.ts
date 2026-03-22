import type { AnalysisSummary } from "@/lib/api";

export const SESSION_TYPE_FILTER_OPTIONS = [
  { key: "practice", label: "Practise / Drill" },
  { key: "match-play", label: "Match Play" },
] as const;

export const STROKE_FILTER_OPTIONS = [
  { key: "forehand", label: "Forehand" },
  { key: "backhand", label: "Backhand" },
  { key: "serve", label: "Serve" },
  { key: "volley", label: "Volley" },
] as const;

export type SessionTypeFilter = (typeof SESSION_TYPE_FILTER_OPTIONS)[number]["key"];
export type StrokeTypeFilter = (typeof STROKE_FILTER_OPTIONS)[number]["key"];

export const DEFAULT_SESSION_TYPE_FILTERS: SessionTypeFilter[] = SESSION_TYPE_FILTER_OPTIONS.map(
  (option) => option.key,
);

type FilterableAnalysis = Pick<
  AnalysisSummary,
  | "configKey"
  | "sportName"
  | "movementName"
  | "detectedMovement"
  | "videoFilename"
  | "status"
  | "requestedSessionType"
  | "requestedFocusKey"
>;

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}

function normalizeConfigSegment(value: string | null | undefined): string {
  return normalizeText(value).replace(/[_\s]+/g, "-").replace(/-+/g, "-");
}

function normalizeMovementValue(value: string | null | undefined): string {
  const normalized = normalizeConfigSegment(value);
  if (!normalized || normalized === "auto-detect" || normalized === "autodetect") {
    return "";
  }
  return normalized;
}

function normalizeStrokeType(value: string | null | undefined): StrokeTypeFilter | null {
  const normalized = normalizeMovementValue(value);
  if (
    normalized === "forehand"
    || normalized === "backhand"
    || normalized === "serve"
    || normalized === "volley"
  ) {
    return normalized;
  }
  return null;
}

function normalizeSessionType(value: string | null | undefined): SessionTypeFilter | null {
  const normalized = normalizeText(value);
  if (normalized === "practice" || normalized === "match-play") {
    return normalized;
  }
  return null;
}

function isInFlightAnalysisStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "processing";
}

function movementFromConfigKey(configKey: string | null | undefined): string {
  const normalized = normalizeText(configKey);
  if (!normalized) return "";
  const parts = normalized.split("-").filter(Boolean);
  if (parts.length < 2) return "";
  return normalizeMovementValue(parts.slice(1).join("-"));
}

function movementFromVideoFilename(videoFilename: string | null | undefined): string {
  const filename = String(videoFilename || "");
  if (!filename) return "";
  const stem = filename.replace(/\.[^.]+$/, "");
  const parts = stem.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return "";
  return normalizeMovementValue(parts[2]);
}

export function resolveAnalysisMovement(item: FilterableAnalysis): string {
  return (
    normalizeMovementValue(item.detectedMovement)
    || normalizeMovementValue(item.movementName)
    || movementFromConfigKey(item.configKey)
    || normalizeMovementValue(item.requestedFocusKey)
    || movementFromVideoFilename(item.videoFilename)
  );
}

export function resolveAnalysisStroke(item: FilterableAnalysis): StrokeTypeFilter | null {
  return (
    normalizeStrokeType(item.detectedMovement)
    || normalizeStrokeType(item.movementName)
    || normalizeStrokeType(movementFromConfigKey(item.configKey))
    || normalizeStrokeType(item.requestedFocusKey)
    || normalizeStrokeType(movementFromVideoFilename(item.videoFilename))
  );
}

export function filterAnalysesBySport(
  analyses: AnalysisSummary[],
  sportName: string | undefined,
  movementName: string | undefined,
): AnalysisSummary[] {
  if (!sportName) return analyses;

  const sportLower = normalizeConfigSegment(sportName);
  const movementLower = normalizeMovementValue(movementName);

  return analyses.filter((analysis) => {
    const keyLower = normalizeText(analysis.configKey);
    const keyParts = keyLower.split("-").filter(Boolean);
    const keySport = keyParts[0] || "";
    const summarySport = normalizeConfigSegment(analysis.sportName);
    const summaryMovement = normalizeMovementValue(analysis.movementName);

    if (keySport) {
      if (keySport !== sportLower) return false;
    } else if (summarySport) {
      if (summarySport !== sportLower) return false;
    } else if (!isInFlightAnalysisStatus(analysis.status)) {
      return false;
    }

    if (movementLower) {
      const resolvedMovement = summaryMovement || resolveAnalysisMovement(analysis);
      if (keyLower) {
        if (!keyLower.includes(movementLower)) return false;
      } else if (resolvedMovement !== movementLower) {
        return false;
      }
    }

    return true;
  });
}

export function filterAnalysesBySessionAndStroke(
  analyses: AnalysisSummary[],
  selectedSessionTypes: readonly SessionTypeFilter[],
  selectedStroke: StrokeTypeFilter | null,
): AnalysisSummary[] {
  const selectedSessionSet = new Set(
    selectedSessionTypes
      .map((value) => normalizeSessionType(value))
      .filter((value): value is SessionTypeFilter => value !== null),
  );
  const applySessionFilter =
    selectedSessionSet.size > 0 && selectedSessionSet.size < DEFAULT_SESSION_TYPE_FILTERS.length;
  const normalizedStroke = normalizeStrokeType(selectedStroke);

  return analyses.filter((analysis) => {
    if (applySessionFilter) {
      const sessionType = normalizeSessionType(analysis.requestedSessionType);
      if (!sessionType || !selectedSessionSet.has(sessionType)) {
        return false;
      }
    }

    if (normalizedStroke) {
      return resolveAnalysisStroke(analysis) === normalizedStroke;
    }

    return true;
  });
}