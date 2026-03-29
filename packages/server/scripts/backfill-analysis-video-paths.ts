import "../server/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "node:path";
import { analyses } from "../shared/schema";
import { resolveProjectPath } from "../server/env";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const uploadsRoot = resolveProjectPath("uploads");

function toPosixPath(value: string): string {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeKeyPrefix(value: string, fallback: string): string {
  const raw = String(value || fallback).trim().replace(/^\/+|\/+$/g, "");
  return raw || fallback;
}

function getVideoPrefix(): string {
  return normalizeKeyPrefix(process.env.R2_PLAYER_VIDEO_FOLDER || process.env.R2_PLAYER_VIDEO || "video", "video");
}

function isRelativeStorageKey(value: string): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (path.isAbsolute(raw)) return false;
  if (raw.startsWith("/")) return false;
  if (/^[a-z]+:\/\//i.test(raw)) return false;
  return true;
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

function parseR2Reference(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw.toLowerCase().startsWith("r2://")) {
    return null;
  }
  const key = raw.slice(5).replace(/^\/+/, "");
  return key || null;
}

function normalizeStoredVideoPath(storedPath: string | null | undefined): string | null {
  const raw = String(storedPath || "").trim();
  if (!raw) return null;
  if (isRelativeStorageKey(raw)) {
    return raw.replace(/^\/+/, "");
  }
  const r2Key = parseR2Reference(raw);
  if (r2Key) {
    const prefix = `${getVideoPrefix()}/`;
    if (r2Key.startsWith(prefix)) {
      return r2Key.slice(prefix.length).replace(/^\/+/, "") || null;
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

type CandidateRow = {
  id: string;
  videoFilename: string;
  videoPath: string;
};

function parseArgs(argv: string[]): { apply: boolean } {
  return {
    apply: argv.includes("--apply"),
  };
}

function formatRow(row: CandidateRow, normalizedPath: string): string {
  return `${row.id} :: ${row.videoPath} -> ${normalizedPath} (filename=${row.videoFilename})`;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rows = await db
      .select({
        id: analyses.id,
        videoFilename: analyses.videoFilename,
        videoPath: analyses.videoPath,
      })
      .from(analyses)
      .orderBy(analyses.createdAt);

    const updates: Array<{ row: CandidateRow; normalizedPath: string }> = [];
    const skipped: CandidateRow[] = [];

    for (const row of rows) {
      const normalizedPath = normalizeStoredVideoPath(row.videoPath);
      if (!normalizedPath) {
        skipped.push(row);
        continue;
      }
      if (normalizedPath === row.videoPath) {
        continue;
      }
      updates.push({ row, normalizedPath });
    }

    console.log(`analyses scanned=${rows.length}`);
    console.log(`normalizable_updates=${updates.length}`);
    console.log(`non_normalizable_rows=${skipped.length}`);

    for (const item of updates.slice(0, 20)) {
      console.log(`UPDATE ${formatRow(item.row, item.normalizedPath)}`);
    }

    for (const row of skipped.slice(0, 20)) {
      console.log(`SKIP ${row.id} :: ${row.videoPath}`);
    }

    if (!args.apply) {
      console.log("Dry run only. Re-run with --apply to update analyses.video_path.");
      return;
    }

    const updatedAt = new Date();
    for (const item of updates) {
      await db
        .update(analyses)
        .set({
          videoPath: item.normalizedPath,
          updatedAt,
        })
        .where(eq(analyses.id, item.row.id));
    }

    console.log(`Applied ${updates.length} analyses.video_path updates.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});