#!/usr/bin/env bash
set -euo pipefail

STACKS_DIR="$HOME/homelab/stacks"

if [ ! -d "$STACKS_DIR" ]; then
  echo "Stacks directory not found: $STACKS_DIR"
  exit 1
fi

# Safer fixed order for your setup
SERVICES=(
  matter-server
  mosquitto
  zigbee2mqtt
  homeassistant
  pihole
)

for SERVICE in "${SERVICES[@]}"; do
  COMPOSE_FILE="$STACKS_DIR/$SERVICE/docker-compose.yml"

  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Skipping $SERVICE - no compose file found"
    echo
    continue
  fi

  echo "========================================"
  echo "Processing: $SERVICE"
  echo "========================================"

  "$HOME/homelab/scripts/manage.sh" "$SERVICE"

  echo
  echo "Waiting 3 seconds before next service..."
  sleep 3
  echo
done

echo "All done."
