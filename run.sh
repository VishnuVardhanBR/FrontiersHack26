#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo "Dependencies are not installed. Run 'npm install' first."
  exit 1
fi

cleanup() {
  local exit_code=$?
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

"$ROOT_DIR/mc-server/start.sh" &
MC_PID=$!

sleep 8

npm run dev:server &
SERVER_PID=$!

sleep 2

npm run dev:bot &
BOT_PID=$!

npm run dev:frontend &
FRONTEND_PID=$!

wait
