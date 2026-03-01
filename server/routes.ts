import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { processAnalysis } from "./analysis-engine";
import { requireAuth } from "./auth";
import { db } from "./db";
import { sports, sportMovements, users, analysisFeedback } from "@shared/schema";
import { eq, asc, and } from "drizzle-orm";
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

export async function registerRoutes(app: Express): Promise<Server> {
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

        const userId = req.session.userId!;
        const sportId = req.body?.sportId || null;
        const movementId = req.body?.movementId || null;

        let finalFilename = req.file.filename;
        let finalPath = req.file.path;
        const ext = path.extname(req.file.originalname) || path.extname(req.file.filename);

        try {
          const slugify = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").substring(0, 40);

          const [user] = await db.select().from(users).where(eq(users.id, userId));
          let sportName = "";
          let movementName = "";

          if (sportId) {
            const [sport] = await db.select().from(sports).where(eq(sports.id, sportId));
            if (sport) sportName = sport.name;
          }
          if (movementId) {
            const [movement] = await db.select().from(sportMovements).where(eq(sportMovements.id, movementId));
            if (movement) movementName = movement.name;
          }

          const parts: string[] = [];
          if (sportName) parts.push(slugify(sportName));
          if (movementName) parts.push(slugify(movementName));
          if (user) parts.push(slugify(user.name || "User"));

          if (parts.length > 0) {
            const now = new Date();
            const datePart = now.getFullYear().toString() +
              String(now.getMonth() + 1).padStart(2, "0") +
              String(now.getDate()).padStart(2, "0");
            const timePart = String(now.getHours()).padStart(2, "0") +
              String(now.getMinutes()).padStart(2, "0") +
              String(now.getSeconds()).padStart(2, "0");
            const uniqueSuffix = Math.random().toString(36).substring(2, 6);

            const descriptiveName = `${parts.join("-")}-${datePart}-${timePart}-${uniqueSuffix}${ext}`;
            const newPath = path.join(uploadDir, descriptiveName);

            if (!fs.existsSync(newPath)) {
              fs.renameSync(finalPath, newPath);
              finalFilename = descriptiveName;
              finalPath = newPath;
            }
          }
        } catch (renameErr) {
          console.error("File rename failed, using original name:", renameErr);
        }

        const analysis = await storage.createAnalysis(
          finalFilename,
          finalPath,
          userId,
          sportId,
          movementId,
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

      const allAnalyses = isAdmin
        ? await storage.getAllAnalyses(null, sportId)
        : await storage.getAllAnalyses(userId, sportId);
      res.json(allAnalyses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analyses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
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

  app.get("/api/analyses/:id/comparison", requireAuth, async (req: Request, res: Response) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
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
        new Date(analysis.createdAt),
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

  const httpServer = createServer(app);
  return httpServer;
}
