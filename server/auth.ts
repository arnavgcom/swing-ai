import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { users, registerSchema, loginSchema, type User } from "@shared/schema";
import { eq, or, sql } from "drizzle-orm";

function sanitizeUser(user: User) {
  const selectedScoreSectionsBySport =
    user.selectedScoreSectionsBySport
    && typeof user.selectedScoreSectionsBySport === "object"
      ? user.selectedScoreSectionsBySport
      : {};
  const selectedMetricKeysBySport =
    user.selectedMetricKeysBySport
    && typeof user.selectedMetricKeysBySport === "object"
      ? user.selectedMetricKeysBySport
      : {};

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    address: user.address,
    country: user.country,
    dominantProfile: user.dominantProfile,
    selectedScoreSections: Array.isArray(user.selectedScoreSections) ? user.selectedScoreSections : [],
    selectedMetricKeys: Array.isArray(user.selectedMetricKeys) ? user.selectedMetricKeys : [],
    selectedScoreSectionsBySport,
    selectedMetricKeysBySport,
    sportsInterests: user.sportsInterests,
    bio: user.bio,
    role: user.role,
  };
}

const avatarDir = path.resolve(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, HEIC) are allowed"));
    }
  },
});

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const PgSession = connectPgSimple(session);

export async function setupAuth(app: Express) {
  await db.execute(
    sql`alter table users add column if not exists dominant_profile text`,
  );
  await db.execute(
    sql`alter table users add column if not exists selected_score_sections jsonb default '[]'::jsonb`,
  );
  await db.execute(
    sql`alter table users add column if not exists selected_metric_keys jsonb default '[]'::jsonb`,
  );
  await db.execute(
    sql`alter table users add column if not exists selected_score_sections_by_sport jsonb default '{}'::jsonb`,
  );
  await db.execute(
    sql`alter table users add column if not exists selected_metric_keys_by_sport jsonb default '{}'::jsonb`,
  );

  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "swingai-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    }),
  );

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.errors[0].message });
      }

      const { email, name, password } = parsed.data;

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [user] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name,
          passwordHash,
        })
        .returning();

      req.session.userId = user.id;

      res.json(sanitizeUser(user));
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/admin/players", requireAuth, async (req: Request, res: Response) => {
    try {
      const [requester] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId!));

      if (!requester || requester.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.errors[0].message });
      }

      const { email, name, password } = parsed.data;

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [createdPlayer] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name,
          passwordHash,
          role: "player",
          country: requester.country || null,
        })
        .returning();

      res.status(201).json(sanitizeUser(createdPlayer));
    } catch (error: any) {
      console.error("Create player error:", error);
      res.status(500).json({ error: "Failed to create player" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse({
        identifier: req.body?.identifier ?? req.body?.email,
        password: req.body?.password,
      });
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.errors[0].message });
      }

      const { identifier, password } = parsed.data;
      const normalizedIdentifier = String(identifier).trim();
      const normalizedEmail = normalizedIdentifier.toLowerCase();

      const [user] = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.id, normalizedIdentifier),
            eq(users.email, normalizedEmail),
          ),
        );

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      req.session.userId = user.id;

      res.json(sanitizeUser(user));
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/google/mobile-callback", (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signing in...</title>
<style>body{background:#0A0A1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.loader{text-align:center}.spinner{width:40px;height:40px;border:3px solid #333;border-top:3px solid #6C5CE7;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="loader"><div class="spinner"></div><p>Completing sign in...</p></div>
<script>
(function(){
  var h=window.location.hash.substring(1);
  if(!h){document.querySelector('p').textContent='Sign in failed. Please try again.';return;}
  var p=new URLSearchParams(h);
  var t=p.get('access_token');
  if(t){window.location.href='swingai://google-auth?access_token='+encodeURIComponent(t);}
  else{document.querySelector('p').textContent='Sign in failed. No token received.';}
})();
</script></body></html>`);
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { idToken, accessToken } = req.body;

      if (!idToken && !accessToken) {
        return res.status(400).json({ error: "Google token required" });
      }

      let googleUser: { email: string; name: string; picture?: string } | null = null;

      if (idToken) {
        const verifyRes = await globalThis.fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
        );
        if (!verifyRes.ok) {
          return res.status(401).json({ error: "Invalid Google token" });
        }
        const payload = await verifyRes.json() as any;
        googleUser = {
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          picture: payload.picture,
        };
      } else if (accessToken) {
        const userInfoRes = await globalThis.fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!userInfoRes.ok) {
          return res.status(401).json({ error: "Invalid Google token" });
        }
        const payload = await userInfoRes.json() as any;
        googleUser = {
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          picture: payload.picture,
        };
      }

      if (!googleUser || !googleUser.email) {
        return res.status(401).json({ error: "Could not verify Google account" });
      }

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email.toLowerCase()));

      if (existing) {
        req.session.userId = existing.id;
        const updates: Record<string, string | null> = {};
        if (googleUser.picture && !existing.avatarUrl) {
          updates.avatarUrl = googleUser.picture;
        }
        if (Object.keys(updates).length > 0) {
          const [updated] = await db
            .update(users)
            .set(updates)
            .where(eq(users.id, existing.id))
            .returning();
          return res.json(sanitizeUser(updated));
        }
        return res.json(sanitizeUser(existing));
      }

      const randomPassword = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const [newUser] = await db
        .insert(users)
        .values({
          email: googleUser.email.toLowerCase(),
          name: googleUser.name,
          passwordHash,
          avatarUrl: googleUser.picture || null,
          country: "Singapore",
        })
        .returning();

      req.session.userId = newUser.id;
      res.json(sanitizeUser(newUser));
    } catch (error: any) {
      console.error("Google auth error:", error);
      res.status(500).json({ error: "Google authentication failed" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId!));
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  app.put("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        name,
        phone,
        address,
        country,
        dominantProfile,
        selectedScoreSections,
        selectedMetricKeys,
        selectedSportKey,
        sportsInterests,
        bio,
        role,
      } = req.body;
      const requesterId = req.session.userId!;
      const [requester] = await db
        .select()
        .from(users)
        .where(eq(users.id, requesterId));

      if (!requester) {
        return res.status(401).json({ error: "User not found" });
      }

      if (name !== undefined && (!name || typeof name !== "string" || !name.trim())) {
        return res.status(400).json({ error: "Name is required" });
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (phone !== undefined) updates.phone = phone?.trim() || null;
      if (address !== undefined) updates.address = address?.trim() || null;
      if (country !== undefined) updates.country = country?.trim() || null;
      if (dominantProfile !== undefined) {
        const value = String(dominantProfile || "").trim().toLowerCase();
        if (!value) {
          updates.dominantProfile = null;
        } else if (value === "right" || value === "left") {
          updates.dominantProfile = value;
        } else {
          return res.status(400).json({ error: "dominantProfile must be Right or Left" });
        }
      }
      if (sportsInterests !== undefined) updates.sportsInterests = sportsInterests?.trim() || null;
      if (bio !== undefined) updates.bio = bio?.trim() || null;
      if (selectedScoreSections !== undefined) {
        if (!Array.isArray(selectedScoreSections) || !selectedScoreSections.every((v) => typeof v === "string")) {
          return res.status(400).json({ error: "selectedScoreSections must be an array of strings" });
        }
      }
      if (selectedMetricKeys !== undefined) {
        if (!Array.isArray(selectedMetricKeys) || !selectedMetricKeys.every((v) => typeof v === "string")) {
          return res.status(400).json({ error: "selectedMetricKeys must be an array of strings" });
        }
      }

      const normalizedSportKey = String(selectedSportKey || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (selectedScoreSections !== undefined || selectedMetricKeys !== undefined) {
        if (normalizedSportKey) {
          const existingScoreBySport =
            requester.selectedScoreSectionsBySport
            && typeof requester.selectedScoreSectionsBySport === "object"
              ? { ...(requester.selectedScoreSectionsBySport as Record<string, string[]>) }
              : {};
          const existingMetricBySport =
            requester.selectedMetricKeysBySport
            && typeof requester.selectedMetricKeysBySport === "object"
              ? { ...(requester.selectedMetricKeysBySport as Record<string, string[]>) }
              : {};

          if (selectedScoreSections !== undefined) {
            existingScoreBySport[normalizedSportKey] = selectedScoreSections;
          }
          if (selectedMetricKeys !== undefined) {
            existingMetricBySport[normalizedSportKey] = selectedMetricKeys;
          }

          updates.selectedScoreSectionsBySport = existingScoreBySport;
          updates.selectedMetricKeysBySport = existingMetricBySport;
        } else {
          // Backward-compatible fallback to global preferences when no sport key is supplied.
          if (selectedScoreSections !== undefined) {
            updates.selectedScoreSections = selectedScoreSections;
          }
          if (selectedMetricKeys !== undefined) {
            updates.selectedMetricKeys = selectedMetricKeys;
          }
        }
      }
      if (role !== undefined) {
        if (!(role === "player" || role === "admin")) {
          return res.status(400).json({ error: "role must be player or admin" });
        }
        updates.role = role;
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, requesterId))
        .returning();

      res.json(sanitizeUser(updated));
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post(
    "/api/profile/avatar",
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      avatarUpload.single("avatar")(req, res, (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File too large. Maximum 5MB." });
          }
          return res.status(400).json({ error: err.message || "Invalid file upload" });
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image provided" });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        const [updated] = await db
          .update(users)
          .set({ avatarUrl })
          .where(eq(users.id, req.session.userId!))
          .returning();

        res.json(sanitizeUser(updated));
      } catch (error) {
        res.status(500).json({ error: "Failed to upload avatar" });
      }
    },
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    return next();
  }

  return res.status(401).json({ error: "Authentication required" });
}
