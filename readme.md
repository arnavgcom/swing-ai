# Swing AI — Multi-Sport Performance Analysis

## Architecture

Monorepo managed with **npm workspaces** — three packages under `packages/`:

| Package | Path | Description |
|---------|------|-------------|
| `@swing-ai/shared` | `packages/shared/` | Drizzle schema, sport configs, shared types |
| `@swing-ai/server` | `packages/server/` | Express API, Python analysis engine, uploads |
| `@swing-ai/app` | `packages/app/` | Expo React Native frontend |

- **Frontend** (`packages/app/`): Expo React Native (port 8081) — Login, Sport Selection, 3-tab layout (Dashboard, Upload/Analyze, History), Analysis Detail screen
- **Backend** (`packages/server/`): Express/Node.js (port 5000) — REST API for auth, sports, uploads, analysis CRUD, sport configs, static landing page
- **Shared** (`packages/shared/`): Drizzle ORM schema, sport category configs, Zod validators, shared TypeScript types
- **Database**: PostgreSQL via Drizzle ORM — stores users, sports, sport_movements, analyses, metrics (JSONB), coaching_insights tables
- **Video Storage**: Local `packages/server/uploads/` folder. Files renamed to `Sport-Category-UserName-YYYYMMDD-HHMMSS-xxxx.ext` on upload (e.g., `Tennis-Forehand-JohnSmith-20260301-143022-a1b2.mp4`)
- **ML Pipeline**: Python 3.11 with OpenCV (frame extraction), MediaPipe Tasks API v0.10.32 (pose detection), HSV ball tracking — pluggable per-sport analyzers with automatic movement classification. Python venv at `packages/server/.venv/`
- **Auth**: Google OAuth + Apple Sign-In (coming soon) via WebBrowser.openAuthSessionAsync + backend bridge page at `/api/auth/google/mobile-callback` with express-session + connect-pg-simple (session stored in PostgreSQL). Google Client ID via `EXPO_PUBLIC_GOOGLE_CLIENT_ID` env var.

## Sport-Agnostic Architecture

Each sport+movement combination (e.g., "Tennis/Forehand", "Golf/Drive") is a **sport category** with a unique `configKey` (e.g., `tennis-forehand`, `golf-drive`). The system is pluggable:

- **Config Layer** (`packages/shared/sport-configs/`): TypeScript config per sport category defining metrics, sub-scores, units, icons, colors, optimal ranges, and scoring weights
- **Movement Classifier** (`packages/server/python_analysis/movement_classifier.py`): Automatic movement detection using pose landmark analysis (cross-body motion, wrist speeds, overhead/serve detection, swing arc). Overrides user selection if mismatch detected. Includes `validate_sport_match()` content validation gate with multi-heuristic penalty system: (1) peak-ratio check — sport swings have distinct acceleration peaks (max > 1.5× avg), (2) continuous-motion check — rejects if 85%+ frames have above-avg speed (dance pattern), (3) arm asymmetry — non-tennis/golf sports must show dominant arm (ratio > 1.2), (4) hip/wrist ratio — full-body dance-like movement rejected (threshold 0.7, relaxed to 0.9 for golf/tennis with natural hip rotation), (5) background color analysis — HSV scene detection checks for sport-appropriate backgrounds (green for golf/tennis, indoor for table tennis/badminton). Penalty threshold: 4.0 to reject. Backend safety net: scores below 15 auto-rejected. Rejected analyses get `status: "rejected"` with `rejectionReason` in the DB.
- **Background Analyzer** (`packages/server/python_analysis/background_analyzer.py`): Samples ~8 evenly-spaced frames, masks out the detected person using pose landmarks, and analyzes remaining background pixels via HSV color ratios (green/brown/blue/white), brightness stats, and Hough-line court detection. Returns soft penalty signals (0.5–1.0) per sport.
- **Python Analyzers** (`packages/server/python_analysis/sports/`): One analyzer class per sport category inheriting from `BaseAnalyzer` — computes sport-specific metrics from pose data
- **Database**: `metrics` table uses JSONB columns (`metricValues`, `subScores`) + `configKey` varchar — no fixed metric columns
- **Frontend**: Analysis detail screen fetches the sport config via API and renders metrics/scores dynamically — no hardcoded labels

### Supported Sport Categories (30 total)
- **Tennis** (5): forehand, backhand, serve, volley, game
- **Golf** (5): drive, iron, chip, putt, full-swing
- **Pickleball** (5): dink, drive, serve, volley, third-shot-drop
- **Paddle** (5): forehand, backhand, serve, smash, bandeja
- **Badminton** (5): clear, smash, drop, net-shot, serve
- **Table Tennis** (5): forehand, backhand, serve, loop, chop

## Design System

- **Theme**: Premium dark midnight theme — always dark, no light mode toggle
- **Background**: Midnight (#0A0A1A) with subtle gradient (#0F0F2E)
- **Primary**: Purple (#6C5CE7, light: #A29BFE)
- **Accent**: Soft emerald (#34D399) — muted, not neon
- **Secondary accents**: Blue (#60A5FA), Amber (#FBBF24), Red (#F87171)
- **Surfaces**: Dark card (#15152D), borders (#2A2A5060 — 37% alpha for softness)
- **Sport-specific colors**: Tennis green, Golf cyan, Pickleball amber, Paddle purple, Badminton red, Table Tennis blue (defined in `sportColors` export in `constants/colors.ts`)
- **Typography**: Inter font family (400/500/600/700 weights) — section titles use 600SemiBold, labels use 400Regular for lighter feel
- **Cards**: borderRadius 16, soft borders, no harsh lines. AnalysisCard has left accent bar in status color.
- **All screens use `LinearGradient` backgrounds and consistent dark surface styling**

## Data Storage

- **Videos**: Saved to `packages/server/uploads/` directory via multer disk storage
- **Metrics + Analysis**: PostgreSQL tables via `DATABASE_URL`
- **Sessions**: PostgreSQL via connect-pg-simple

## Key Files

### Backend (`packages/server/`)
- `src/index.ts` — Express app entry point (port 5000)
- `src/auth.ts` — Authentication routes (register, login, logout, me) + profile routes (GET/PUT /api/profile, POST /api/profile/avatar) + session setup
- `src/routes.ts` — API routes: sports, upload, analyses CRUD, sport-configs endpoints, comparison endpoint, `GET /api/analyses/summary` (analyses with overallScore/subScores joined from metrics table)
- `src/analysis-engine.ts` — Looks up sport/movement from analysis record, passes --sport/--movement to Python, stores JSONB results
- `src/storage.ts` — DatabaseStorage class (Drizzle ORM CRUD operations with JSONB metric queries)
- `src/seed-sports.ts` — Seeds 6 sports + movements on first startup
- `src/db.ts` — Drizzle PostgreSQL connection

### Sport Configs (`packages/shared/sport-configs/`)
- `types.ts` — MetricDefinition, ScoreDefinition, SportCategoryConfig interfaces
- `index.ts` — Config registry with getSportConfig(), getAllConfigs(), getConfigKey()
- `tennis-*.ts` — 5 tennis category configs (forehand, backhand, serve, volley, game)
- `golf-*.ts` — 5 golf category configs (drive, iron, chip, putt, full-swing)
- `pickleball-*.ts` — 5 pickleball category configs (dink, drive, serve, volley, third-shot-drop)
- `paddle-*.ts` — 5 paddle category configs (forehand, backhand, serve, smash, bandeja)
- `badminton-*.ts` — 5 badminton category configs (clear, smash, drop, net-shot, serve)
- `tabletennis-*.ts` — 5 table tennis category configs (forehand, backhand, serve, loop, chop)
- `REFERENCE_MATRIX.md` — Complete reference of all 30 sport categories with metrics, optimal ranges, scores, and formulas

### Python Analysis (`packages/server/python_analysis/`)
- `run_analysis.py` — CLI entry point with --sport/--movement args, dispatches via registry
- `base_analyzer.py` — Abstract BaseAnalyzer with shared pose/video/metric logic
- `pose_detector.py` — PoseDetector using MediaPipe Tasks API (PoseLandmarker)
- `ball_tracker.py` — BallTracker using HSV contour detection
- `sports/registry.py` — Maps configKey → analyzer class with lazy loading
- `sports/tennis_*.py` — 5 tennis analyzer modules
- `sports/golf_*.py` — 5 golf analyzer modules
- `sports/pickleball_*.py` — 5 pickleball analyzer modules
- `sports/paddle_*.py` — 5 paddle analyzer modules
- `sports/badminton_*.py` — 5 badminton analyzer modules
- `sports/tabletennis_*.py` — 5 table tennis analyzer modules
- `packages/server/models/pose_landmarker_lite.task` — MediaPipe pose model file

### Frontend (`packages/app/`)
- `app/_layout.tsx` — Root layout: auth routing (login → sport-select → tabs)
- `app/login.tsx` — Login screen: Google button + email/password fallback, purple/emerald gradient branding
- `app/sport-select.tsx` — Sport selection with 2-column gradient grid cards → movement list
- `app/(tabs)/_layout.tsx` — Tab navigator (Dashboard, Upload, History) with soft emerald (#34D399) active tab
- `app/profile.tsx` — Profile screen (edit name, phone, address, country, sports interests, bio, avatar upload, logout)
- `app/(tabs)/index.tsx` — Dashboard with overall score card (category badge, delta vs previous session), 3 glass-feel sub-cards (Consistency, Timing, Stability with deltas), filtered by selected sport/movement via configKey
- `app/(tabs)/upload.tsx` — Video upload with gradient background
- `app/(tabs)/history.tsx` — Analysis history with trend chart, Total/Active/Done stat cards, session cards showing 4 sub-scores (Power, Timing, Stability, Consistency) with deltas, filtered by sport/movement
- `app/analysis/[id].tsx` — Dynamic analysis detail: score circle labeled "Score" with sport+category badges and compact thumbs up/down inline to the right; "Player's Comment" section with always-visible TextInput; fetches sport config by configKey → renders metrics by category, sub-scores, and coaching dynamically
- `lib/auth-context.tsx` — Auth context provider
- `lib/sport-context.tsx` — Sport context provider (selected sport/movement, persisted to AsyncStorage)
- `lib/query-client.ts` — React Query client with API URL configuration
- `lib/api.ts` — API helper functions including fetchSportConfig(), updated MetricsResponse with JSONB types
- `components/ghost-animation/` — Ghost Player Correction Animation: GhostSwingAnimation (playback + dual skeleton overlay + swing path toggle), SkeletonRenderer (SVG MediaPipe skeleton), SwingPathRenderer (SVG trajectory lines for wrist/elbow/hip — red player path vs green optimal path, progressive draw during playback), PlaybackControls (play/pause/scrubber/speed), CorrectionVisualizer (deviation bar + recommendation)
- `lib/ghost-correction/` — CorrectionDetector (finds highest-priority metric deviation, maps to joints), CorrectionGenerator (adjusts skeleton frames toward optimal positions)
- `components/` — ScoreGauge, MetricCard, SubScoreBar, CoachingCard, AnalysisCard (all dark-themed)
- `constants/colors.ts` — Theme colors (midnight/purple/neon palette) + `sportColors` map

### Schema
- `packages/shared/schema.ts` — Drizzle schema: users (with `role` column: "player"|"admin"), sports, sport_movements, analyses, metrics (JSONB metricValues/subScores/configKey), coaching_insights, analysis_feedback (thumbs up/down + comment)

## User Roles

- **player** (default): Can only see their own analyses across Dashboard, Analyze, and History tabs
- **admin**: Can view all users' analyses with uploader names shown on analysis cards
- **Delete restriction**: Only the owner (uploader) of a video can delete it, regardless of role
- **Role toggle**: Users can switch between player and admin via a toggle in the Profile screen
- Profile saves role via `PUT /api/profile` with `role` field

## Sports & Movements

6 sports with auto-detected skill categories:
- **Tennis**: Forehand, Backhand, Serve, Volley, Game
- **Golf**: Drive, Iron Shot, Chip, Putt, Full Swing
- **Pickleball**: Dink, Drive, Serve, Volley, Third Shot Drop
- **Paddle**: Forehand, Backhand, Serve, Smash, Bandeja
- **Badminton**: Clear, Smash, Drop, Net Shot, Serve
- **Table Tennis**: Forehand, Backhand, Serve, Loop, Chop

## Dependencies

- **Node**: express, express-session, connect-pg-simple, bcryptjs, multer, drizzle-orm, @tanstack/react-query, expo-router, expo-linear-gradient
- **Python**: opencv-python-headless, mediapipe (0.10.32), numpy

## Deployment

- **Target**: Autoscale (Cloud Run)
- **Build**: `npm run server:build` (esbuild bundles `packages/server/` to `packages/server/dist/`)
- **Run**: `npm run server:start` — runs production bundle
- **Dev ports**: Express on 5000, Expo dev server on 8081
- **Healthcheck**: Root `/` serves landing page (200 OK)

## Development

```bash
# Install all dependencies (root + all packages)
npm install

# Start backend dev server (port 5000)
npm run server:dev

# Start Expo app dev server (port 8081)
npm run app:start

# Build server for production
npm run server:build

# iOS / Android
npm run app:ios
npm run app:android

# Database push (Drizzle)
npm run db:push
```
