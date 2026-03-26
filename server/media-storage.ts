import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { db } from "./db";
import { buildInsertAuditFields, buildUpdateAuditFields } from "./audit-metadata";
import { resolveProjectPath } from "./env";
import { sql } from "drizzle-orm";

export type VideoStorageMode = "filesystem" | "r2";
export type MediaKind = "video" | "avatar";

const VIDEO_STORAGE_MODE_KEY = "videoStorageMode";
const LEGACY_VIDEO_STORAGE_MODE_KEY = "VIDEO_STORAGE_MODE";
const uploadsRoot = resolveProjectPath("uploads");
const avatarUploadsDir = path.join(uploadsRoot, "avatars");

let cachedR2Client: S3Client | null = null;

function isVideoStorageMode(value: unknown): value is VideoStorageMode {
  return value === "filesystem" || value === "r2";
}

function getDefaultVideoStorageMode(): VideoStorageMode {
  const envValue = String(
    process.env.videoStorageMode || process.env.VIDEO_STORAGE_MODE || "",
  ).trim().toLowerCase();
  if (isVideoStorageMode(envValue)) {
    return envValue;
  }

  const isReplitProduction = Boolean(process.env.REPLIT_DOMAINS) && !Boolean(process.env.REPLIT_DEV_DOMAIN);
  return isReplitProduction ? "r2" : "filesystem";
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function toPosixPath(value: string): string {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeKeyPrefix(value: string, fallback: string): string {
  const raw = String(value || fallback).trim().replace(/^\/+|\/+$/g, "");
  return raw || fallback;
}

function getR2Bucket(): string {
  const bucket = String(process.env.R2_BUCKET || "").trim();
  if (!bucket) {
    throw new Error("R2_BUCKET is required when videoStorageMode is r2");
  }
  return bucket;
}

function getR2Client(): S3Client {
  if (cachedR2Client) {
    return cachedR2Client;
  }

  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const region = String(process.env.R2_REGION || "auto").trim() || "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are incomplete. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  cachedR2Client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedR2Client;
}

function getR2Prefix(kind: MediaKind): string {
  return kind === "avatar"
    ? normalizeKeyPrefix(process.env.R2_PLAYER_AVATAR_FOLDER || process.env.R2_PLAYER_AVATAR || "avatar", "avatar")
    : normalizeKeyPrefix(process.env.R2_PLAYER_VIDEO_FOLDER || process.env.R2_PLAYER_VIDEO || "video", "video");
}

function isRelativeStorageKey(value: string): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (path.isAbsolute(raw)) return false;
  if (raw.startsWith("/")) return false;
  if (/^[a-z]+:\/\//i.test(raw)) return false;
  return true;
}

function buildR2Key(kind: MediaKind, filename: string): string {
  return `${getR2Prefix(kind)}/${String(filename || "").replace(/^\/+/, "")}`;
}

function toR2Reference(key: string): string {
  return `r2://${String(key || "").replace(/^\/+/, "")}`;
}

function parseR2Reference(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw.toLowerCase().startsWith("r2://")) {
    return null;
  }
  const key = raw.slice(5).replace(/^\/+/, "");
  return key || null;
}

function getFilesystemPublicPath(storedPath: string): string | null {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;

  if (isRelativeStorageKey(raw)) {
    return `/uploads/${toPosixPath(raw.replace(/^\/+/, ""))}`;
  }

  if (raw.startsWith("/uploads/")) {
    return raw;
  }

  if (!path.isAbsolute(raw)) {
    return null;
  }

  const relative = path.relative(uploadsRoot, raw);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return `/uploads/${toPosixPath(relative)}`;
}

function getFilesystemLocalPath(storedPath: string): string | null {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;

  if (isRelativeStorageKey(raw)) {
    return path.join(uploadsRoot, raw.replace(/^\/+/, ""));
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    const relative = raw.replace(/^\/uploads\/?/, "");
    return path.join(uploadsRoot, relative);
  }

  return null;
}

function getNormalizedVideoStorageKey(storedPath: string | null | undefined): string | null {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;

  if (isRelativeStorageKey(raw)) {
    return raw.replace(/^\/+/, "");
  }

  const r2Key = parseR2Reference(raw);
  if (r2Key) {
    const videoPrefix = `${getR2Prefix("video")}/`;
    if (r2Key.startsWith(videoPrefix)) {
      return r2Key.slice(videoPrefix.length).replace(/^\/+/, "") || null;
    }
    return null;
  }

  const filesystemPublicPath = getFilesystemPublicPath(raw);
  if (filesystemPublicPath?.startsWith("/uploads/")) {
    return filesystemPublicPath.replace(/^\/uploads\/?/, "").replace(/^\/+/, "") || null;
  }

  const filesystemLocalPath = getFilesystemLocalPath(raw);
  if (filesystemLocalPath) {
    const relative = path.relative(uploadsRoot, filesystemLocalPath);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return toPosixPath(relative).replace(/^\/+/, "") || null;
    }
  }

  return null;
}

function getCurrentVideoR2Key(storedPath: string, treatRelativeKeyAsR2 = false): string | null {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;

  const legacyKey = parseR2Reference(raw);
  if (legacyKey) {
    return legacyKey;
  }

  if (!treatRelativeKeyAsR2) {
    return null;
  }

  const normalizedKey = getNormalizedVideoStorageKey(raw);
  if (!normalizedKey) {
    return null;
  }

  return buildR2Key("video", normalizedKey);
}

async function downloadR2ObjectToFile(key: string, targetPath: string): Promise<void> {
  ensureDirectory(path.dirname(targetPath));

  const client = getR2Client();
  const response = await client.send(new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
  }));

  if (!response.Body) {
    throw new Error(`R2 object not found: ${key}`);
  }

  const writeStream = fs.createWriteStream(targetPath);
  await pipeline(response.Body as NodeJS.ReadableStream, writeStream);
}

async function migrateLegacyVideoStorageModeSetting(): Promise<void> {
  await db.execute(sql`
    insert into app_settings (
      key,
      value,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    select
      ${VIDEO_STORAGE_MODE_KEY},
      legacy.value,
      legacy.created_at,
      legacy.updated_at,
      legacy.created_by_user_id,
      legacy.updated_by_user_id
    from app_settings as legacy
    where legacy.key = ${LEGACY_VIDEO_STORAGE_MODE_KEY}
      and not exists (
        select 1
        from app_settings as current_setting
        where current_setting.key = ${VIDEO_STORAGE_MODE_KEY}
      )
    on conflict (key) do nothing
  `);

  await db.delete(appSettings).where(eq(appSettings.key, LEGACY_VIDEO_STORAGE_MODE_KEY));
}

export async function ensureVideoStorageModeSetting(): Promise<VideoStorageMode> {
  await migrateLegacyVideoStorageModeSetting();

  const defaultMode = getDefaultVideoStorageMode();
  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, VIDEO_STORAGE_MODE_KEY))
    .limit(1);

  const storedMode = existing?.value && typeof existing.value === "object"
    ? String((existing.value as Record<string, unknown>).mode || "").trim().toLowerCase()
    : "";

  if (isVideoStorageMode(storedMode)) {
    return storedMode;
  }

  await db
    .insert(appSettings)
    .values({
      key: VIDEO_STORAGE_MODE_KEY,
      value: { mode: defaultMode },
      ...buildInsertAuditFields(null),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { mode: defaultMode },
        ...buildUpdateAuditFields(null),
      },
    });

  return defaultMode;
}

export async function getVideoStorageMode(): Promise<VideoStorageMode> {
  await migrateLegacyVideoStorageModeSetting();

  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, VIDEO_STORAGE_MODE_KEY))
    .limit(1);

  const storedMode = existing?.value && typeof existing.value === "object"
    ? String((existing.value as Record<string, unknown>).mode || "").trim().toLowerCase()
    : "";

  if (isVideoStorageMode(storedMode)) {
    return storedMode;
  }

  return ensureVideoStorageModeSetting();
}

export async function setVideoStorageMode(mode: VideoStorageMode, actorUserId?: string | null): Promise<void> {
  await migrateLegacyVideoStorageModeSetting();

  await db
    .insert(appSettings)
    .values({
      key: VIDEO_STORAGE_MODE_KEY,
      value: { mode },
      ...buildInsertAuditFields(actorUserId),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { mode },
        ...buildUpdateAuditFields(actorUserId),
      },
    });
}

export function buildFilesystemVideoPath(filename: string): string {
  ensureDirectory(uploadsRoot);
  return path.join(uploadsRoot, filename);
}

export function buildFilesystemAvatarPath(filename: string): string {
  ensureDirectory(avatarUploadsDir);
  return path.join(avatarUploadsDir, filename);
}

export async function storeAvatarBuffer(params: {
  buffer: Buffer;
  contentType: string;
  originalName?: string;
}): Promise<string> {
  const mode = await getVideoStorageMode();
  const extension = path.extname(String(params.originalName || "")).trim() || ".jpg";
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

  if (mode === "filesystem") {
    const targetPath = buildFilesystemAvatarPath(filename);
    fs.writeFileSync(targetPath, params.buffer);
    return `/uploads/avatars/${filename}`;
  }

  const key = buildR2Key("avatar", filename);
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: params.buffer,
    ContentType: params.contentType || "application/octet-stream",
  }));
  return toR2Reference(key);
}

export async function storeVideoBuffer(params: {
  buffer: Buffer;
  contentType: string;
  filename: string;
}): Promise<string> {
  const mode = await getVideoStorageMode();
  if (mode === "filesystem") {
    const targetPath = buildFilesystemVideoPath(params.filename);
    fs.writeFileSync(targetPath, params.buffer);
    return params.filename;
  }

  const key = buildR2Key("video", params.filename);
  await getR2Client().send(new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: params.buffer,
    ContentType: params.contentType || "application/octet-stream",
  }));
  return params.filename;
}

export async function resolveMediaUrl(storedPath: string | null | undefined): Promise<string | null> {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;

  if (isHttpUrl(raw)) {
    return raw;
  }

  const storageMode = await getVideoStorageMode();
  const r2Key = getCurrentVideoR2Key(raw, storageMode === "r2");
  if (r2Key) {
    return getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: r2Key,
      }),
      { expiresIn: 60 * 60 },
    );
  }

  return getFilesystemPublicPath(raw) || raw;
}

export async function withLocalMediaFile<T>(
  storedPath: string,
  fallbackFilename: string | null | undefined,
  fn: (localPath: string) => Promise<T>,
): Promise<T> {
  const raw = String(storedPath || "").trim();
  if (!raw) {
    throw new Error("Media path is empty");
  }

  const storageMode = await getVideoStorageMode();
  const r2Key = getCurrentVideoR2Key(raw, storageMode === "r2");
  if (!r2Key) {
    const localPath = getFilesystemLocalPath(raw);
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error("Media file not found");
    }
    return fn(localPath);
  }

  const extension = path.extname(String(fallbackFilename || r2Key || "")).trim() || ".bin";
  const tempPath = path.join(os.tmpdir(), `swingai-${randomUUID()}${extension}`);

  await downloadR2ObjectToFile(r2Key, tempPath);
  try {
    return await fn(tempPath);
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // noop
    }
  }
}

export async function copyStoredMediaToPath(
  storedPath: string,
  fallbackFilename: string | null | undefined,
  targetPath: string,
): Promise<void> {
  await withLocalMediaFile(storedPath, fallbackFilename, async (localPath) => {
    ensureDirectory(path.dirname(targetPath));
    fs.copyFileSync(localPath, targetPath);
  });
}

export async function deleteStoredMedia(storedPath: string | null | undefined): Promise<void> {
  const raw = String(storedPath || "").trim();
  if (!raw) return;

  const storageMode = await getVideoStorageMode();
  const r2Key = getCurrentVideoR2Key(raw, storageMode === "r2");
  if (r2Key) {
    await getR2Client().send(new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: r2Key,
    }));
    return;
  }

  if (isHttpUrl(raw)) {
    return;
  }

  const localPath = getFilesystemLocalPath(raw);
  if (localPath && fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
}

export function isStoredMediaLocallyAccessible(storedPath: string | null | undefined): boolean {
  const localPath = getFilesystemLocalPath(String(storedPath || ""));
  return Boolean(localPath && fs.existsSync(localPath));
}

export function normalizeStoredVideoPath(storedPath: string | null | undefined): string | null {
  return getNormalizedVideoStorageKey(storedPath);
}

export function getStoredMediaLocalPath(storedPath: string | null | undefined): string | null {
  return getFilesystemLocalPath(String(storedPath || ""));
}
