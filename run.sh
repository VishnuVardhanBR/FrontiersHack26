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
tag_mlm()      { awk '{ print "\033[35m[mclm  ]\033[0m " $0 }'; }

LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

wait_for_http() {
  local url="$1"
  local name="$2"
  local timeout_seconds="${3:-40}"
  local started_at
  started_at=$(date +%s)

  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if [ $(( $(date +%s) - started_at )) -ge "$timeout_seconds" ]; then
      echo "Timed out waiting for $name at $url"
      return 1
    fi
    sleep 1
  done
}

wait_for_mc_ready() {
  local timeout_seconds="${1:-90}"
  local started_at
  started_at=$(date +%s)

  while true; do
    if [ -n "${MC_PID:-}" ] && ! kill -0 "$MC_PID" 2>/dev/null; then
      echo "Minecraft server process exited before becoming ready."
      tail -n 80 "$LOG_DIR/mc.log" || true
      return 1
    fi

    if grep -q "Done (" "$LOG_DIR/mc.log" 2>/dev/null; then
      return 0
    fi

    if [ $(( $(date +%s) - started_at )) -ge "$timeout_seconds" ]; then
      echo "Timed out waiting for Minecraft server to become ready."
      tail -n 80 "$LOG_DIR/mc.log" || true
      return 1
    fi
    sleep 2
  done
}

cleanup() {
  local exit_code=$?
  # Kill the awk prefix pipes; upstream npm processes receive SIGPIPE and exit too
  if [ -n "${FRONTEND_PID:-}" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [ -n "${BOT_PID:-}" ]; then kill "$BOT_PID" 2>/dev/null || true; fi
  if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  if [ -n "${MC_PID:-}" ]; then kill "$MC_PID" 2>/dev/null || true; fi
  if [ -n "${MLM_PID:-}" ]; then kill "$MLM_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

npm run build:shared

# ── MinecraftLM backend (structure generator) ──
echo "Starting MinecraftLM backend (port 8000) ..."
(cd "$ROOT_DIR/minecraftlm/backend" && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1) | tag_mlm &
MLM_PID=$!
wait_for_http "http://127.0.0.1:8000/health" "MinecraftLM" 30

if [ ! -f "$ROOT_DIR/mc-server/server.jar" ]; then
  "$ROOT_DIR/mc-server/setup.sh"
fi

# Minecraft server — redirect to log file; it is far too noisy for the terminal
echo "Starting Minecraft server (logs → .logs/mc.log) ..."
"$ROOT_DIR/mc-server/start.sh" > "$LOG_DIR/mc.log" 2>&1 &
MC_PID=$!
wait_for_mc_ready 90

npm run dev --workspace @quizcraft/server 2>&1 | tag_server &
SERVER_PID=$!
wait_for_http "http://127.0.0.1:3000/health" "server API" 45

npm run dev --workspace @quizcraft/bot 2>&1 | tag_bot &
BOT_PID=$!

npm run dev:frontend 2>&1 | tag_frontend &
FRONTEND_PID=$!

echo ""
echo "  \033[35m[mclm  ]\033[0m  http://localhost:8000"
echo "  \033[36m[server]\033[0m  http://localhost:3000"
echo "  \033[33m[vite  ]\033[0m  http://localhost:5173"
echo "  \033[0m[mc    ]\033[0m  localhost:25565  (logs in .logs/mc.log)"
echo ""

wait
