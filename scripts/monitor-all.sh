#!/bin/bash
# ---------------------------------------------------------------------------
# monitor-all.sh — Show running Swing AI processes
# ---------------------------------------------------------------------------
echo "=== Swing AI Processes ==="
echo ""

echo "Backend (tsx/node):"
ps aux | grep -E "tsx.*server|node.*server" | grep -v grep || echo "  (not running)"
echo ""

echo "Frontend (expo):"
ps aux | grep -E "expo" | grep -v grep || echo "  (not running)"
echo ""

echo "Postgres:"
ps aux | grep "postgres" | grep -v grep | head -1 || echo "  (not running)"
echo ""
