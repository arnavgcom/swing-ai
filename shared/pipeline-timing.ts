export const PIPELINE_STAGE_DEFINITIONS = [
  {
    key: "upload",
    label: "Upload",
    description: "Video received over HTTP and stored",
  },
  {
    key: "firstPosePass",
    label: "First pose pass",
    description: "Initial full-video pose detection for classification",
  },
  {
    key: "classificationValidation",
    label: "Classification + validation",
    description: "Background analysis, validation, segmentation, and scoring window selection",
  },
  {
    key: "secondPosePass",
    label: "Second pose pass",
    description: "Analyzer pass for metrics, scores, and coaching",
  },
  {
    key: "diagnostics",
    label: "Diagnostics",
    description: "Diagnostics subprocess and skeleton dataset build",
  },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGE_DEFINITIONS)[number]["key"];
export type PipelineStageStatus = "pending" | "running" | "completed" | "failed";

export interface PipelineTimingStage {
  key: PipelineStageKey;
  label: string;
  description?: string | null;
  status: PipelineStageStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  elapsedMs?: number | null;
  note?: string | null;
}

export interface PipelineTiming {
  stages: PipelineTimingStage[];
  currentStageKey?: PipelineStageKey | null;
  totalElapsedMs?: number | null;
  updatedAt?: string | null;
}

type PipelineTimingLike = {
  stages?: unknown;
  currentStageKey?: unknown;
  totalElapsedMs?: unknown;
  updatedAt?: unknown;
};

type PipelineStageUpdate = {
  stageKey: PipelineStageKey;
  status: PipelineStageStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  elapsedMs?: number | null;
  note?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isPipelineStageKey(value: unknown): value is PipelineStageKey {
  return PIPELINE_STAGE_DEFINITIONS.some((stage) => stage.key === value);
}

function createDefaultStage(definition: (typeof PIPELINE_STAGE_DEFINITIONS)[number]): PipelineTimingStage {
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    status: "pending",
    startedAt: null,
    completedAt: null,
    elapsedMs: null,
    note: null,
  };
}

function computeElapsedMs(stage: PipelineTimingStage, nowMs: number): number | null {
  if (typeof stage.elapsedMs === "number" && Number.isFinite(stage.elapsedMs) && stage.elapsedMs >= 0) {
    return stage.elapsedMs;
  }

  const startedMs = stage.startedAt ? Date.parse(stage.startedAt) : NaN;
  if (!Number.isFinite(startedMs)) return null;

  if (stage.completedAt) {
    const completedMs = Date.parse(stage.completedAt);
    if (Number.isFinite(completedMs)) {
      return Math.max(completedMs - startedMs, 0);
    }
  }

  if (stage.status === "running") {
    return Math.max(nowMs - startedMs, 0);
  }

  return null;
}

export function createEmptyPipelineTiming(nowIso?: string): PipelineTiming {
  return {
    stages: PIPELINE_STAGE_DEFINITIONS.map(createDefaultStage),
    currentStageKey: null,
    totalElapsedMs: 0,
    updatedAt: nowIso || null,
  };
}

export function extractPipelineTiming(value: unknown): PipelineTiming | null {
  const raw = isRecord(value) && isRecord(value.pipelineTiming)
    ? (value.pipelineTiming as PipelineTimingLike)
    : (isRecord(value) ? (value as PipelineTimingLike) : null);

  if (!raw || !Array.isArray(raw.stages)) {
    return null;
  }

  const stageMap = new Map<PipelineStageKey, PipelineTimingStage>();

  for (const entry of raw.stages) {
    if (!isRecord(entry) || !isPipelineStageKey(entry.key)) continue;
    const definition = PIPELINE_STAGE_DEFINITIONS.find((stage) => stage.key === entry.key);
    if (!definition) continue;
    const status = entry.status;
    stageMap.set(entry.key, {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      status:
        status === "running" || status === "completed" || status === "failed"
          ? status
          : "pending",
      startedAt: toNullableString(entry.startedAt),
      completedAt: toNullableString(entry.completedAt),
      elapsedMs: toNullableNumber(entry.elapsedMs),
      note: toNullableString(entry.note),
    });
  }

  const stages = PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    return stageMap.get(definition.key) || createDefaultStage(definition);
  });

  const currentStageKey = isPipelineStageKey(raw.currentStageKey) ? raw.currentStageKey : null;
  const totalElapsedMs = toNullableNumber(raw.totalElapsedMs);
  const updatedAt = toNullableString(raw.updatedAt);

  return {
    stages,
    currentStageKey,
    totalElapsedMs,
    updatedAt,
  };
}

export function getPipelineTotalElapsedMs(timing: PipelineTiming | null | undefined, nowMs: number = Date.now()): number | null {
  if (!timing) return null;

  const values = timing.stages
    .map((stage) => computeElapsedMs(stage, nowMs))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0);
}

export function updatePipelineTiming(
  current: PipelineTiming | null | undefined,
  update: PipelineStageUpdate,
  nowIso?: string,
): PipelineTiming {
  const next = extractPipelineTiming(current) || createEmptyPipelineTiming(nowIso);
  const effectiveNowIso = nowIso || new Date().toISOString();

  next.stages = next.stages.map((stage) => {
    if (stage.key !== update.stageKey) return stage;

    const startedAt = update.startedAt !== undefined
      ? update.startedAt
      : (update.status === "running" && !stage.startedAt ? effectiveNowIso : stage.startedAt || null);

    const completedAt = update.completedAt !== undefined
      ? update.completedAt
      : (update.status === "completed" || update.status === "failed" ? effectiveNowIso : stage.completedAt || null);

    let elapsedMs = update.elapsedMs !== undefined ? update.elapsedMs : stage.elapsedMs ?? null;
    if ((elapsedMs == null || !Number.isFinite(elapsedMs)) && startedAt && completedAt) {
      const startedMs = Date.parse(startedAt);
      const completedMs = Date.parse(completedAt);
      if (Number.isFinite(startedMs) && Number.isFinite(completedMs)) {
        elapsedMs = Math.max(completedMs - startedMs, 0);
      }
    }

    return {
      ...stage,
      status: update.status,
      startedAt,
      completedAt,
      elapsedMs,
      note: update.note !== undefined ? update.note : stage.note || null,
    };
  });

  const runningStage = next.stages.find((stage) => stage.status === "running");
  next.currentStageKey = runningStage?.key || null;
  next.updatedAt = effectiveNowIso;
  next.totalElapsedMs = getPipelineTotalElapsedMs(next, Date.parse(effectiveNowIso));

  return next;
}

export function attachPipelineTiming<T extends Record<string, unknown>>(
  payload: T,
  timing: PipelineTiming | null | undefined,
): T & { pipelineTiming?: PipelineTiming } {
  if (!timing) return payload;
  return {
    ...payload,
    pipelineTiming: timing,
  };
}

export function formatDurationMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "-";

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}