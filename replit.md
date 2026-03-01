# CourtVision — Multi-Sport Performance Analysis

## Architecture

- **Frontend**: Expo React Native (port 8081) — Login, Sport Selection, 3-tab layout (Dashboard, Upload/Analyze, History), Analysis Detail screen
- **Backend**: Express/Node.js (port 5000) — REST API for auth, sports, uploads, analysis CRUD, static landing page
- **Database**: Replit PostgreSQL via Drizzle ORM — stores users, sports, sport_movements, analyses, metrics, coaching_insights tables
- **Video Storage**: Local `uploads/` folder on Replit filesystem
- **ML Pipeline**: Python 3.11 with OpenCV (frame extraction), MediaPipe Tasks API v0.10.32 (pose detection), HSV ball tracking
- **Auth**: Email/password with express-session + connect-pg-simple (session stored in PostgreSQL)

## Data Storage

All data is stored entirely on Replit:
- **Videos**: Saved to `uploads/` directory via multer disk storage
- **Metrics + Analysis**: PostgreSQL tables via `DATABASE_URL`
- **Sessions**: PostgreSQL via connect-pg-simple

## Key Files

### Backend
- `server/index.ts` — Express app entry point (port 5000)
- `server/auth.ts` — Authentication routes (register, login, logout, me) + session setup
- `server/routes.ts` — API routes: sports, upload, analyses CRUD
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
- `app/login.tsx` — Login/Register screen with email/password + social placeholders
- `app/sport-select.tsx` — Sport selection with expandable movement hierarchy
- `app/(tabs)/_layout.tsx` — Tab navigator (Dashboard, Upload, History)
- `app/(tabs)/index.tsx` — Dashboard with sport context, user greeting, stats
- `app/(tabs)/upload.tsx` — Video upload with sport/movement context
- `app/(tabs)/history.tsx` — Analysis history list
- `app/analysis/[id].tsx` — Analysis detail screen
- `lib/auth-context.tsx` — Auth context provider (login, register, logout, user state)
- `lib/sport-context.tsx` — Sport context provider (selected sport/movement, persisted to AsyncStorage)
- `lib/query-client.ts` — React Query client with API URL configuration
- `lib/api.ts` — API helper functions (fetchAnalyses, uploadVideo, etc.)
- `components/` — ScoreGauge, MetricCard, SubScoreBar, CoachingCard, AnalysisCard
- `constants/colors.ts` — Theme colors (dark/light with emerald primary)

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

- **Node**: express, express-session, connect-pg-simple, bcryptjs, multer, drizzle-orm, @tanstack/react-query, expo-router
- **Python**: opencv-python-headless, mediapipe (0.10.32), numpy

## Workflows

- `Start Backend` — `npm run server:dev` (port 5000)
- `Start Frontend` — `npm run expo:dev` (port 8081)
