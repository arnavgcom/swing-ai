#!/bin/bash
# ---------------------------------------------------------------------------
# restart-all.sh — Stop then start all services
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$SCRIPT_DIR/stop-all.sh"
sleep 1
bash "$SCRIPT_DIR/start-all.sh"
bash "$SCRIPT_DIR/monitor-all.sh"
