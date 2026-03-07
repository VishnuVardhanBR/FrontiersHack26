#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Use MC_SERVER_JAR_SOURCE if set, otherwise look for server.jar inside mc-server/
JAR_SOURCE="${MC_SERVER_JAR_SOURCE:-$SCRIPT_DIR/server.jar}"
BOT_NAME="${QUIZCRAFT_BOT_NAME:-QuizCraftTutor}"
TARGET_JAR="$SCRIPT_DIR/server.jar"

if [ ! -f "$JAR_SOURCE" ]; then
  echo "Minecraft server jar not found."
  echo "  1. Download the server jar: https://www.minecraft.net/en-us/download/server"
  echo "  2. Save it as: $TARGET_JAR"
  echo "  Or set MC_SERVER_JAR_SOURCE to the path of your server.jar"
  exit 1
fi

if [ "$JAR_SOURCE" != "$TARGET_JAR" ]; then
  cp "$JAR_SOURCE" "$TARGET_JAR"
fi
cp "$SCRIPT_DIR/server.properties.template" "$SCRIPT_DIR/server.properties"
printf "eula=true\n" > "$SCRIPT_DIR/eula.txt"

BOT_UUID="$(
  node <<'NODE'
const crypto = require('node:crypto');
const username = process.env.BOT_NAME ?? 'QuizCraftTutor';
const digest = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
digest[6] = (digest[6] & 0x0f) | 0x30;
digest[8] = (digest[8] & 0x3f) | 0x80;
const hex = digest.toString('hex');
console.log(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
NODE
)"

cat > "$SCRIPT_DIR/ops.json" <<JSON
[
  {
    "uuid": "$BOT_UUID",
    "name": "$BOT_NAME",
    "level": 4,
    "bypassesPlayerLimit": true
  }
]
JSON

echo "Minecraft server configured in $SCRIPT_DIR"
