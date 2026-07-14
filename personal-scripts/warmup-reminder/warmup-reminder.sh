#!/usr/bin/env bash
# Daily Telegram nudge to warm up michael@camcosolutions.net by hand.
# Warmup is manual on purpose — Gmail scores genuine human engagement (replies,
# "not spam"), which a script can't fake. This only reminds you to do it.
# Scheduled from cron/crontab. Same pattern as parent-reminder.sh.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Secrets live in personal-scripts/.env (gitignored), never in this file.
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

# Reuse the parent-reminder bot by default; set WARMUP_BOT_TOKEN in .env for a dedicated one.
BOT_TOKEN="${WARMUP_BOT_TOKEN:-${PARENT_BOT_TOKEN:-}}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# ---- Config (override in .env if you like) ----
WARMUP_START="${WARMUP_START:-2026-07-15}"   # first warmup day, YYYY-MM-DD
WARMUP_DAYS="${WARMUP_DAYS:-14}"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "Need WARMUP_BOT_TOKEN (or PARENT_BOT_TOKEN) and TELEGRAM_CHAT_ID in $ENV_FILE" >&2
  exit 1
fi

START_TS=$(date -d "$WARMUP_START" +%s 2>/dev/null) || { echo "Bad WARMUP_START: $WARMUP_START" >&2; exit 1; }
NOW_TS=$(date +%s)
DAY=$(( (NOW_TS - START_TS) / 86400 + 1 ))

[ "$DAY" -lt 1 ] && exit 0   # not started yet

send() {
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d chat_id="${CHAT_ID}" -d parse_mode=Markdown \
    --data-urlencode "text=${1}" >/dev/null
}

# One completion nudge the day after the window, then silent.
if [ "$DAY" -gt "$WARMUP_DAYS" ]; then
  if [ "$DAY" -eq $((WARMUP_DAYS + 1)) ]; then
    send "*✅ Email warmup complete — michael@camcosolutions.net*

${WARMUP_DAYS} clean days done. Now:
• Tighten DMARC on both domains from p=none to *p=quarantine* (Cloudflare → DNS → _dmarc)
• Start cold sends at *3–4/day*, keep ramping slowly
• Remove the warmup line from cron/crontab (or leave it — it's silent from here)

Checklist: personal-scripts/warmup-reminder/checklist.md"
  fi
  exit 0
fi

# Volume ramps over the two weeks
if   [ "$DAY" -le 3 ];  then TARGET=3; LINKS="no links or attachments yet"
elif [ "$DAY" -le 7 ];  then TARGET=4; LINKS="no links or attachments yet"
elif [ "$DAY" -le 11 ]; then TARGET=6; LINKS="one link OK now, no attachments"
else                          TARGET=8; LINKS="one link OK, no attachments"
fi

send "*📧 Email warmup — Day ${DAY}/${WARMUP_DAYS}*
Mailbox: michael@camcosolutions.net (~5 min)

• Send *${TARGET}* short, plain-text emails to real people (friends + your Gmail + info@)
• *Reply* to every warmup thread in the inbox — replies matter most, go 2–3 deep
• Check *Spam* + *Promotions* → \"Not spam\" / drag to Primary
• Vary subjects & wording; ${LINKS}
• Spread across the day, not all at once

Checklist: personal-scripts/warmup-reminder/checklist.md"
