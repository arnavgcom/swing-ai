#!/bin/bash

LOG_DIR="/Users/vikramgupta/workspace/logs"
mkdir -p $LOG_DIR

TENNEX_DIR="/Users/vikramgupta/workspace/tennex"
mkdir -p $TENNEX_DIR

#echo "Starting ngrok"
#nohup ngrok http 5001 > $LOG_DIR/ngrok.log 2>&1 &

#echo "Starting OpenClaw"
#nohup openclaw gateway restart > $LOG_DIR/openclaw.log 2>&1 &

#echo "Starting MCP for tennex-webapp..."
#cd $TENNEX_DIR/mcp/mcp-server-app
#nohup npm start > $LOG_DIR/mcp_server-tennex-webapp.log 2>&1 &

#echo "Starting MCP for tennex-db..."
#cd $TENNEX_DIR/mcp/mcp-server-db
#nohup npm start > $LOG_DIR/mcp_server-tennex-db.log 2>&1 &

#echo "Starting MCP for info..."
#cd $TENNEX_DIR/mcp/mcp-server-info
#nohup npm start > $LOG_DIR/mcp_server-info.log 2>&1 &

#echo "Starting AI Analyzer (Backend Codex)..."
#cd /Users/vikramgupta/workspace/tennis-forehand-analytics/backend
#source .venv/bin/activate
#nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > $LOG_DIR/ai_analyzer_backend_codex.log 2>&1 &

#echo "Starting AI Analyzer (UI Codex)..."
#cd /Users/vikramgupta/workspace/tennis-forehand-analytics/frontend
#nohup npm run dev > $LOG_DIR/ai_analyzer_UI_codex.log 2>&1 &

echo "Starting Postgres"
LC_ALL="en_US.UTF-8"
nohup /opt/homebrew/opt/postgresql@16/bin/postgres -D /opt/homebrew/var/postgresql@16 > $LOG_DIR/postgres.log 2>&1 &

echo "Starting Swing AI Backend"
export PYTHON_EXECUTABLE=/Users/vikramgupta/workspace/swing-ai/.venv/bin/python3
export DATABASE_URL='postgres://swing_ai:swing_ai@localhost:5432/swing_ai_local'
export PORT=5001
cd /Users/vikramgupta/workspace/swing-ai
nohup npm run server:dev > $LOG_DIR/swing_ai_backend.log 2>&1 &

echo "Starting Swing AI Frontend"
IP_ADDRESS=`ipconfig getifaddr en0`
export EXPO_PUBLIC_API_URL=http://$IP_ADDRESS:5001 
cd /Users/vikramgupta/workspace/swing-ai
#nohup npm run start > $LOG_DIR/swing_ai_frontend.log 2>&1 &
nohup npm run web:local > $LOG_DIR/swing_ai_webfrontend.log 2>&1 &

#echo "Starting Tennex Sports App"
#export DATABASE_URL='postgres://neondb_owner:npg_YuO2Nmnxe0sq@localhost:5432/tennex-sports-app_local'
#export PORT=5002
#cd /Users/vikramgupta/workspace/tennex/tennex-sports-app
#nohup npm run dev > $LOG_DIR/tennex_sports_app.log 2>&1 &

echo "All services started in background."

echo ""
echo ""
#echo "Check Ngrok status: http://127.0.0.1:4040/status"
#echo "My public url (forwarded to port 5001): https://tyrell-readjustable-illy.ngrok-free.dev"
#echo ""
#echo "Forehand Analyzer: http://localhost:5173"
echo "Swing AI: http://localhost:5001 (Check on Expo) or http://localhost:8081"
#echo "Tennex Sports App: http://localhost:5002"

echo ""
echo ""

