#!/data/data/com.termux/files/usr/bin/bash
# ======================================================
#   🤖 Jena Web GUI Launcher Script
# ======================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8080}"

echo "======================================================"
echo "  🤖 JENA — Autonomous AI Agent Web GUI"
echo "======================================================"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js install nahi hai. Termux mein 'pkg install nodejs' karein."
    exit 1
fi

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python3 install nahi hai. Termux mein 'pkg install python' karein."
    exit 1
fi

echo "🚀 Starting Jena Web Server on Port $PORT..."
echo "📱 Open in browser: http://localhost:$PORT"

# Try opening in browser if termux-open-url exists
if command -v termux-open-url &> /dev/null; then
    (sleep 1 && termux-open-url "http://localhost:$PORT") &
fi

exec node "$DIR/web/server.js" --port "$PORT"
