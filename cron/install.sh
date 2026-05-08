#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRONTAB_FILE="$SCRIPT_DIR/crontab"

if [ ! -f "$CRONTAB_FILE" ]; then
  echo "Missing crontab file: $CRONTAB_FILE" >&2
  exit 1
fi

echo "Installing crontab from $CRONTAB_FILE..."
crontab "$CRONTAB_FILE"

echo
echo "Active crontab:"
crontab -l
