#!/usr/bin/env bash
set -u

MODE="${1:-}"
case "$MODE" in
  today|tomorrow) ;;
  *) echo "Usage: $0 today|tomorrow" >&2; exit 1 ;;
esac

# Secrets live in personal-scripts/.env (gitignored), never in this file.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

# Telegram
BOT_TOKEN="${BIN_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Home Assistant
HA_URL="${HA_URL:-http://localhost:8123}"
HA_TOKEN="${HA_TOKEN:-}"
CALENDAR_ENTITY="calendar.afvalbeheer_avri"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ] || [ -z "$HA_TOKEN" ]; then
  echo "BIN_BOT_TOKEN, TELEGRAM_CHAT_ID and HA_TOKEN must be set in $ENV_FILE" >&2
  exit 1
fi

case "$MODE" in
  today)
    START=$(date -d "today 00:00" -Iseconds)
    # End at 23:59:59 of the same day, NOT next-day 00:00 — HA's calendar API
    # treats the window end as inclusive, so next-day-midnight pulled in the
    # following day's all-day event and made every reminder fire a day early.
    END=$(date -d "today 23:59:59" -Iseconds)
    HEADING="🗑️ Bin day today"
    ;;
  tomorrow)
    START=$(date -d "tomorrow 00:00" -Iseconds)
    END=$(date -d "tomorrow 23:59:59" -Iseconds)
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
