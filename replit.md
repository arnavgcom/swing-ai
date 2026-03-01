# AceX AI — Multi-Sport Performance Analysis

## Architecture

- **Frontend**: Expo React Native (port 8081) — Login, Sport Selection, 3-tab layout (Dashboard, Upload/Analyze, History), Analysis Detail screen
- **Backend**: Express/Node.js (port 5000) — REST API for auth, sports, uploads, analysis CRUD, sport configs, static landing page
- **Database**: Replit PostgreSQL via Drizzle ORM — stores users, sports, sport_movements, analyses, metrics (JSONB), coaching_insights tables
- **Video Storage**: Local `uploads/` folder on Replit filesystem
- **ML Pipeline**: Python 3.11 with OpenCV (frame extraction), MediaPipe Tasks API v0.10.32 (pose detection), HSV ball tracking — pluggable per-sport analyzers
- **Auth**: Email/password + Google OAuth (WebBrowser.openAuthSessionAsync + backend bridge page at `/api/auth/google/mobile-callback`) with express-session + connect-pg-simple (session stored in PostgreSQL). Google Client ID via `EXPO_PUBLIC_GOOGLE_CLIENT_ID` env var.

## Sport-Agnostic Architecture

Each sport+movement combination (e.g., "Tennis/Forehand", "Golf/Drive") is a **sport category** with a unique `configKey` (e.g., `tennis-forehand`, `golf-drive`). The system is pluggable:

- **Config Layer** (`shared/sport-configs/`): TypeScript config per sport category defining metrics, sub-scores, units, icons, colors, optimal ranges, and scoring weights
- **Python Analyzers** (`python_analysis/sports/`): One analyzer class per sport category inheriting from `BaseAnalyzer` — computes sport-specific metrics from pose data
- **Database**: `metrics` table uses JSONB columns (`metricValues`, `subScores`) + `configKey` varchar — no fixed metric columns
- **Frontend**: Analysis detail screen fetches the sport config via API and renders metrics/scores dynamically — no hardcoded labels

### Supported Sport Categories (10 total)
- **Tennis**: forehand, backhand, serve, volley, game
- **Golf**: drive, iron, chip, putt, full-swing

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

All data is stored entirely on Replit:
- **Videos**: Saved to `uploads/` directory via multer disk storage
- **Metrics + Analysis**: PostgreSQL tables via `DATABASE_URL`
- **Sessions**: PostgreSQL via connect-pg-simple

## Key Files

### Backend
- `server/index.ts` — Express app entry point (port 5000)
- `server/auth.ts` — Authentication routes (register, login, logout, me) + profile routes (GET/PUT /api/profile, POST /api/profile/avatar) + session setup
- `server/routes.ts` — API routes: sports, upload, analyses CRUD, sport-configs endpoints (GET /api/sport-configs, GET /api/sport-configs/:configKey), comparison endpoint
- `server/analysis-engine.ts` — Looks up sport/movement from analysis record, passes --sport/--movement to Python, stores JSONB results
- `server/storage.ts` — DatabaseStorage class (Drizzle ORM CRUD operations with JSONB metric queries)
- `server/seed-sports.ts` — Seeds 6 sports + movements on first startup
- `server/db.ts` — Drizzle PostgreSQL connection

### Sport Configs
- `shared/sport-configs/types.ts` — MetricDefinition, ScoreDefinition, SportCategoryConfig interfaces
- `shared/sport-configs/index.ts` — Config registry with getSportConfig(), getAllConfigs(), getConfigKey()
- `shared/sport-configs/tennis-*.ts` — 5 tennis category configs (forehand, backhand, serve, volley, game)
- `shared/sport-configs/golf-*.ts` — 5 golf category configs (drive, iron, chip, putt, full-swing)

### Python Analysis
- `python_analysis/run_analysis.py` — CLI entry point with --sport/--movement args, dispatches via registry
- `python_analysis/base_analyzer.py` — Abstract BaseAnalyzer with shared pose/video/metric logic
- `python_analysis/pose_detector.py` — PoseDetector using MediaPipe Tasks API (PoseLandmarker)
- `python_analysis/ball_tracker.py` — BallTracker using HSV contour detection
- `python_analysis/sports/registry.py` — Maps configKey → analyzer class with lazy loading
- `python_analysis/sports/tennis_*.py` — 5 tennis analyzer modules
- `python_analysis/sports/golf_*.py` — 5 golf analyzer modules
- `models/pose_landmarker_lite.task` — MediaPipe pose model file

### Frontend
- `app/_layout.tsx` — Root layout: auth routing (login → sport-select → tabs)
- `app/login.tsx` — Login screen: Google button + email/password fallback, purple/emerald gradient branding
- `app/sport-select.tsx` — Sport selection with 2-column gradient grid cards → movement list
- `app/(tabs)/_layout.tsx` — Tab navigator (Dashboard, Upload, History) with soft emerald (#34D399) active tab
- `app/profile.tsx` — Profile screen (edit name, phone, address, country, sports interests, bio, avatar upload, logout)
- `app/(tabs)/index.tsx` — Dashboard with sport pill, gradient stat cards, analysis list; avatar icon navigates to profile
- `app/(tabs)/upload.tsx` — Video upload with gradient background
- `app/(tabs)/history.tsx` — Analysis history list with gradient background
- `app/analysis/[id].tsx` — Dynamic analysis detail: fetches sport config by configKey → renders metrics by category, sub-scores, and coaching dynamically
- `lib/auth-context.tsx` — Auth context provider
- `lib/sport-context.tsx` — Sport context provider (selected sport/movement, persisted to AsyncStorage)
- `lib/query-client.ts` — React Query client with API URL configuration
- `lib/api.ts` — API helper functions including fetchSportConfig(), updated MetricsResponse with JSONB types
- `components/` — ScoreGauge, MetricCard, SubScoreBar, CoachingCard, AnalysisCard (all dark-themed)
- `constants/colors.ts` — Theme colors (midnight/purple/neon palette) + `sportColors` map

### Schema
- `shared/schema.ts` — Drizzle schema: users, sports, sport_movements, analyses, metrics (JSONB metricValues/subScores/configKey), coaching_insights

## Sports & Movements

6 sports with auto-detected skill categories:
- **Tennis** (enabled): Forehand, Backhand, Serve, Volley, Game
- **Golf** (enabled): Drive, Iron Shot, Chip, Putt, Full Swing
- **Pickleball** (coming soon): Dink, Drive, Serve, Volley, Third Shot Drop
- **Paddle** (coming soon): Forehand, Backhand, Serve, Smash, Bandeja
- **Badminton** (coming soon): Clear, Smash, Drop, Net Shot, Serve
- **Table Tennis** (coming soon): Forehand, Backhand, Serve, Loop, Chop

## Dependencies

- **Node**: express, express-session, connect-pg-simple, bcryptjs, multer, drizzle-orm, @tanstack/react-query, expo-router, expo-linear-gradient
- **Python**: opencv-python-headless, mediapipe (0.10.32), numpy

## Deployment

- **Target**: Autoscale (Cloud Run)
- **Build**: `npm run expo:static:build && npm run server:build`
- **Run**: `PORT=8081 npm run server:prod` — Express listens on 8081 in production (mapped to external port 80 for healthchecks)
- **Dev ports**: Express on 5000, Expo dev server on 8081
- **Healthcheck**: Root `/` serves landing page (200 OK)

## Workflows

- `Start Backend` — `npm run server:dev` (port 5000)
- `Start Frontend` — `npm run expo:dev` (port 8081)
