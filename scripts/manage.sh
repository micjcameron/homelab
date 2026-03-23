#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-}"

if [ -z "$SERVICE" ]; then
  echo "Usage: $0 <service-name>"
  echo "Example: $0 mosquitto"
  exit 1
fi

COMPOSE_FILE="$HOME/homelab/stacks/$SERVICE/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "No compose file found for service: $SERVICE"
  echo "Expected: $COMPOSE_FILE"
  exit 1
fi

echo "=== Managing service: $SERVICE ==="
echo "Compose file: $COMPOSE_FILE"
echo

echo "Stopping/removing existing container named $SERVICE if present..."
docker stop "$SERVICE" 2>/dev/null || true
docker rm "$SERVICE" 2>/dev/null || true

echo
echo "Starting service from compose..."
docker compose -f "$COMPOSE_FILE" up -d

echo
echo "Container status:"
docker ps --filter "name=^/${SERVICE}$"

echo
echo "Mounts:"
docker inspect "$SERVICE" -f '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' 2>/dev/null || true

echo
echo "Last logs:"
docker logs --tail=50 "$SERVICE" 2>/dev/null || true
