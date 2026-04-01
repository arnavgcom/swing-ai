import { appSettings } from "@swing-ai/shared/schema";
import { eq } from "drizzle-orm";
import { buildInsertAuditFields, buildUpdateAuditFields } from "../lib/audit";
import { db } from "../config/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MlSettings = {
  /** Whether the LSTM model is used alongside RF for inference (ensemble). */
  lstmEnabled: boolean;
  /** Weight given to LSTM predictions (0‒1). RF weight = 1 − lstmEnsembleWeight. */
  lstmEnsembleWeight: number;
  /** Whether LSTM training is triggered alongside RF when a training job runs. */
  lstmTrainingEnabled: boolean;
  /** Minimum rows with temporal sequences required before LSTM training starts. */
  lstmMinTrainingRows: number;
  /** Max training epochs for LSTM. */
  lstmTrainingEpochs: number;
  /** Batch size for LSTM training. */
  lstmTrainingBatchSize: number;
  /** Learning rate for LSTM training. */
  lstmLearningRate: number;
  /** Model confidence threshold for using model prediction over heuristic. */
  modelConfidenceThreshold: number;
  /** Model margin threshold for using model prediction over heuristic. */
  modelMarginThreshold: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const ML_SETTINGS_KEY = "mlSettings";

const DEFAULT_ML_SETTINGS: MlSettings = {
  lstmEnabled: true,
  lstmEnsembleWeight: 0.6,
  lstmTrainingEnabled: true,
  lstmMinTrainingRows: 20,
  lstmTrainingEpochs: 150,
  lstmTrainingBatchSize: 32,
  lstmLearningRate: 0.001,
  modelConfidenceThreshold: 0.58,
  modelMarginThreshold: 0.06,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function parseRawSettings(raw: Record<string, unknown>): MlSettings {
  return {
    lstmEnabled: typeof raw.lstmEnabled === "boolean" ? raw.lstmEnabled : DEFAULT_ML_SETTINGS.lstmEnabled,
    lstmEnsembleWeight: coerceNumber(raw.lstmEnsembleWeight, DEFAULT_ML_SETTINGS.lstmEnsembleWeight, 0, 1),
    lstmTrainingEnabled: typeof raw.lstmTrainingEnabled === "boolean" ? raw.lstmTrainingEnabled : DEFAULT_ML_SETTINGS.lstmTrainingEnabled,
    lstmMinTrainingRows: coerceNumber(raw.lstmMinTrainingRows, DEFAULT_ML_SETTINGS.lstmMinTrainingRows, 5, 10000),
    lstmTrainingEpochs: coerceNumber(raw.lstmTrainingEpochs, DEFAULT_ML_SETTINGS.lstmTrainingEpochs, 5, 500),
    lstmTrainingBatchSize: coerceNumber(raw.lstmTrainingBatchSize, DEFAULT_ML_SETTINGS.lstmTrainingBatchSize, 4, 256),
    lstmLearningRate: coerceNumber(raw.lstmLearningRate, DEFAULT_ML_SETTINGS.lstmLearningRate, 0.00001, 0.1),
    modelConfidenceThreshold: coerceNumber(raw.modelConfidenceThreshold, DEFAULT_ML_SETTINGS.modelConfidenceThreshold, 0.1, 1),
    modelMarginThreshold: coerceNumber(raw.modelMarginThreshold, DEFAULT_ML_SETTINGS.modelMarginThreshold, 0, 0.5),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getMlSettings(actorUserId?: string | null): Promise<MlSettings> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, ML_SETTINGS_KEY))
    .limit(1);

  const rawValue = setting?.value && typeof setting.value === "object"
    ? setting.value as Record<string, unknown>
    : null;

  if (rawValue) {
    return parseRawSettings(rawValue);
  }

  // Seed default on first read
  await db
    .insert(appSettings)
    .values({
      key: ML_SETTINGS_KEY,
      value: DEFAULT_ML_SETTINGS as unknown as Record<string, unknown>,
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoNothing();

  return { ...DEFAULT_ML_SETTINGS };
}

export async function setMlSettings(
  settings: Partial<MlSettings>,
  actorUserId?: string | null,
): Promise<MlSettings> {
  const current = await getMlSettings(actorUserId);
  const merged = parseRawSettings({ ...current, ...settings });

  await db
    .insert(appSettings)
    .values({
      key: ML_SETTINGS_KEY,
      value: merged as unknown as Record<string, unknown>,
      ...buildInsertAuditFields(actorUserId || null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: merged as unknown as Record<string, unknown>,
        ...buildUpdateAuditFields(actorUserId || null),
      },
    });

  return merged;
}

/**
 * Returns env vars that Python processes need for ML inference settings.
 * Merge into the spawn env: `{ ...process.env, ...mlEnv }`.
 */
export async function getMlSettingsPythonEnv(actorUserId?: string | null): Promise<NodeJS.ProcessEnv> {
  const s = await getMlSettings(actorUserId);
  return {
    SWING_AI_LSTM_ENABLED: s.lstmEnabled ? "1" : "0",
    SWING_AI_LSTM_ENSEMBLE_WEIGHT: String(s.lstmEnsembleWeight),
    SWING_AI_MODEL_CONFIDENCE_THRESHOLD: String(s.modelConfidenceThreshold),
    SWING_AI_MODEL_MARGIN_THRESHOLD: String(s.modelMarginThreshold),
  };
}

export { DEFAULT_ML_SETTINGS };
