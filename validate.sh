#!/usr/bin/env bash
# Quick check that services the stack needs are reachable.
# Run this before or after starting services to see what's up.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

check_port() {
  local host="$1"
  local port="$2"
  local name="$3"
  if (echo >/dev/tcp/"$host"/"$port") 2>/dev/null; then
    echo "  OK   $name ($host:$port)"
    return 0
  else
    echo "  --   $name ($host:$port) not reachable"
    return 1
  fi
}

# Use a small timeout; bash's /dev/tcp may not exist on macOS
check_port_nc() {
  local host="$1"
  local port="$2"
  local name="$3"
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w 2 "$host" "$port" 2>/dev/null; then
      echo "  OK   $name ($host:$port)"
      return 0
    fi
  fi
  echo "  --   $name ($host:$port) not reachable"
  return 1
}

echo "QuizCraft service check"
echo "----------------------"

MC_HOST="${QUIZCRAFT_MC_HOST:-${MC_HOST:-127.0.0.1}}"
MC_PORT="${QUIZCRAFT_MC_PORT:-${MC_PORT:-25565}}"
API_HOST="${VITE_API_BASE_URL:-http://127.0.0.1:3000}"

# Parse host from URL if needed
API_HOST_ONLY="127.0.0.1"
API_PORT="3000"
if [[ "$API_HOST" =~ ^https?://([^:/]+)(:([0-9]+))? ]]; then
  API_HOST_ONLY="${BASH_REMATCH[1]}"
  API_PORT="${BASH_REMATCH[3]:-3000}"
fi

MC_OK=0
API_OK=0
check_port_nc "$MC_HOST" "$MC_PORT" "Minecraft server" || MC_OK=1
check_port_nc "$API_HOST_ONLY" "$API_PORT" "API server" || API_OK=1

echo "----------------------"
if [[ $MC_OK -eq 0 && $API_OK -eq 0 ]]; then
  echo "All required services are up. You can run the bot and use the frontend."
  exit 0
fi
if [[ $API_OK -ne 0 ]]; then
  echo "Start the API: npm run dev:server"
fi
if [[ $MC_OK -ne 0 ]]; then
  echo "Start Minecraft: ./mc-server/start.sh  (run ./mc-server/setup.sh first if needed)"
fi
echo ""
echo "Full stack: ./run.sh  (starts MC, API, bot, frontend in order)"
exit 1
