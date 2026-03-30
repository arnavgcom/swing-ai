import { appSettings } from "@swing-ai/shared/schema";
import { eq } from "drizzle-orm";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import { db } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type R2Settings = {
  r2Endpoint: string;
  r2Region: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2PlayerVideoFolder: string;
  r2PlayerAvatarFolder: string;
  r2PlayerModelFolder: string;
  modelArtifactStorageMode: "filesystem" | "r2";
};

// ---------------------------------------------------------------------------
// Defaults (derived from env vars for seeding)
// ---------------------------------------------------------------------------

const R2_SETTINGS_KEY = "r2Settings";

function getDefaultsFromEnv(): R2Settings {
  return {
    r2Endpoint: String(process.env.R2_ENDPOINT || "").trim(),
    r2Region: String(process.env.R2_REGION || "auto").trim() || "auto",
    r2Bucket: String(process.env.R2_BUCKET || "").trim(),
    r2AccessKeyId: String(process.env.R2_ACCESS_KEY_ID || "").trim(),
    r2SecretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY || "").trim(),
    r2PlayerVideoFolder: String(process.env.R2_PLAYER_VIDEO_FOLDER || "video").trim(),
    r2PlayerAvatarFolder: String(process.env.R2_PLAYER_AVATAR_FOLDER || "avatar").trim(),
    r2PlayerModelFolder: String(process.env.R2_PLAYER_MODEL_FOLDER || "model").trim(),
    modelArtifactStorageMode:
      (process.env.MODEL_ARTIFACT_STORAGE_MODE || "").trim().toLowerCase() === "r2"
        ? "r2"
        : "filesystem",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRawSettings(raw: Record<string, unknown>): R2Settings {
  const defaults = getDefaultsFromEnv();
  return {
    r2Endpoint: typeof raw.r2Endpoint === "string" && raw.r2Endpoint ? raw.r2Endpoint : defaults.r2Endpoint,
    r2Region: typeof raw.r2Region === "string" && raw.r2Region ? raw.r2Region : defaults.r2Region,
    r2Bucket: typeof raw.r2Bucket === "string" && raw.r2Bucket ? raw.r2Bucket : defaults.r2Bucket,
    r2AccessKeyId: typeof raw.r2AccessKeyId === "string" && raw.r2AccessKeyId ? raw.r2AccessKeyId : defaults.r2AccessKeyId,
    r2SecretAccessKey: typeof raw.r2SecretAccessKey === "string" && raw.r2SecretAccessKey ? raw.r2SecretAccessKey : defaults.r2SecretAccessKey,
    r2PlayerVideoFolder: typeof raw.r2PlayerVideoFolder === "string" && raw.r2PlayerVideoFolder ? raw.r2PlayerVideoFolder : defaults.r2PlayerVideoFolder,
    r2PlayerAvatarFolder: typeof raw.r2PlayerAvatarFolder === "string" && raw.r2PlayerAvatarFolder ? raw.r2PlayerAvatarFolder : defaults.r2PlayerAvatarFolder,
    r2PlayerModelFolder: typeof raw.r2PlayerModelFolder === "string" && raw.r2PlayerModelFolder ? raw.r2PlayerModelFolder : defaults.r2PlayerModelFolder,
    modelArtifactStorageMode: raw.modelArtifactStorageMode === "r2" ? "r2" : raw.modelArtifactStorageMode === "filesystem" ? "filesystem" : defaults.modelArtifactStorageMode,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getR2Settings(actorUserId?: string | null): Promise<R2Settings> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, R2_SETTINGS_KEY))
    .limit(1);

  if (setting) {
    return parseRawSettings(setting.value as Record<string, unknown>);
  }

  // Seed from env vars on first access
  const defaults = getDefaultsFromEnv();
  try {
    await db.insert(appSettings).values({
      key: R2_SETTINGS_KEY,
      value: defaults as unknown as Record<string, unknown>,
      ...buildInsertAuditFields(actorUserId ?? null),
    });
  } catch {
    // Concurrent seed — re-read
    const [retry] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, R2_SETTINGS_KEY))
      .limit(1);
    if (retry) return parseRawSettings(retry.value as Record<string, unknown>);
  }
  return defaults;
}

export async function setR2Settings(
  patch: Partial<R2Settings>,
  actorUserId: string | null,
): Promise<R2Settings> {
  const current = await getR2Settings(actorUserId);
  const merged: R2Settings = { ...current, ...patch };

  await db
    .insert(appSettings)
    .values({
      key: R2_SETTINGS_KEY,
      value: merged as unknown as Record<string, unknown>,
      ...buildInsertAuditFields(actorUserId),
    })
    .onConflictDoUpdate({
      target: [appSettings.key],
      set: {
        value: merged as unknown as Record<string, unknown>,
        ...buildUpdateAuditFields(actorUserId),
      },
    });

  // Invalidate cached R2 clients since credentials may have changed
  invalidateR2ClientCaches();

  // Update in-memory cache
  _cachedSettings = merged;

  return merged;
}

// ---------------------------------------------------------------------------
// Sync cached accessor (for use by media-storage / model-artifact-storage)
// ---------------------------------------------------------------------------

let _cachedSettings: R2Settings | null = null;

/**
 * Must be called once at server startup to populate the in-memory cache.
 * After this, `getCachedR2Settings()` returns the values synchronously.
 */
export async function initR2Settings(): Promise<R2Settings> {
  _cachedSettings = await getR2Settings();
  return _cachedSettings;
}

/**
 * Synchronous accessor for R2 config. Returns cached DB values if
 * `initR2Settings()` has been called, otherwise falls back to env vars.
 */
export function getCachedR2Settings(): R2Settings {
  if (_cachedSettings) return _cachedSettings;
  return getDefaultsFromEnv();
}

// ---------------------------------------------------------------------------
// Client cache invalidation callback (set by consumers)
// ---------------------------------------------------------------------------

let _invalidateCallbacks: Array<() => void> = [];

export function onR2SettingsInvalidate(cb: () => void): void {
  _invalidateCallbacks.push(cb);
}

function invalidateR2ClientCaches(): void {
  for (const cb of _invalidateCallbacks) {
    try { cb(); } catch { /* ignore */ }
  }
}

/**
 * Mask a secret for display - shows first 4 and last 4 chars.
 */
export function maskSecret(value: string): string {
  if (!value || value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}
