#!/bin/bash
# === Raspberry Pi Daily Status (Telegram) ===
set -u

BOT_TOKEN="8396572586:AAEpLuUDbZr0Z_XpdSlRFQ8nveFaxTAR-Lk"
CHAT_ID="8588606286"

HOST=$(hostname)
TEMP="n/a"
if command -v vcgencmd >/dev/null 2>&1; then
  TEMP=$(vcgencmd measure_temp | egrep -o '[0-9]*\.[0-9]*' || echo "n/a")
fi

LOAD1=$(awk '{print $1}' /proc/loadavg)
DISK=$(df -h / | awk 'NR==2 {print $5}')
MEM=$(free -m | awk '/Mem:/ {printf "%d/%d MB (%.0f%%)", $3,$2, ($3/$2)*100}')
UPTIME=$(uptime -p)

# Detect docker command
DOCKER="docker"
if ! docker ps >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

# Container list (name + status)
CONTAINERS=$($DOCKER ps --format "- {{.Names}} ({{.Status}})" 2>/dev/null)
[ -z "$CONTAINERS" ] && CONTAINERS="(none)"

MSG="Daily Report: ${HOST}
Uptime: ${UPTIME}
Temp: ${TEMP} C
Load (1m): ${LOAD1}
Disk (/): ${DISK}
Memory: ${MEM}
Containers:
${CONTAINERS}
"

curl -v -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d parse_mode=Markdown \
  --data-urlencode "text=${MSG}"
