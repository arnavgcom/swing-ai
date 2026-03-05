import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { execFile } from "child_process";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage, type AnalysisMetadataInput } from "./storage";
import { processAnalysis } from "./analysis-engine";
import { requireAuth } from "./auth";
import { db } from "./db";
import {
  sports,
  sportMovements,
  users,
  analysisFeedback,
  analysisShotAnnotations,
  analysisShotDiscrepancies,
  analyses,
  metrics,
  coachingInsights,
} from "@shared/schema";
import { eq, asc, and, desc, sql } from "drizzle-orm";
import { getSportConfig, getAllConfigs } from "@shared/sport-configs";

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

function resolvePythonExecutable(): string {
  const envExecutable = process.env.PYTHON_EXECUTABLE;
  if (envExecutable && fs.existsSync(envExecutable)) {
    return envExecutable;
  }

  const localCandidates = [
    path.resolve(process.cwd(), ".venv", "bin", "python3"),
    path.resolve(process.cwd(), ".venv", "bin", "python"),
  ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python3";
}

function runPythonDiagnostics(
  videoPath: string,
  sportName: string,
  movementName: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();

    execFile(
      pythonExecutable,
      [
        "-m",
        "python_analysis.run_diagnostics",
        videoPath,
        "--sport",
        sportName.toLowerCase(),
        "--movement",
        movementName.toLowerCase().replace(/\s+/g, "-"),
      ],
      {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error(`Python diagnostics failed: ${error.message}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result?.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result);
        } catch {
          if (stderr) console.error("Python diagnostics stderr:", stderr);
          reject(new Error("Failed to parse diagnostics results"));
        }
      },
    );
  });
}

function parseNumberValue(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFpsValue(value: unknown): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.includes("/")) {
    const [numRaw, denRaw] = raw.split("/");
    const num = Number(numRaw);
    const den = Number(denRaw);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return Number((num / den).toFixed(3));
    }
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : null;
}

function getTagValue(tags: Record<string, unknown>, keys: string[]): unknown {
  const lowered = new Map<string, unknown>();
  for (const [k, v] of Object.entries(tags || {})) {
    lowered.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    const hit = lowered.get(key.toLowerCase());
    if (hit != null && String(hit).trim() !== "") return hit;
  }
  return null;
}

function parseSignedCoordinate(value: unknown, positiveSuffix: string, negativeSuffix: string): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  const directional = raw.match(/^(-?\d+(?:\.\d+)?)\s*([NSEW])$/i);
  if (!directional) return null;
  const magnitude = Number(directional[1]);
  if (!Number.isFinite(magnitude)) return null;
  const direction = directional[2].toUpperCase();
  if (direction === positiveSuffix) return Math.abs(magnitude);
  if (direction === negativeSuffix) return -Math.abs(magnitude);
  return null;
}

function parseIso6709Location(value: unknown): { lat: number; lng: number; alt: number | null } | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?\/?$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  const alt = match[3] != null ? Number(match[3]) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    alt: alt != null && Number.isFinite(alt) ? alt : null,
  };
}

async function extractVideoMetadata(videoPath: string): Promise<AnalysisMetadataInput> {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        videoPath,
      ],
      {
        timeout: 20000,
        maxBuffer: 5 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          resolve({});
          return;
        }

        try {
          const parsed = JSON.parse(stdout || "{}");
          const format = parsed?.format || {};
          const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
          const videoStream = streams.find((stream: any) => stream?.codec_type === "video") || streams[0] || {};

          const formatTags = (format?.tags || {}) as Record<string, unknown>;
          const streamTags = (videoStream?.tags || {}) as Record<string, unknown>;
          const mergedTags = {
            ...formatTags,
            ...streamTags,
          } as Record<string, unknown>;

          const capturedAt = parseDateValue(
            getTagValue(mergedTags, ["creation_time", "com.apple.quicktime.creationdate"]),
          );

          const sourceAppRaw = getTagValue(mergedTags, [
            "com.apple.quicktime.software",
            "software",
            "encoder",
          ]);

          const durationSec = parseNumberValue(format?.duration ?? videoStream?.duration);
          const fps = parseFpsValue(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate);
          const width = parseNumberValue(videoStream?.width);
          const height = parseNumberValue(videoStream?.height);
          const rotationFromTag = parseNumberValue(getTagValue(streamTags, ["rotate"]));
          const rotationFromSideData = parseNumberValue(
            Array.isArray(videoStream?.side_data_list)
              ? videoStream.side_data_list.find((entry: any) => entry?.rotation != null)?.rotation
              : null,
          );
          const rotation = rotationFromTag ?? rotationFromSideData;
          const bitrateKbpsRaw = parseNumberValue(format?.bit_rate ?? videoStream?.bit_rate);
          const bitrateKbps =
            bitrateKbpsRaw != null ? Number((bitrateKbpsRaw / 1000).toFixed(2)) : null;
          const fileSizeBytes = parseNumberValue(format?.size);
          const containerFormat = format?.format_name ? String(format.format_name) : null;
          const videoCodec = videoStream?.codec_name ? String(videoStream.codec_name) : null;

          let gpsLat: number | null = null;
          let gpsLng: number | null = null;
          let gpsAltM: number | null = null;
          let gpsSource: string | null = null;

          const isoLocation = getTagValue(mergedTags, [
            "com.apple.quicktime.location.ISO6709",
            "location",
          ]);
          const isoParsed = parseIso6709Location(isoLocation);
          if (isoParsed) {
            gpsLat = isoParsed.lat;
            gpsLng = isoParsed.lng;
            gpsAltM = isoParsed.alt;
            gpsSource = "iso6709";
          } else {
            const lat = parseSignedCoordinate(
              getTagValue(mergedTags, ["GPSLatitude", "latitude"]),
              "N",
              "S",
            );
            const lng = parseSignedCoordinate(
              getTagValue(mergedTags, ["GPSLongitude", "longitude"]),
              "E",
              "W",
            );
            if (lat != null && lng != null) {
              gpsLat = lat;
              gpsLng = lng;
              gpsAltM = parseNumberValue(getTagValue(mergedTags, ["GPSAltitude", "altitude"]));
              gpsSource = "exif";
            }
          }

          const gpsSpeedMps = parseNumberValue(
            getTagValue(mergedTags, ["GPSSpeed", "com.apple.quicktime.location.speed"]),
          );
          const gpsHeadingDeg = parseNumberValue(
            getTagValue(mergedTags, ["GPSImgDirection", "com.apple.quicktime.location.course"]),
          );
          const gpsAccuracyM = parseNumberValue(
            getTagValue(mergedTags, ["GPSHPositioningError", "com.apple.quicktime.location.accuracy.horizontal"]),
          );
          const gpsTimestamp = parseDateValue(
            getTagValue(mergedTags, ["GPSDateTime", "gps_datetime"]),
          );

          resolve({
            capturedAt,
            sourceApp: sourceAppRaw != null ? String(sourceAppRaw) : null,
            videoDurationSec: durationSec,
            videoFps: fps,
            videoWidth: width,
            videoHeight: height,
            videoRotation: rotation,
            videoCodec,
            videoBitrateKbps: bitrateKbps,
            fileSizeBytes,
            containerFormat,
            gpsLat,
            gpsLng,
            gpsAltM,
            gpsSpeedMps,
            gpsHeadingDeg,
            gpsAccuracyM,
            gpsTimestamp,
            gpsSource,
          });
        } catch {
          resolve({});
        }
      },
    );
  });
}

function normalizeShotLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeMovementToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function computeDiscrepancySnapshot(autoLabels: string[], manualLabels: string[]) {
  const alignedCount = Math.min(autoLabels.length, manualLabels.length);
  let labelMismatches = 0;
  const confusionMap = new Map<string, number>();

  for (let index = 0; index < alignedCount; index += 1) {
    const autoLabel = autoLabels[index];
    const manualLabel = manualLabels[index];
    if (autoLabel !== manualLabel) {
      labelMismatches += 1;
      const key = `${autoLabel}=>${manualLabel}`;
      confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
    }
  }

  const countMismatch = Math.abs(autoLabels.length - manualLabels.length);
  const mismatches = labelMismatches + countMismatch;
  const denominator = Math.max(autoLabels.length, manualLabels.length, 1);
  const mismatchRatePct = Number(((mismatches / denominator) * 100).toFixed(1));

  const confusionPairs = Array.from(confusionMap.entries()).map(([pair, count]) => {
    const [from, to] = pair.split("=>");
    return { from, to, count };
  });

  return {
    autoShots: autoLabels.length,
    manualShots: manualLabels.length,
    mismatches,
    mismatchRatePct,
    labelMismatches,
    countMismatch,
    confusionPairs,
  };
}

async function resolveAutoLabelsForAnalysis(
  analysis: typeof analyses.$inferSelect,
  sportName: string,
  movementName: string,
  manualLabels: string[],
): Promise<string[]> {
  let autoLabels: string[] = [];

  if (analysis.videoPath && fs.existsSync(analysis.videoPath)) {
    try {
      const diagnostics = await runPythonDiagnostics(
        analysis.videoPath,
        sportName,
        movementName,
      );
      autoLabels = (diagnostics?.shotSegments || []).map((segment: any) =>
        normalizeShotLabel(segment?.label),
      );
    } catch {
      autoLabels = [];
    }
  }

  if (autoLabels.length === 0 && manualLabels.length > 0) {
    const fallbackLabel = normalizeShotLabel(
      analysis.detectedMovement || movementName || "unknown",
    );
    autoLabels = Array.from({ length: manualLabels.length }, () => fallbackLabel);
  }

  return autoLabels;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await db.execute(sql`
    create table if not exists analysis_shot_annotations (
      id varchar primary key default gen_random_uuid(),
      analysis_id varchar not null references analyses(id),
      user_id varchar not null references users(id),
      total_shots real not null,
      ordered_shot_labels jsonb not null,
      used_for_scoring_shot_indexes jsonb not null,
      notes text,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `);

  await db.execute(sql`
    create unique index if not exists analysis_shot_annotations_analysis_user_uq
    on analysis_shot_annotations (analysis_id, user_id)
  `);

  await db.execute(sql`
    create table if not exists analysis_shot_discrepancies (
      id varchar primary key default gen_random_uuid(),
      analysis_id varchar not null references analyses(id),
      user_id varchar not null references users(id),
      video_name text not null,
      sport_name text not null,
      movement_name text not null,
      auto_shots real not null,
      manual_shots real not null,
      mismatches real not null,
      mismatch_rate_pct real not null,
      label_mismatches real not null,
      count_mismatch real not null,
      confusion_pairs jsonb not null default '[]'::jsonb,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `);

  await db.execute(sql`
    create unique index if not exists analysis_shot_discrepancies_analysis_user_uq
    on analysis_shot_discrepancies (analysis_id, user_id)
  `);

  await db.execute(sql`alter table analyses add column if not exists captured_at timestamp`);
  await db.execute(sql`alter table analyses add column if not exists source_app text`);
  await db.execute(sql`alter table analyses add column if not exists video_duration_sec real`);
  await db.execute(sql`alter table analyses add column if not exists video_fps real`);
  await db.execute(sql`alter table analyses add column if not exists video_width real`);
  await db.execute(sql`alter table analyses add column if not exists video_height real`);
  await db.execute(sql`alter table analyses add column if not exists video_rotation real`);
  await db.execute(sql`alter table analyses add column if not exists video_codec text`);
  await db.execute(sql`alter table analyses add column if not exists video_bitrate_kbps real`);
  await db.execute(sql`alter table analyses add column if not exists file_size_bytes real`);
  await db.execute(sql`alter table analyses add column if not exists container_format text`);
  await db.execute(sql`alter table analyses add column if not exists gps_lat real`);
  await db.execute(sql`alter table analyses add column if not exists gps_lng real`);
  await db.execute(sql`alter table analyses add column if not exists gps_alt_m real`);
  await db.execute(sql`alter table analyses add column if not exists gps_speed_mps real`);
  await db.execute(sql`alter table analyses add column if not exists gps_heading_deg real`);
  await db.execute(sql`alter table analyses add column if not exists gps_accuracy_m real`);
  await db.execute(sql`alter table analyses add column if not exists gps_timestamp timestamp`);
  await db.execute(sql`alter table analyses add column if not exists gps_source text`);

  const parseIntegerList = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    const result: number[] = [];
    for (const item of value) {
      const n = Number(item);
      if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
        result.push(n);
      }
    }
    return result;
  };

  const markStaleProcessingAsFailed = async (userId?: string) => {
    if (userId) {
      await db.execute(sql`
        update analyses
        set status = 'failed',
            rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
            updated_at = now()
        where status = 'processing'
          and updated_at < now() - interval '10 minutes'
          and user_id = ${userId}
      `);
      return;
    }

    await db.execute(sql`
      update analyses
      set status = 'failed',
          rejection_reason = 'Processing timed out. Please rerun Recalc. Metrics/Scores.',
          updated_at = now()
      where status = 'processing'
        and updated_at < now() - interval '10 minutes'
    `);
  };

  // Admin: get all users for filtering
  app.get("/api/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .orderBy(users.name);
      res.json(allUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports", async (_req: Request, res: Response) => {
    try {
      const allSports = await db
        .select()
        .from(sports)
        .orderBy(asc(sports.sortOrder));
      res.json(allSports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports/:sportId/movements", async (req: Request, res: Response) => {
    try {
      const movements = await db
        .select()
        .from(sportMovements)
        .where(eq(sportMovements.sportId, req.params.sportId))
        .orderBy(asc(sportMovements.sortOrder));
      res.json(movements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sport-configs", (_req: Request, res: Response) => {
    res.json(getAllConfigs());
  });

  app.get("/api/sport-configs/:configKey", (req: Request, res: Response) => {
    const config = getSportConfig(req.params.configKey);
    if (!config) {
      return res.status(404).json({ error: "Sport config not found" });
    }
    res.json(config);
  });

  app.post(
    "/api/upload",
    requireAuth,
    upload.single("video"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }

        const requesterUserId = req.session.userId!;
        const targetUserIdRaw = String(req.body?.targetUserId || "").trim();
        let userId = requesterUserId;
        if (targetUserIdRaw) {
          const [targetUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, targetUserIdRaw));
          if (!targetUser) {
            return res.status(400).json({ error: "Selected player not found" });
          }
          userId = targetUser.id;
        }
        const sportId = req.body?.sportId || null;
        const movementId = req.body?.movementId || null;

        let resolvedSportId: string | null = null;
        let resolvedMovementId: string | null = null;
        let resolvedSportName = "";
        let resolvedMovementName = "";

        if (sportId) {
          const [sport] = await db.select().from(sports).where(eq(sports.id, sportId));
          if (sport) {
            resolvedSportId = sport.id;
            resolvedSportName = sport.name;
          }
        }

        if (movementId) {
          const [movement] = await db
            .select()
            .from(sportMovements)
            .where(eq(sportMovements.id, movementId));

          if (movement && (!resolvedSportId || movement.sportId === resolvedSportId)) {
            resolvedMovementId = movement.id;
            resolvedMovementName = movement.name;
            if (!resolvedSportId) {
              resolvedSportId = movement.sportId;
              const [movementSport] = await db
                .select()
                .from(sports)
                .where(eq(sports.id, movement.sportId));
              if (movementSport) {
                resolvedSportName = movementSport.name;
              }
            }
          }
        }

        let finalFilename = req.file.filename;
        let finalPath = req.file.path;
        const ext = path.extname(req.file.originalname) || path.extname(req.file.filename);

        try {
          const sanitizeSegment = (s: string) =>
            s
              .replace(/[^a-zA-Z0-9\s]/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, 40);

          const [user] = await db.select().from(users).where(eq(users.id, userId));
          const sportName = resolvedSportName || "Sport";
          const movementName = resolvedMovementName;
          const categoryName = movementName || "AutoDetect";

          const parts: string[] = [];
          parts.push(sanitizeSegment(user?.name || "User"));
          parts.push(sanitizeSegment(sportName));
          parts.push(sanitizeSegment(categoryName));

          if (parts.length > 0) {
            const now = new Date();
            const datePart = now.getFullYear().toString() +
              String(now.getMonth() + 1).padStart(2, "0") +
              String(now.getDate()).padStart(2, "0");
            const timePart = String(now.getHours()).padStart(2, "0") +
              String(now.getMinutes()).padStart(2, "0") +
              String(now.getSeconds()).padStart(2, "0");

            // Keep the canonical format deterministic; only append a numeric
            // suffix if a same-second collision occurs.
            const baseName = `${parts.join("-")}-${datePart}-${timePart}`;
            let descriptiveName = `${baseName}${ext}`;
            let newPath = path.join(uploadDir, descriptiveName);
            let counter = 1;

            while (fs.existsSync(newPath)) {
              counter += 1;
              descriptiveName = `${baseName}-${counter}${ext}`;
              newPath = path.join(uploadDir, descriptiveName);
            }

            fs.renameSync(finalPath, newPath);
            finalFilename = descriptiveName;
            finalPath = newPath;
          }
        } catch (renameErr) {
          console.error("File rename failed, using original name:", renameErr);
        }

        const extractedMetadata = await extractVideoMetadata(finalPath);

        const analysis = await storage.createAnalysis(
          finalFilename,
          finalPath,
          userId,
          resolvedSportId,
          resolvedMovementId,
          extractedMetadata,
        );

        processAnalysis(analysis.id).catch(console.error);

        res.json({
          id: analysis.id,
          status: analysis.status,
          message: "Video uploaded successfully. Processing started.",
        });
      } catch (error: any) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message || "Upload failed" });
      }
    },
  );

  app.get("/api/analyses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const sportId = req.query.sportId as string | undefined;

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);

      const allAnalyses = isAdmin
        ? await storage.getAllAnalyses(null, sportId)
        : await storage.getAllAnalyses(userId, sportId);
      res.json(allAnalyses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      await markStaleProcessingAsFailed(isAdmin ? undefined : userId);

      const query = db
        .select({
          id: analyses.id,
          userId: analyses.userId,
          sportId: analyses.sportId,
          movementId: analyses.movementId,
          videoFilename: analyses.videoFilename,
          videoPath: analyses.videoPath,
          status: analyses.status,
          detectedMovement: analyses.detectedMovement,
          capturedAt: analyses.capturedAt,
          createdAt: analyses.createdAt,
          updatedAt: analyses.updatedAt,
          userName: users.name,
          overallScore: metrics.overallScore,
          subScores: metrics.subScores,
          configKey: metrics.configKey,
        })
        .from(analyses)
        .leftJoin(users, eq(analyses.userId, users.id))
        .leftJoin(metrics, eq(analyses.id, metrics.analysisId));

      const rows = isAdmin
        ? await query.orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`)
        : await query
            .where(eq(analyses.userId, userId))
            .orderBy(sql`coalesce(${analyses.capturedAt}, ${analyses.createdAt}) desc`);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(req.params.id);
      const insights = await storage.getCoachingInsights(req.params.id);

      let selectedMovementName: string | null = null;
      if (analysis.movementId) {
        const [movement] = await db
          .select()
          .from(sportMovements)
          .where(eq(sportMovements.id, analysis.movementId));
        if (movement) {
          selectedMovementName = movement.name;
        }
      }

      res.json({
        analysis,
        metrics: metricsData || null,
        coaching: insights || null,
        selectedMovementName,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/shot-annotations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const rows = isAdmin
        ? await db
            .select()
            .from(analysisShotAnnotations)
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(1000)
        : await db
            .select()
            .from(analysisShotAnnotations)
            .where(eq(analysisShotAnnotations.userId, userId))
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(300);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/shot-annotation", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const whereClause = isAdmin
        ? eq(analysisShotAnnotations.analysisId, req.params.id)
        : and(
            eq(analysisShotAnnotations.analysisId, req.params.id),
            eq(analysisShotAnnotations.userId, userId),
          );

      const [annotation] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(whereClause as any)
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      res.json(annotation || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/shot-annotation", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only annotate your own analyses" });
      }

      const totalShotsNum = Number(req.body?.totalShots);
      const orderedShotLabels = Array.isArray(req.body?.orderedShotLabels)
        ? req.body.orderedShotLabels.map((value: unknown) => String(value || "").trim()).filter(Boolean)
        : [];
      const usedForScoringShotIndexes = parseIntegerList(req.body?.usedForScoringShotIndexes);
      const notes = req.body?.notes ? String(req.body.notes) : null;

      if (!Number.isFinite(totalShotsNum) || totalShotsNum < 0) {
        return res.status(400).json({ error: "totalShots must be a non-negative number" });
      }

      if (orderedShotLabels.length !== Math.trunc(totalShotsNum)) {
        return res.status(400).json({
          error: "orderedShotLabels length must match totalShots",
        });
      }

      const [existing] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, req.params.id),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(analysisShotAnnotations)
          .set({
            totalShots: Math.trunc(totalShotsNum),
            orderedShotLabels,
            usedForScoringShotIndexes,
            notes,
            updatedAt: new Date(),
          })
          .where(eq(analysisShotAnnotations.id, existing.id));
      } else {
        await db.insert(analysisShotAnnotations).values({
          analysisId: req.params.id,
          userId,
          totalShots: Math.trunc(totalShotsNum),
          orderedShotLabels,
          usedForScoringShotIndexes,
          notes,
        });
      }

      const [saved] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, req.params.id),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      let sportName = "Tennis";
      let movementName = analysis.detectedMovement || "forehand";

      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }

      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }

      const manualLabels = (saved?.orderedShotLabels || orderedShotLabels).map((label) =>
        normalizeShotLabel(label),
      );
      res.json(saved);

      void (async () => {
        try {
          const autoLabels = await resolveAutoLabelsForAnalysis(
            analysis,
            sportName,
            movementName,
            manualLabels,
          );
          const snapshot = computeDiscrepancySnapshot(autoLabels, manualLabels);

          await db
            .insert(analysisShotDiscrepancies)
            .values({
              analysisId: analysis.id,
              userId,
              videoName: analysis.videoFilename,
              sportName,
              movementName,
              autoShots: snapshot.autoShots,
              manualShots: snapshot.manualShots,
              mismatches: snapshot.mismatches,
              mismatchRatePct: snapshot.mismatchRatePct,
              labelMismatches: snapshot.labelMismatches,
              countMismatch: snapshot.countMismatch,
              confusionPairs: snapshot.confusionPairs,
            })
            .onConflictDoUpdate({
              target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId],
              set: {
                videoName: analysis.videoFilename,
                sportName,
                movementName,
                autoShots: snapshot.autoShots,
                manualShots: snapshot.manualShots,
                mismatches: snapshot.mismatches,
                mismatchRatePct: snapshot.mismatchRatePct,
                labelMismatches: snapshot.labelMismatches,
                countMismatch: snapshot.countMismatch,
                confusionPairs: snapshot.confusionPairs,
                updatedAt: new Date(),
              },
            });
        } catch (snapshotError) {
          console.warn("Discrepancy snapshot update failed:", snapshotError);
        }
      })();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/shot-report", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      if (!analysis.videoPath || !fs.existsSync(analysis.videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }

      let sportName = "tennis";
      let movementName = analysis.detectedMovement || "forehand";

      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }

      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }

      const diagnostics = await runPythonDiagnostics(
        analysis.videoPath,
        sportName,
        movementName,
      );

      const [manualAnnotation] = await db
        .select()
        .from(analysisShotAnnotations)
        .where(
          and(
            eq(analysisShotAnnotations.analysisId, req.params.id),
            eq(analysisShotAnnotations.userId, userId),
          ),
        )
        .orderBy(desc(analysisShotAnnotations.updatedAt))
        .limit(1);

      res.json({
        analysisId: req.params.id,
        totalShots: diagnostics?.shotsDetected ?? 0,
        shots: diagnostics?.shotSegments ?? [],
        shotsUsedForScoring: diagnostics?.shotSegments?.filter((s: any) => s.includedForScoring) ?? [],
        manualAnnotation: manualAnnotation || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/discrepancy-summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      const sportFilter = String(req.query.sportName || "").trim().toLowerCase();
      const movementFilter = normalizeMovementToken(req.query.movementName || "");
      const playerFilter = String(req.query.playerId || "").trim();
      const applyPlayerFilter = isAdmin && playerFilter && playerFilter !== "all";

      const rows = isAdmin
        ? await db
            .select({
              annotation: analysisShotAnnotations,
              analysis: analyses,
              userName: sql<string | null>`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
              sportName: sports.name,
              movementName: sportMovements.name,
            })
            .from(analysisShotAnnotations)
            .innerJoin(analyses, eq(analysisShotAnnotations.analysisId, analyses.id))
            .leftJoin(sports, eq(analyses.sportId, sports.id))
            .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(200)
        : await db
            .select({
              annotation: analysisShotAnnotations,
              analysis: analyses,
              userName: sql<string | null>`(
                select u.name from users u where u.id = ${analyses.userId}
              )`,
              sportName: sports.name,
              movementName: sportMovements.name,
            })
            .from(analysisShotAnnotations)
            .innerJoin(analyses, eq(analysisShotAnnotations.analysisId, analyses.id))
            .leftJoin(sports, eq(analyses.sportId, sports.id))
            .leftJoin(sportMovements, eq(analyses.movementId, sportMovements.id))
            .where(eq(analysisShotAnnotations.userId, userId))
            .orderBy(desc(analysisShotAnnotations.updatedAt))
            .limit(30);

      const filteredRows = rows.filter((row) => {
        if (applyPlayerFilter && row.analysis.userId !== playerFilter) return false;
        if (!sportFilter) return true;
        const rowSport = String(row.sportName || "").trim().toLowerCase();
        if (!rowSport) return true;
        return rowSport === sportFilter;
      }).filter((row) => {
        if (!movementFilter) return true;
        const rowMovement = normalizeMovementToken(
          row.movementName || row.analysis.detectedMovement || "",
        );
        return rowMovement === movementFilter;
      });

      const existingSnapshots = isAdmin
        ? await db.select().from(analysisShotDiscrepancies)
        : await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(eq(analysisShotDiscrepancies.userId, userId));

      const snapshotByAnalysisId = new Map(
        existingSnapshots.map((item) => [`${item.analysisId}:${item.userId}`, item]),
      );

      const topVideos: Array<{
        analysisId: string;
        videoName: string;
        userName: string | null;
        createdAt: string;
        sportName: string;
        movementName: string;
        autoShots: number;
        manualShots: number;
        mismatches: number;
        mismatchRatePct: number;
      }> = [];

      const confusionMap = new Map<string, number>();
      const trendAccumulator = new Map<string, { mismatches: number; manualShots: number }>();
      let videosAnnotated = 0;
      let totalManualShots = 0;
      let totalMismatches = 0;

      for (const row of filteredRows) {
        const annotation = row.annotation;
        const analysis = row.analysis;
        const sportName = row.sportName || "Tennis";
        const movementName = row.movementName || analysis.detectedMovement || "forehand";

        const annotationOwnerId = annotation.userId;
        const snapshotKey = `${analysis.id}:${annotationOwnerId}`;
        let snapshot = snapshotByAnalysisId.get(snapshotKey);
        if (!snapshot) {
          const manualLabels = (annotation.orderedShotLabels || []).map((label) =>
            normalizeShotLabel(label),
          );
          const autoLabels = await resolveAutoLabelsForAnalysis(
            analysis,
            sportName,
            movementName,
            manualLabels,
          );
          const computed = computeDiscrepancySnapshot(autoLabels, manualLabels);

          await db
            .insert(analysisShotDiscrepancies)
            .values({
              analysisId: analysis.id,
              userId: annotationOwnerId,
              videoName: analysis.videoFilename,
              sportName,
              movementName,
              autoShots: computed.autoShots,
              manualShots: computed.manualShots,
              mismatches: computed.mismatches,
              mismatchRatePct: computed.mismatchRatePct,
              labelMismatches: computed.labelMismatches,
              countMismatch: computed.countMismatch,
              confusionPairs: computed.confusionPairs,
            })
            .onConflictDoUpdate({
              target: [analysisShotDiscrepancies.analysisId, analysisShotDiscrepancies.userId],
              set: {
                videoName: analysis.videoFilename,
                sportName,
                movementName,
                autoShots: computed.autoShots,
                manualShots: computed.manualShots,
                mismatches: computed.mismatches,
                mismatchRatePct: computed.mismatchRatePct,
                labelMismatches: computed.labelMismatches,
                countMismatch: computed.countMismatch,
                confusionPairs: computed.confusionPairs,
                updatedAt: new Date(),
              },
            });

          const [fresh] = await db
            .select()
            .from(analysisShotDiscrepancies)
            .where(
              and(
                eq(analysisShotDiscrepancies.analysisId, analysis.id),
                eq(analysisShotDiscrepancies.userId, annotationOwnerId),
              ),
            )
            .limit(1);

          snapshot = fresh;
          if (snapshot) {
            snapshotByAnalysisId.set(snapshotKey, snapshot);
          }
        }

        if (!snapshot) continue;

        videosAnnotated += 1;
        totalManualShots += Number(snapshot.manualShots || 0);
        totalMismatches += Number(snapshot.mismatches || 0);

        const confusionPairs = Array.isArray(snapshot.confusionPairs)
          ? snapshot.confusionPairs
          : [];
        for (const pair of confusionPairs) {
          const key = `${normalizeShotLabel(pair.from)}=>${normalizeShotLabel(pair.to)}`;
          confusionMap.set(key, (confusionMap.get(key) || 0) + Number(pair.count || 0));
        }

        const videoDate = analysis.capturedAt || analysis.createdAt;
        const dayKey = videoDate.toISOString().slice(0, 10);
        const existingTrend = trendAccumulator.get(dayKey) || { mismatches: 0, manualShots: 0 };
        trendAccumulator.set(dayKey, {
          mismatches: existingTrend.mismatches + Number(snapshot.mismatches || 0),
          manualShots: existingTrend.manualShots + Number(snapshot.manualShots || 0),
        });

        topVideos.push({
          analysisId: analysis.id,
          videoName: analysis.videoFilename,
          userName: row.userName || null,
          createdAt: videoDate.toISOString(),
          sportName,
          movementName,
          autoShots: Number(snapshot.autoShots || 0),
          manualShots: Number(snapshot.manualShots || 0),
          mismatches: Number(snapshot.mismatches || 0),
          mismatchRatePct: Number(snapshot.mismatchRatePct || 0),
        });
      }

      const rankedVideos = [...topVideos].sort((a, b) => {
        if (b.mismatchRatePct !== a.mismatchRatePct) {
          return b.mismatchRatePct - a.mismatchRatePct;
        }
        return b.mismatches - a.mismatches;
      });

      const labelConfusions = Array.from(confusionMap.entries())
        .map(([pair, count]) => {
          const [from, to] = pair.split("=>");
          return { from, to, count };
        })
        .filter((item) => {
          if (!movementFilter) return true;
          return (
            normalizeMovementToken(item.from) === movementFilter ||
            normalizeMovementToken(item.to) === movementFilter
          );
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const mismatchRatePct = Number(
        ((totalMismatches / Math.max(totalManualShots, 1)) * 100).toFixed(1),
      );

      const trend7d: Array<{ day: string; mismatchRatePct: number }> = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - offset);
        const dayKey = date.toISOString().slice(0, 10);
        const dayData = trendAccumulator.get(dayKey);
        const dayRate = dayData
          ? Number(((dayData.mismatches / Math.max(dayData.manualShots, 1)) * 100).toFixed(1))
          : 0;
        trend7d.push({ day: dayKey, mismatchRatePct: dayRate });
      }

      res.json({
        summary: {
          videosAnnotated,
          totalManualShots,
          totalMismatches,
          mismatchRatePct,
        },
        trend7d,
        topVideos: rankedVideos,
        labelConfusions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/diagnostics", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      if (!analysis.videoPath || !fs.existsSync(analysis.videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }

      let sportName = "tennis";
      let movementName = analysis.detectedMovement || "forehand";

      if (analysis.sportId) {
        const [sport] = await db.select().from(sports).where(eq(sports.id, analysis.sportId));
        if (sport) sportName = sport.name;
      }

      if (analysis.movementId) {
        const [movement] = await db.select().from(sportMovements).where(eq(sportMovements.id, analysis.movementId));
        if (movement) movementName = movement.name;
      }

      const diagnostics = await runPythonDiagnostics(
        analysis.videoPath,
        sportName,
        movementName,
      );

      res.json(diagnostics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/video-metadata", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      if (!analysis.videoPath || !fs.existsSync(analysis.videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }

      const extractedMetadata = await extractVideoMetadata(analysis.videoPath);
      return res.json(extractedMetadata || {});
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to extract video metadata" });
    }
  });

  app.get("/api/analyses/:id/comparison", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only access your own analyses" });
      }

      const metricsData = await storage.getMetrics(req.params.id);

      const periodMap: Record<string, number | null> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "all": null,
      };
      const period = (req.query.period as string) || "30d";
      if (!(period in periodMap)) {
        return res.status(400).json({ error: "Invalid period. Use 7d, 30d, 90d, or all." });
      }
      const periodDays = periodMap[period];

      const result = await storage.getHistoricalMetricAverages(
        analysis.userId!,
        new Date(analysis.capturedAt || analysis.createdAt),
        periodDays,
        analysis.sportId,
        metricsData?.configKey || null,
      );

      res.json(result);
    } catch (error: any) {
      console.error("Comparison error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/recalculate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      await markStaleProcessingAsFailed(userId);
      const userAnalyses = await storage.getAllAnalyses(userId);

      type UploadCandidate = {
        filename: string;
        fullPath: string;
        ext: string;
        mtimeMs: number;
      };

      const videoExts = new Set([".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"]);

      const collectUploadVideoFiles = (root: string): UploadCandidate[] => {
        const collected: UploadCandidate[] = [];
        const walk = (dir: string) => {
          let entries: fs.Dirent[] = [];
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
              continue;
            }
            if (!entry.isFile()) {
              continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            if (!videoExts.has(ext)) {
              continue;
            }

            try {
              const stats = fs.statSync(fullPath);
              collected.push({
                filename: entry.name,
                fullPath,
                ext,
                mtimeMs: stats.mtimeMs,
              });
            } catch {
              continue;
            }
          }
        };

        walk(root);
        return collected;
      };

      const uploadFiles = collectUploadVideoFiles(uploadDir);

      const existingPaths = new Set(
        userAnalyses
          .filter((analysis) => analysis.videoPath && fs.existsSync(analysis.videoPath))
          .map((analysis) => path.resolve(analysis.videoPath)),
      );

      const unassignedUploadFiles = new Map(
        uploadFiles
          .filter((file) => !existingPaths.has(path.resolve(file.fullPath)))
          .map((file) => [path.resolve(file.fullPath), file] as const),
      );

      const runnableAnalyses: typeof userAnalyses = [];
      let autoRelinkedAnalyses = 0;
      const skippedDetails: Array<{ id: string; reason: string; filename: string }> = [];

      for (const analysis of userAnalyses) {
        if (analysis.videoPath && fs.existsSync(analysis.videoPath)) {
          runnableAnalyses.push(analysis);
          continue;
        }

        const currentFilename = path.basename(analysis.videoFilename || "");
        const exactNameCandidate = currentFilename
          ? [...unassignedUploadFiles.values()].find((f) => f.filename === currentFilename)
          : undefined;

        if (exactNameCandidate && fs.existsSync(exactNameCandidate.fullPath)) {
          await db
            .update(analyses)
            .set({
              videoFilename: exactNameCandidate.filename,
              videoPath: exactNameCandidate.fullPath,
              updatedAt: new Date(),
            })
            .where(eq(analyses.id, analysis.id));

          runnableAnalyses.push({
            ...analysis,
            videoFilename: exactNameCandidate.filename,
            videoPath: exactNameCandidate.fullPath,
          });
          unassignedUploadFiles.delete(path.resolve(exactNameCandidate.fullPath));
          autoRelinkedAnalyses += 1;
          continue;
        }

        const originalExt = path.extname(currentFilename).toLowerCase();
        let candidates = [...unassignedUploadFiles.values()].filter((file) => {
          if (!originalExt) return true;
          return file.ext === originalExt;
        });

        if (candidates.length === 0) {
          candidates = [...unassignedUploadFiles.values()];
        }

        if (candidates.length === 0) {
          skippedDetails.push({
            id: analysis.id,
            reason: "No unassigned files found in uploads",
            filename: currentFilename,
          });
          continue;
        }

        const analysisCreatedAt = new Date(analysis.createdAt).getTime();
        const bestCandidate = candidates
          .map((file) => ({
            file,
            delta: Math.abs(file.mtimeMs - analysisCreatedAt),
          }))
          .sort((a, b) => a.delta - b.delta)[0]?.file;

        if (!bestCandidate) {
          skippedDetails.push({
            id: analysis.id,
            reason: "Could not find a relink candidate",
            filename: currentFilename,
          });
          continue;
        }

        await db
          .update(analyses)
          .set({
            videoFilename: bestCandidate.filename,
            videoPath: bestCandidate.fullPath,
            updatedAt: new Date(),
          })
          .where(eq(analyses.id, analysis.id));

        unassignedUploadFiles.delete(path.resolve(bestCandidate.fullPath));
        runnableAnalyses.push({
          ...analysis,
          videoFilename: bestCandidate.filename,
          videoPath: bestCandidate.fullPath,
        });
        autoRelinkedAnalyses += 1;
      }

      const ids = runnableAnalyses.map((analysis) => analysis.id);

      void (async () => {
        for (const id of ids) {
          try {
            await processAnalysis(id);
          } catch (err) {
            console.error(`Recalculate failed for ${id}:`, err);
          }
        }
      })();

      res.json({
        message: "Recalculation started",
        totalAnalyses: userAnalyses.length,
        queuedAnalyses: ids.length,
        autoRelinkedAnalyses,
        skippedAnalyses: userAnalyses.length - ids.length,
        skippedDetails,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/relink-and-recalculate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const analysisId = req.params.id;
      const filename = (req.body?.filename || "").toString().trim();

      if (!filename) {
        return res.status(400).json({ error: "filename is required" });
      }

      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = currentUser?.role === "admin";
      if (!isAdmin && analysis.userId !== userId) {
        return res.status(403).json({ error: "You can only relink your own analyses" });
      }

      const safeFilename = path.basename(filename);
      const relinkedPath = path.join(uploadDir, safeFilename);

      if (!fs.existsSync(relinkedPath)) {
        return res.status(404).json({ error: "File not found in uploads folder" });
      }

      await db
        .update(analyses)
        .set({
          videoFilename: safeFilename,
          videoPath: relinkedPath,
          updatedAt: new Date(),
        })
        .where(eq(analyses.id, analysisId));

      void processAnalysis(analysisId).catch((err) => {
        console.error(`Relink+recalculate failed for ${analysisId}:`, err);
      });

      res.json({
        message: "Relinked and recalculation started",
        analysisId,
        filename: safeFilename,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const [feedback] = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, req.params.id),
            eq(analysisFeedback.userId, req.session.userId!),
          ),
        )
        .limit(1);
      res.json(feedback || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyses/:id/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const { rating, comment } = req.body;
      if (!rating || !["up", "down"].includes(rating)) {
        return res.status(400).json({ error: "Rating must be 'up' or 'down'" });
      }

      const existing = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, req.params.id),
            eq(analysisFeedback.userId, req.session.userId!),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(analysisFeedback)
          .set({ rating, comment: comment || null })
          .where(eq(analysisFeedback.id, existing[0].id));
      } else {
        await db.insert(analysisFeedback).values({
          analysisId: req.params.id,
          userId: req.session.userId!,
          rating,
          comment: comment || null,
        });
      }

      const [feedback] = await db
        .select()
        .from(analysisFeedback)
        .where(
          and(
            eq(analysisFeedback.analysisId, req.params.id),
            eq(analysisFeedback.userId, req.session.userId!),
          ),
        )
        .limit(1);
      res.json(feedback);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/analyses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      if (analysis.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only delete your own analyses" });
      }

      if (fs.existsSync(analysis.videoPath)) {
        fs.unlinkSync(analysis.videoPath);
      }

      await storage.deleteAnalysis(req.params.id);
      res.json({ message: "Analysis deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/analyses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "Only admins can clear history" });
      }

      const allAnalyses = await storage.getAllAnalyses(null);

      for (const analysis of allAnalyses) {
        if (analysis.videoPath && fs.existsSync(analysis.videoPath)) {
          fs.unlinkSync(analysis.videoPath);
        }
      }

      await db.transaction(async (tx) => {
        await tx.delete(coachingInsights);
        await tx.delete(analysisFeedback);
        await tx.delete(analysisShotAnnotations);
        await tx.delete(metrics);
        await tx.delete(analyses);
        await tx.execute(sql`delete from "session"`);
      });

      res.json({ message: "History cleared", deletedCount: allAnalyses.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
