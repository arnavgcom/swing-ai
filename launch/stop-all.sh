pkill -f "node.*" && echo "✓ Server stopped"
pkill -f "uvicorn.*" && echo "✓ Services stopped"
pkill -f "postgres.*" && echo "✓ Postgres stopped"
pkill -f "ngrok.*" && echo "✓ Ngrok stopped"
