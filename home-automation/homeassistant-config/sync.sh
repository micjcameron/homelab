#!/usr/bin/env bash
set -euo pipefail

PI_HOST="micjcameron@192.168.1.128"
PI_HA_DIR="/home/micjcameron/homeassistant"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Files/dirs that stay on the Pi only (kept in sync with .gitignore)
RSYNC_EXCLUDES=(
  --exclude=secrets.yaml
  --exclude=.storage/
  --exclude=.storage.bak*
  --exclude=*.db
  --exclude=*.db-*
  --exclude=*.log
  --exclude=*.log.*
  --exclude=.HA_VERSION
  --exclude=.uuid
  --exclude=.cloud/
  --exclude=deps/
  --exclude=tts/
  --exclude=backups/
  --exclude=custom_components/
  --exclude=blueprints/automation/homeassistant/
  --exclude=blueprints/script/homeassistant/
  --exclude=sync.sh
)

usage() {
  echo "Usage: $0 <pull|push>"
  echo "  pull  Mirror tracked HA config files from Pi to repo"
  echo "  push  Mirror tracked HA config files from repo to Pi"
  exit 1
}

CMD="${1:-}"
[ -z "$CMD" ] && usage

case "$CMD" in
  pull)
    rsync -avz "${RSYNC_EXCLUDES[@]}" "${PI_HOST}:${PI_HA_DIR}/" "${SCRIPT_DIR}/"
    ;;
  push)
    rsync -avz "${RSYNC_EXCLUDES[@]}" "${SCRIPT_DIR}/" "${PI_HOST}:${PI_HA_DIR}/"
    echo
    echo "Reminder: restart Home Assistant for changes to take effect:"
    echo "  ssh ${PI_HOST} 'docker restart homeassistant'"
    ;;
  *)
    usage
    ;;
esac
