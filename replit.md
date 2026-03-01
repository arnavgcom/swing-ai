# AceX AI — Multi-Sport Performance Analysis

## Architecture

- **Frontend**: Expo React Native (port 8081) — Login, Sport Selection, 3-tab layout (Dashboard, Upload/Analyze, History), Analysis Detail screen
- **Backend**: Express/Node.js (port 5000) — REST API for auth, sports, uploads, analysis CRUD, static landing page
- **Database**: Replit PostgreSQL via Drizzle ORM — stores users, sports, sport_movements, analyses, metrics, coaching_insights tables
- **Video Storage**: Local `uploads/` folder on Replit filesystem
- **ML Pipeline**: Python 3.11 with OpenCV (frame extraction), MediaPipe Tasks API v0.10.32 (pose detection), HSV ball tracking
- **Auth**: Email/password + Google OAuth (WebBrowser.openAuthSessionAsync + backend bridge page at `/api/auth/google/mobile-callback`) with express-session + connect-pg-simple (session stored in PostgreSQL). Google Client ID via `EXPO_PUBLIC_GOOGLE_CLIENT_ID` env var.

## Design System

- **Theme**: Premium dark midnight theme — always dark, no light mode toggle
- **Background**: Midnight (#0A0A1A) with subtle gradient (#0F0F2E)
- **Primary**: Purple (#6C5CE7, light: #A29BFE)
- **Accent**: Neon green (#00F5A0)
- **Surfaces**: Dark card (#131328), borders (#2A2A50)
- **Sport-specific colors**: Tennis green, Golf cyan, Pickleball amber, Paddle purple, Badminton red, Table Tennis blue (defined in `sportColors` export in `constants/colors.ts`)
- **Typography**: Inter font family (400/500/600/700 weights)
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
- `server/routes.ts` — API routes: sports, upload, analyses CRUD, comparison endpoint (GET /api/analyses/:id/comparison?period=7d|30d|90d|all)
- `server/analysis-engine.ts` — Calls Python analysis via child_process.execFile, stores results in DB
- `server/storage.ts` — DatabaseStorage class (Drizzle ORM CRUD operations)
- `server/seed-sports.ts` — Seeds 6 sports + movements on first startup
- `server/db.ts` — Drizzle PostgreSQL connection

### Python Analysis
- `python_analysis/run_analysis.py` — CLI entry point, outputs JSON to stdout
- `python_analysis/analyzer.py` — ForehandAnalyzer: orchestrates pose detection + ball tracking
- `python_analysis/pose_detector.py` — PoseDetector using MediaPipe Tasks API (PoseLandmarker)
- `python_analysis/ball_tracker.py` — BallTracker using HSV contour detection
- `models/pose_landmarker_lite.task` — MediaPipe pose model file

### Frontend
- `app/_layout.tsx` — Root layout: auth routing (login → sport-select → tabs)
- `app/login.tsx` — Login screen: Google button + email/password fallback, purple/neon gradient branding
- `app/sport-select.tsx` — Sport selection with 2-column gradient grid cards → movement list
- `app/(tabs)/_layout.tsx` — Tab navigator (Dashboard, Upload, History) with neon green active tab
- `app/profile.tsx` — Profile screen (edit name, phone, address, country, sports interests, bio, avatar upload, logout)
- `app/(tabs)/index.tsx` — Dashboard with sport pill, gradient stat cards, analysis list; avatar icon navigates to profile
- `app/(tabs)/upload.tsx` — Video upload with gradient background
- `app/(tabs)/history.tsx` — Analysis history list with gradient background
- `app/analysis/[id].tsx` — Analysis detail screen with gradient background, inline video player (expo-video), metric comparison with time period selector (7D/30D/90D/All)
- `lib/auth-context.tsx` — Auth context provider (login, register, logout, refreshUser, user state with profile fields)
- `lib/sport-context.tsx` — Sport context provider (selected sport/movement, persisted to AsyncStorage)
- `lib/query-client.ts` — React Query client with API URL configuration
- `lib/api.ts` — API helper functions (fetchAnalyses, uploadVideo, etc.)
- `components/` — ScoreGauge, MetricCard, SubScoreBar, CoachingCard, AnalysisCard (all dark-themed)
- `constants/colors.ts` — Theme colors (midnight/purple/neon palette) + `sportColors` map

### Schema
- `shared/schema.ts` — Drizzle schema: users, sports, sport_movements, analyses, metrics, coaching_insights

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
- **Build**: `npm run expo:static:build && npm run server:build`
- **Run**: `PORT=8081 npm run server:prod` — Express listens on 8081 in production (mapped to external port 80 for healthchecks)
- **Dev ports**: Express on 5000, Expo dev server on 8081
- **Healthcheck**: Root `/` serves landing page (200 OK)

## Workflows

- `Start Backend` — `npm run server:dev` (port 5000)
- `Start Frontend` — `npm run expo:dev` (port 8081)
