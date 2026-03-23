#!/usr/bin/env bash
set -euo pipefail

STACKS_DIR="$HOME/homelab/stacks"
SERVICES_JSON="$HOME/homelab/services.json"

run_service() {
  local SERVICE="$1"
  local COMPOSE_FILE="$STACKS_DIR/$SERVICE/docker-compose.yml"

  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "No compose file found for service: $SERVICE"
    echo "Expected: $COMPOSE_FILE"
    return 1
  fi

  echo "========================================"
  echo "Managing service: $SERVICE"
  echo "========================================"

  docker stop "$SERVICE" 2>/dev/null || true
  docker rm "$SERVICE" 2>/dev/null || true
  docker compose -f "$COMPOSE_FILE" up -d

  echo
  docker ps --filter "name=^/${SERVICE}$"
  echo
  docker logs --tail=30 "$SERVICE" 2>/dev/null || true
  echo
}

run_all() {
  if [ ! -f "$SERVICES_JSON" ]; then
    echo "Missing services.json: $SERVICES_JSON"
    exit 1
  fi

  jq -r '.services | sort_by(.order)[] | select(.enabled == true) | .name' "$SERVICES_JSON" | while read -r SERVICE; do
    [ -z "$SERVICE" ] && continue
    run_service "$SERVICE"
    sleep 3
  done
}

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 <service-name|all>"
  exit 1
fi

if [ "$TARGET" = "all" ]; then
  run_all
else
  run_service "$TARGET"
fi