#!/usr/bin/env bash
set -u

MODE="${1:-}"
case "$MODE" in
  today|tomorrow) ;;
  *) echo "Usage: $0 today|tomorrow" >&2; exit 1 ;;
esac

# Telegram (same bot as parent-reminder)
BOT_TOKEN="8759872914:AAEyloXPmudiBTHfKc-rVxTNKVuCloNqod0"
CHAT_ID="8588606286"

# Home Assistant
HA_URL="${HA_URL:-http://localhost:8123}"
HA_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI4YWQwNDcyZDJhMWE0YWRmOTBhNzc5ZjE3MjNiZjEzMCIsImlhdCI6MTc4MDkxNDU3OCwiZXhwIjoyMDk2Mjc0NTc4fQ.o9Qev4tBhNM5qovTWU4jFCpHb9LNzBnMUgkysEoD3Xo"
CALENDAR_ENTITY="calendar.afvalbeheer_avri"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ] || [ -z "$HA_TOKEN" ]; then
  echo "BOT_TOKEN, CHAT_ID and HA_TOKEN must be set in $0" >&2
  exit 1
fi

case "$MODE" in
  today)
    START=$(date -d "today 00:00" -Iseconds)
    END=$(date -d "tomorrow 00:00" -Iseconds)
    HEADING="🗑️ Bin day today"
    ;;
  tomorrow)
    START=$(date -d "tomorrow 00:00" -Iseconds)
    END=$(date -d "day after tomorrow 00:00" -Iseconds)
    HEADING="🗑️ Bin day tomorrow"
    ;;
esac

EVENTS=$(curl -s -H "Authorization: Bearer ${HA_TOKEN}" \
  --get \
  --data-urlencode "start=${START}" \
  --data-urlencode "end=${END}" \
  "${HA_URL}/api/calendars/${CALENDAR_ENTITY}")

if ! echo "$EVENTS" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "Unexpected response from HA: $EVENTS" >&2
  exit 1
fi

TYPES=$(echo "$EVENTS" | jq -r '.[].summary' | paste -sd ', ' -)

[ -z "$TYPES" ] && exit 0

MSG="*${HEADING}*

${TYPES}"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d parse_mode=Markdown \
  --data-urlencode "text=${MSG}" >/dev/null
