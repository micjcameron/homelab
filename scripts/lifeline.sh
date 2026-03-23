#!/bin/bash
# === Raspberry Pi Lifeline Monitor ===
set -u

LOGFILE="/home/micjcameron/lifeline.log"

# Telegram config (rotate token if leaked anywhere)
BOT_TOKEN="8396572586:AAEpLuUDbZr0Z_XpdSlRFQ8nveFaxTAR-Lk"
CHAT_ID="8588606286"

send_telegram() {
  local msg="$1"
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

# thresholds
TEMP_LIMIT=75
LOAD_LIMIT=2.5
DISK_LIMIT=90

# Containers to enforce
CONTAINERS=("pihole" "mosquitto" "zigbee2mqtt" "homeassistant" "matter-server")

# Detect docker command (some setups require sudo)
DOCKER="docker"
if ! docker ps >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

# 0) basic deps check (optional, but useful)
for cmd in curl awk df; do
  command -v "$cmd" >/dev/null 2>&1 || log "⚠️ Missing command: $cmd"
done

# 1) temperature (vcgencmd exists on Raspberry Pi OS)
if command -v vcgencmd >/dev/null 2>&1; then
  TEMP=$(vcgencmd measure_temp | egrep -o '[0-9]*\.[0-9]*' || echo "")
  if [[ -n "${TEMP}" ]] && command -v bc >/dev/null 2>&1; then
    if (( $(echo "$TEMP > $TEMP_LIMIT" | bc -l) )); then
      log "🔥 TEMP HIGH: ${TEMP}°C"
      send_telegram "🔥 *High temperature on $(hostname)*\nTemp: ${TEMP}°C"
    fi
  fi
fi

# 2) system load
LOAD=$(awk '{print $1}' /proc/loadavg)
if command -v bc >/dev/null 2>&1; then
  if (( $(echo "$LOAD > $LOAD_LIMIT" | bc -l) )); then
    log "⚠️ HIGH LOAD: ${LOAD}"
    send_telegram "⚠️ *High load on $(hostname)*\nLoad: ${LOAD}"
  fi
fi

# 3) disk usage
DISK=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ "$DISK" -gt "$DISK_LIMIT" ]]; then
  log "⚠️ DISK USAGE HIGH: ${DISK}%"
  send_telegram "⚠️ *Disk usage high on $(hostname)*\nDisk: ${DISK}% used"
fi

# 4) docker service
if ! systemctl is-active --quiet docker; then
  log "🚨 Docker service down → restarting..."
  send_telegram "🚨 *Docker service down on $(hostname)* → restarting..."
  sudo systemctl restart docker || true
  sleep 15
  if ! systemctl is-active --quiet docker; then
    log "🔥 Docker restart failed → rebooting Pi."
    send_telegram "🔥 *Docker restart failed on $(hostname)* → rebooting."
    sudo reboot
  fi
fi

# 5) containers (restart non-running or unhealthy)
for c in "${CONTAINERS[@]}"; do
  if ! $DOCKER inspect "$c" >/dev/null 2>&1; then
    log "⚠️ Container $c missing (not found)"
    send_telegram "⚠️ *$(hostname)*: Container \`${c}\` missing (not found)"
    continue
  fi

  STATE=$($DOCKER inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "unknown")
  HEALTH=$($DOCKER inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c" 2>/dev/null || echo "unknown")

  if [[ "$STATE" != "running" ]]; then
    log "⚠️ Container $c state=$STATE → restarting..."
    send_telegram "⚠️ *$(hostname)*: \`${c}\` state=\`${STATE}\` → restarting"
    $DOCKER restart "$c" >/dev/null 2>&1 || true
    sleep 3
    continue
  fi

  if [[ "$HEALTH" == "unhealthy" ]]; then
    log "⚠️ Container $c unhealthy → restarting..."
    send_telegram "⚠️ *$(hostname)*: \`${c}\` unhealthy → restarting"
    $DOCKER restart "$c" >/dev/null 2>&1 || true
    sleep 3
  fi
done

# 6) Zigbee2MQTT must be ONLINE (this catches "running but dead" cases)
# Uses mosquitto_sub inside the mosquitto container (since host doesn't have mosquitto tools installed)
Z2M_STATE=$($DOCKER exec mosquitto sh -lc "mosquitto_sub -t zigbee2mqtt/bridge/state -C 1 -W 3 2>/dev/null" || true)
if [[ "$Z2M_STATE" != *"online"* ]]; then
  log "🚨 Zigbee2MQTT bridge not online: '${Z2M_STATE}' → restarting zigbee2mqtt"
  send_telegram "🚨 *$(hostname)*: Zigbee2MQTT not online → restarting zigbee2mqtt"
  $DOCKER restart zigbee2mqtt >/dev/null 2>&1 || true
fi

# 7) Optional: check dongle presence (enable if you want)
# DONGLE="/dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_0aae22d4de2bef11a0025a88dfbc56eb-if00-port0"
# if [[ ! -e "$DONGLE" ]]; then
#   log "🚨 Zigbee dongle missing: $DONGLE"
#   send_telegram "🚨 *$(hostname)*: Zigbee dongle missing:\n\`${DONGLE}\`"
# fi

# 8) Pi-hole DNS check (optional)
if $DOCKER ps --format '{{.Names}}' | grep -q "^pihole$"; then
  if ! $DOCKER exec pihole sh -lc "dig +short pi.hole >/dev/null 2>&1"; then
    log "⚠️ Pi-hole DNS unresponsive → restarting container."
    send_telegram "⚠️ *Pi-hole DNS unresponsive on $(hostname)* → restarting..."
    $DOCKER restart pihole >/dev/null 2>&1 || true
  fi
fi

log "✅ Lifeline OK (Temp ${TEMP:-n/a}°C | Load ${LOAD} | Disk ${DISK}%)"
