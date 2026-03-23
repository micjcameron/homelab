#!/usr/bin/env bash
set -u

BOT_TOKEN="8396572586:AAEpLuUDbZr0Z_XpdSlRFQ8nveFaxTAR-Lk"
CHAT_ID="8588606286"

HOST=$(hostname)
SERVICES_JSON="$HOME/homelab/services.json"
STACKS_DIR="$HOME/homelab/stacks"

TEMP="n/a"
if command -v vcgencmd >/dev/null 2>&1; then
  TEMP=$(vcgencmd measure_temp | grep -Eo '[0-9]+\.[0-9]+' || echo "n/a")
fi

LOAD1=$(awk '{print $1}' /proc/loadavg)
DISK=$(df -h / | awk 'NR==2 {print $5}')
MEM=$(free -m | awk '/Mem:/ {printf "%d/%d MB (%.0f%%)", $3,$2, ($3/$2)*100}')
UPTIME=$(uptime -p)

DOCKER="docker"
if ! docker ps >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

EXPECTED_SERVICES="(services.json missing)"
if [ -f "$SERVICES_JSON" ] && command -v jq >/dev/null 2>&1; then
  EXPECTED_SERVICES=$(jq -r '.services | sort_by(.order)[] | select(.enabled == true) | .name' "$SERVICES_JSON" | sed 's/^/- /')
  [ -z "$EXPECTED_SERVICES" ] && EXPECTED_SERVICES="(none enabled)"
fi

RUNNING_CONTAINERS=$($DOCKER ps --format '- {{.Names}} ({{.Status}})' 2>/dev/null)
[ -z "$RUNNING_CONTAINERS" ] && RUNNING_CONTAINERS="(none)"

EXPECTED_STATUS=""
if [ -f "$SERVICES_JSON" ] && command -v jq >/dev/null 2>&1; then
  while IFS= read -r SERVICE; do
    [ -z "$SERVICE" ] && continue

    COMPOSE_FILE="$STACKS_DIR/$SERVICE/docker-compose.yml"

    if [ ! -f "$COMPOSE_FILE" ]; then
      EXPECTED_STATUS="${EXPECTED_STATUS}- ${SERVICE}: compose file missing"$'\n'
      continue
    fi

    if ! $DOCKER inspect "$SERVICE" >/dev/null 2>&1; then
      EXPECTED_STATUS="${EXPECTED_STATUS}- ${SERVICE}: missing container"$'\n'
      continue
    fi

    STATE=$($DOCKER inspect -f '{{.State.Status}}' "$SERVICE" 2>/dev/null || echo "unknown")
    HEALTH=$($DOCKER inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$SERVICE" 2>/dev/null || echo "unknown")

    if [ "$HEALTH" = "none" ]; then
      EXPECTED_STATUS="${EXPECTED_STATUS}- ${SERVICE}: ${STATE}"$'\n'
    else
      EXPECTED_STATUS="${EXPECTED_STATUS}- ${SERVICE}: ${STATE} (health: ${HEALTH})"$'\n'
    fi
  done < <(jq -r '.services | sort_by(.order)[] | select(.enabled == true) | .name' "$SERVICES_JSON")
else
  EXPECTED_STATUS="(unable to evaluate expected services)"
fi

MSG="*Daily Report: ${HOST}*
Uptime: ${UPTIME}
Temp: ${TEMP}°C
Load (1m): ${LOAD1}
Disk (/): ${DISK}
Memory: ${MEM}

*Expected Services*
${EXPECTED_SERVICES}

*Expected Service Status*
${EXPECTED_STATUS}

*Running Containers*
${RUNNING_CONTAINERS}
"

if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d chat_id="${CHAT_ID}" \
    -d parse_mode="Markdown" \
    --data-urlencode "text=${MSG}" >/dev/null 2>&1 || true
else
  echo "$MSG"
fi