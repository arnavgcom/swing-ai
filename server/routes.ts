import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { processAnalysis } from "./analysis-engine";
import { requireAuth } from "./auth";
import { db } from "./db";
import { sports, sportMovements, users } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
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

        const analysis = await storage.createAnalysis(
          req.file.originalname,
          req.file.path,
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

      res.json({
        analysis,
        metrics: metricsData || null,
        coaching: insights || null,
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
