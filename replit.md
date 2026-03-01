# CourtVision — Tennis Forehand Performance Analysis

## Architecture

- **Frontend**: Expo React Native (port 8081) — 3-tab layout (Dashboard, Upload/Analyze, History), Analysis Detail screen
- **Backend**: Express/Node.js (port 5000) — REST API for uploads, analysis CRUD, static landing page
- **Database**: Replit PostgreSQL via Drizzle ORM — stores analyses, metrics, coaching_insights tables
- **Video Storage**: Local `uploads/` folder on Replit filesystem
- **ML Pipeline**: Python 3.11 with OpenCV (frame extraction), MediaPipe Tasks API v0.10.32 (pose detection), HSV ball tracking

## Data Storage

All data is stored entirely on Replit:
- **Videos**: Saved to `uploads/` directory via multer disk storage
- **Metrics + Analysis**: PostgreSQL tables (`analyses`, `metrics`, `coaching_insights`) via `DATABASE_URL`

## Key Files

### Backend
- `server/index.ts` — Express app entry point (port 5000)
- `server/routes.ts` — API routes: POST /api/upload, GET /api/analyses, GET /api/analyses/:id, DELETE /api/analyses/:id
- `server/analysis-engine.ts` — Calls Python analysis via child_process.execFile, stores results in DB
- `server/storage.ts` — DatabaseStorage class (Drizzle ORM CRUD operations)
- `server/db.ts` — Drizzle PostgreSQL connection

### Python Analysis
- `python_analysis/run_analysis.py` — CLI entry point, outputs JSON to stdout
- `python_analysis/analyzer.py` — ForehandAnalyzer: orchestrates pose detection + ball tracking, computes all metrics and coaching insights
- `python_analysis/pose_detector.py` — PoseDetector using MediaPipe Tasks API (PoseLandmarker)
- `python_analysis/ball_tracker.py` — BallTracker using HSV contour detection
- `models/pose_landmarker_lite.task` — MediaPipe pose model file

### Frontend
- `app/(tabs)/_layout.tsx` — Tab navigator (Dashboard, Upload, History)
- `app/(tabs)/index.tsx` — Dashboard tab
- `app/(tabs)/upload.tsx` — Video upload + analysis trigger
- `app/(tabs)/history.tsx` — Analysis history list
- `app/analysis/[id].tsx` — Analysis detail screen
- `components/` — ScoreGauge, MetricCard, SubScoreBar, CoachingCard, AnalysisCard
- `lib/query-client.ts` — React Query client with API URL configuration

### Schema
- `shared/schema.ts` — Drizzle schema: analyses, metrics, coaching_insights tables

## Metrics Computed

- Wrist Speed, Elbow Angle, Shoulder Rotation Velocity
- Balance/Stability Score, Shot Consistency, Rhythm Consistency
- Ball Speed, Trajectory Arc, Spin Estimation
- Timing: Backswing Duration, Contact Timing, Follow-Through Duration
- Sub-scores: Power, Stability, Timing, Follow-Through (each 0-100)
- Overall Forehand Performance Score (0-100), weighted formula: 30% racket speed + 20% rotation + 20% contact consistency + 15% balance + 15% follow-through

## Dependencies

- **Node**: express, multer, drizzle-orm, @tanstack/react-query, expo-router
- **Python**: opencv-python-headless, mediapipe (0.10.32), numpy

## Workflows

- `Start Backend` — `npm run server:dev` (port 5000)
- `Start Frontend` — `npm run expo:dev` (port 8081)
