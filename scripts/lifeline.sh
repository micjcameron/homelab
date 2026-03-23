#!/usr/bin/env bash
set -u

LOGFILE="$HOME/lifeline.log"
STACKS_DIR="$HOME/homelab/stacks"
SERVICES_JSON="$HOME/homelab/services.json"
MANAGE_SCRIPT="$HOME/homelab/scripts/manage.sh"

BOT_TOKEN="8396572586:AAEpLuUDbZr0Z_XpdSlRFQ8nveFaxTAR-Lk"
CHAT_ID="8588606286"

send_telegram() {
  local msg="$1"
  [ -z "$BOT_TOKEN" ] && return 0
  [ -z "$CHAT_ID" ] && return 0

  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
       -d chat_id="${CHAT_ID}" \
       -d parse_mode=Markdown \
       --data-urlencode "text=${msg}" >/dev/null 2>&1 || true
}

log() {
  local DATE
  DATE=$(date '+%Y-%m-%d %H:%M:%S')
  echo "$DATE | $1" | tee -a "$LOGFILE"
}

TEMP_LIMIT=75
LOAD_LIMIT=2.5
DISK_LIMIT=90

DOCKER="docker"
if ! docker ps >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

for cmd in curl awk df jq; do
  command -v "$cmd" >/dev/null 2>&1 || log "⚠️ Missing command: $cmd"
done

TEMP=""
if command -v vcgencmd >/dev/null 2>&1; then
  TEMP=$(vcgencmd measure_temp | grep -Eo '[0-9]+\.[0-9]+' || echo "")
  if [[ -n "${TEMP}" ]] && command -v bc >/dev/null 2>&1; then
    if (( $(echo "$TEMP > $TEMP_LIMIT" | bc -l) )); then
      log "🔥 TEMP HIGH: ${TEMP}°C"
      send_telegram "🔥 *High temperature on $(hostname)*\nTemp: ${TEMP}°C"
    fi
  fi
fi

LOAD=$(awk '{print $1}' /proc/loadavg)
if command -v bc >/dev/null 2>&1; then
  if (( $(echo "$LOAD > $LOAD_LIMIT" | bc -l) )); then
    log "⚠️ HIGH LOAD: ${LOAD}"
    send_telegram "⚠️ *High load on $(hostname)*\nLoad: ${LOAD}"
  fi
fi

DISK=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ "$DISK" -gt "$DISK_LIMIT" ]]; then
  log "⚠️ DISK USAGE HIGH: ${DISK}%"
  send_telegram "⚠️ *Disk usage high on $(hostname)*\nDisk: ${DISK}% used"
fi

if ! systemctl is-active --quiet docker; then
  log "🚨 Docker service down → restarting..."
  send_telegram "🚨 *Docker service down on $(hostname)* → restarting..."
  sudo systemctl restart docker || true
  sleep 15
  if ! systemctl is-active --quiet docker; then
    log "🔥 Docker restart failed → rebooting Pi."
    send_telegram "🔥 *Docker restart failed on $(hostname)* → rebooting."
    sudo reboot
    exit 1
  fi
fi

if [ ! -f "$SERVICES_JSON" ]; then
  log "⚠️ Missing services.json: $SERVICES_JSON"
  exit 1
fi

jq -c '.services[] | select(.enabled == true)' "$SERVICES_JSON" | while read -r svc; do
  NAME=$(echo "$svc" | jq -r '.name')
  SPECIAL=$(echo "$svc" | jq -r '.special_check // empty')
  COMPOSE_FILE="$STACKS_DIR/$NAME/docker-compose.yml"

  if [ ! -f "$COMPOSE_FILE" ]; then
    log "⚠️ Service $NAME enabled in services.json but missing compose file"
    send_telegram "⚠️ *$(hostname)*: \`${NAME}\` enabled but compose file missing"
    continue
  fi

  if ! $DOCKER inspect "$NAME" >/dev/null 2>&1; then
    log "⚠️ Service $NAME missing → recreating"
    send_telegram "⚠️ *$(hostname)*: \`${NAME}\` missing → recreating"
    "$MANAGE_SCRIPT" "$NAME" >> "$LOGFILE" 2>&1 || true
    sleep 5
    continue
  fi

  STATE=$($DOCKER inspect -f '{{.State.Status}}' "$NAME" 2>/dev/null || echo "unknown")
  HEALTH=$($DOCKER inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$NAME" 2>/dev/null || echo "unknown")

  if [[ "$STATE" != "running" ]]; then
    log "⚠️ Service $NAME state=$STATE → recreating"
    send_telegram "⚠️ *$(hostname)*: \`${NAME}\` state=\`${STATE}\` → recreating"
    "$MANAGE_SCRIPT" "$NAME" >> "$LOGFILE" 2>&1 || true
    sleep 5
    continue
  fi

  if [[ "$HEALTH" == "unhealthy" ]]; then
    log "⚠️ Service $NAME unhealthy → recreating"
    send_telegram "⚠️ *$(hostname)*: \`${NAME}\` unhealthy → recreating"
    "$MANAGE_SCRIPT" "$NAME" >> "$LOGFILE" 2>&1 || true
    sleep 5
    continue
  fi

  case "$SPECIAL" in
    zigbee_bridge)
      if $DOCKER inspect mosquitto >/dev/null 2>&1; then
        Z2M_STATE=$($DOCKER exec mosquitto sh -lc "mosquitto_sub -t zigbee2mqtt/bridge/state -C 1 -W 3 2>/dev/null" || true)
        if [[ "$Z2M_STATE" != *"online"* ]]; then
          log "🚨 Zigbee2MQTT bridge not online: '${Z2M_STATE}' → recreating zigbee2mqtt"
          send_telegram "🚨 *$(hostname)*: Zigbee2MQTT bridge not online → recreating"
          "$MANAGE_SCRIPT" "zigbee2mqtt" >> "$LOGFILE" 2>&1 || true
        fi
      fi
      ;;
    pihole_dns)
      if ! $DOCKER exec pihole sh -lc "dig +short pi.hole >/dev/null 2>&1"; then
        log "⚠️ Pi-hole DNS unresponsive → recreating pihole"
        send_telegram "⚠️ *Pi-hole DNS unresponsive on $(hostname)* → recreating"
        "$MANAGE_SCRIPT" "pihole" >> "$LOGFILE" 2>&1 || true
      fi
      ;;
  esac
done

log "✅ Lifeline OK (Temp ${TEMP:-n/a}°C | Load ${LOAD} | Disk ${DISK}%)"