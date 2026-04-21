#!/bin/bash
# ---------------------------------------------------------------------------
# start-all.sh — Start Postgres, Swing AI backend, and Swing AI frontend
# Run from anywhere; paths are resolved relative to the repo root.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

# ── Kill stale processes ──────────────────────────────────────────────────────
echo "Cleaning up stale processes…"
"$SCRIPT_DIR/stop-all.sh" 2>/dev/null || true
sleep 1

# ── Postgres ──────────────────────────────────────────────────────────────────
echo "Starting Postgres"
export LC_ALL="en_US.UTF-8"
nohup /opt/homebrew/opt/postgresql@16/bin/postgres \
  -D /opt/homebrew/var/postgresql@16 \
  > "$LOG_DIR/postgres.log" 2>&1 &

# ── Swing AI Backend (Express + Python analysis) ─────────────────────────────
echo "Starting Swing AI Backend"
export PYTHON_EXECUTABLE="$REPO_ROOT/packages/server/.venv/bin/python3"
export DATABASE_URL='postgres://swing_ai:swing_ai@localhost:5432/swing_ai_local'
export PORT=5001

cd "$REPO_ROOT"
nohup npm run server:dev > "$LOG_DIR/swing_ai_backend.log" 2>&1 &

# ── Swing AI Frontend (Expo Metro bundler) ────────────────────────────────────
echo "Starting Expo Metro Bundler"
IP_ADDRESS=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
# For native apps, API URL points directly to the backend
export EXPO_PUBLIC_API_URL="http://$IP_ADDRESS:5001"

cd "$REPO_ROOT"
nohup npm run app:web > "$LOG_DIR/swing_ai_webfrontend.log" 2>&1 &

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "All services started in background."
echo "  Web App:  http://localhost:5001  (same-origin, proxied through Express)"
echo "  Metro:    http://localhost:8081  (Expo dev server, for native builds)"
echo "  Backend:  http://localhost:5001"
echo "  Logs:     $LOG_DIR/"
echo ""

