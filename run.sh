#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo "Dependencies are not installed. Run 'npm install' first."
  exit 1
fi

# Colored tag prefixes (awk is unbuffered by default on macOS/Linux)
tag_server()   { awk '{ print "\033[36m[server]\033[0m " $0 }'; }
tag_bot()      { awk '{ print "\033[32m[bot   ]\033[0m " $0 }'; }
tag_frontend() { awk '{ print "\033[33m[vite  ]\033[0m " $0 }'; }

LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

cleanup() {
  local exit_code=$?
  # Kill the awk prefix pipes; upstream npm processes receive SIGPIPE and exit too
  if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [ -n "${BOT_PID:-}" ]; then kill "$BOT_PID" 2>/dev/null || true; fi
  if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  if [ -n "${MC_PID:-}" ]; then kill "$MC_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

npm run build:shared

if [ ! -f "$ROOT_DIR/mc-server/server.jar" ]; then
  "$ROOT_DIR/mc-server/setup.sh"
fi

# Minecraft server — redirect to log file; it is far too noisy for the terminal
echo "Starting Minecraft server (logs → .logs/mc.log) ..."
"$ROOT_DIR/mc-server/start.sh" > "$LOG_DIR/mc.log" 2>&1 &
MC_PID=$!

sleep 8

npm run dev:server 2>&1 | tag_server &
SERVER_PID=$!

sleep 2

npm run dev:bot 2>&1 | tag_bot &
BOT_PID=$!

npm run dev:frontend 2>&1 | tag_frontend &
FRONTEND_PID=$!

echo ""
echo "  \033[36m[server]\033[0m  http://localhost:3000"
echo "  \033[33m[vite  ]\033[0m  http://localhost:5173"
echo "  \033[0m[mc    ]\033[0m  localhost:25565  (logs in .logs/mc.log)"
echo ""

wait
