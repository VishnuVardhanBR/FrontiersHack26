#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f server.jar ]; then
  echo "server.jar is missing. Run ./mc-server/setup.sh first."
  exit 1
fi

# Delete old world so every launch starts with a fresh flat world
rm -rf world world_nether world_the_end

# Re-apply template so server.properties always reflects the latest settings
cp -f "$SCRIPT_DIR/server.properties.template" "$SCRIPT_DIR/server.properties"

exec java -Xms1G -Xmx2G -jar server.jar nogui
