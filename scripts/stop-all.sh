#!/bin/bash
# ---------------------------------------------------------------------------
# stop-all.sh — Stop all Swing AI services
# ---------------------------------------------------------------------------

# Backend (port 5001 or tsx server process)
lsof -ti TCP:5001 -sTCP:LISTEN | xargs kill 2>/dev/null \
  || pkill -f "tsx.*server" 2>/dev/null
[[ $? -eq 0 ]] && echo "✓ Backend stopped" || echo "· Backend not running"

# Frontend (port 8081 or expo process)
lsof -ti TCP:8081 -sTCP:LISTEN | xargs kill 2>/dev/null \
  || pkill -f "expo.*start" 2>/dev/null
[[ $? -eq 0 ]] && echo "✓ Frontend stopped" || echo "· Frontend not running"

# Postgres
pkill -f "postgres" 2>/dev/null && echo "✓ Postgres stopped" || echo "· Postgres not running"
