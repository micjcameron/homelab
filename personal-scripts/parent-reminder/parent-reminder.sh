#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUOTES_FILE="$SCRIPT_DIR/quotes.txt"

# Fill these in after creating a new bot via @BotFather
BOT_TOKEN="8178294552:AAHeOFiqXdEct3bN5kEuF9yIqgDXj6WIMwk"
CHAT_ID="8588606286"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "BOT_TOKEN and CHAT_ID must be set in $0" >&2
  exit 1
fi

if [ ! -f "$QUOTES_FILE" ]; then
  echo "Missing quotes file: $QUOTES_FILE" >&2
  exit 1
fi

HOUR=$(date +%H)
case "$HOUR" in
  05|06|07|08|09) HEADING="🌅 Morning reminder" ;;
  10|11|12|13|14) HEADING="☀️ Midday reminder" ;;
  15|16|17|18|19) HEADING="🌆 Evening reminder" ;;
  *)              HEADING="Parent reminder" ;;
esac

COUNT=$(( (RANDOM % 3) + 3 ))

pick_random() {
  local n="$1" file="$2"
  if command -v shuf >/dev/null 2>&1; then
    shuf -n "$n" "$file"
  elif command -v gshuf >/dev/null 2>&1; then
    gshuf -n "$n" "$file"
  else
    awk -v n="$n" 'BEGIN{srand()} {a[NR]=$0} END{
      for(i=1;i<=NR;i++)b[i]=i
      for(i=NR;i>1;i--){j=int(rand()*i)+1; t=b[i]; b[i]=b[j]; b[j]=t}
      for(i=1;i<=n && i<=NR;i++)print a[b[i]]
    }' "$file"
  fi
}

QUOTES=$(pick_random "$COUNT" "$QUOTES_FILE" | sed 's/^/• /')

MSG="*${HEADING}*

${QUOTES}"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d parse_mode=Markdown \
  --data-urlencode "text=${MSG}" >/dev/null
