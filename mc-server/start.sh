#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f server.jar ]; then
  echo "server.jar is missing. Run ./mc-server/setup.sh first."
  exit 1
fi

exec java -Xms1G -Xmx2G -jar server.jar nogui
