#!/usr/bin/env bash
#
# cf-access.sh — put a Cloudflare Access email-gate in front of any proxy, on the fly.
#
# Creates/updates a self-hosted Cloudflare Access application for a hostname and
# attaches an "allow these emails" policy (one-time-PIN login). Idempotent — run
# it again with a new email list to change who's allowed; run `ungate` to remove.
#
#   ./cf-access.sh gate   proxy1 me@example.com,po@example.com
#   ./cf-access.sh gate   admin.camcosolutions.nl me@example.com
#   ./cf-access.sh show   proxy1
#   ./cf-access.sh ungate proxy1
#   ./cf-access.sh list
#
# First arg may be a proxy NAME (resolved via proxies.json) or a full hostname.
#
# Setup (once): copy .env.example -> .env and add, alongside TUNNEL_TOKEN:
#   CF_API_TOKEN=...     # token with: Access: Apps and Policies = Edit  (Account scope)
#   CF_ACCOUNT_ID=...    # Cloudflare dashboard -> Account Home -> right sidebar
# .env is gitignored — the token never leaves this box.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="https://api.cloudflare.com/client/v4"
POLICY_NAME="homelab-allowlist"
# Longer session = fewer re-logins (you disliked HA's 24h). Override in .env.
SESSION_DURATION="${SESSION_DURATION:-168h}"   # 1 week

# --- prerequisites & config -------------------------------------------------
command -v jq   >/dev/null || { echo "❌ jq is required (brew install jq / apt install jq)"   >&2; exit 1; }
command -v curl >/dev/null || { echo "❌ curl is required" >&2; exit 1; }
[[ -f "$SCRIPT_DIR/.env" ]] && set -a && . "$SCRIPT_DIR/.env" && set +a

# Only the API commands need credentials — help should work without them.
require_creds() {
  : "${CF_API_TOKEN:?Set CF_API_TOKEN in $SCRIPT_DIR/.env}"
  : "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID in $SCRIPT_DIR/.env}"
}

# --- helpers ----------------------------------------------------------------
# req METHOD PATH [JSON_BODY] — call the CF API, die on .success != true
req() {
  local method="$1" path="$2" body="${3:-}" resp
  local args=(-s -X "$method" "$API/$path"
              -H "Authorization: Bearer $CF_API_TOKEN"
              -H "Content-Type: application/json")
  [[ -n "$body" ]] && args+=(--data "$body")
  resp="$(curl "${args[@]}")"
  if [[ "$(jq -r '.success' <<<"$resp")" != "true" ]]; then
    echo "❌ Cloudflare API error on $method $path:" >&2
    jq -r '.errors[]? | "   [\(.code)] \(.message)"' <<<"$resp" >&2
    exit 1
  fi
  printf '%s' "$resp"
}

# resolve a proxy name (or pass-through a hostname) to an FQDN
resolve_host() {
  local in="$1"
  if [[ "$in" == *.* ]]; then printf '%s' "$in"; return; fi
  local h
  h="$(jq -r --arg n "$in" '.proxies[]? | select(.name==$n) | .hostname' "$SCRIPT_DIR/proxies.json" 2>/dev/null)"
  [[ -n "$h" ]] || { echo "❌ Unknown proxy '$in' — pass a full hostname, or add it to proxies.json" >&2; exit 1; }
  printf '%s' "$h"
}

# id of the Access app guarding $1 (empty string if none)
app_id_for() {
  req GET "accounts/$CF_ACCOUNT_ID/access/apps" \
    | jq -r --arg d "$1" 'first(.result[]? | select(.domain==$d) | .id) // empty'
}

# --- commands ---------------------------------------------------------------
cmd_gate() {
  local host emails include policy app_id pol_id
  host="$(resolve_host "${1:?usage: gate <proxy|hostname> <email,email,...>}")"
  emails="${2:?need a comma-separated email list}"

  # [{"email":{"email":"a@b.com"}}, ...] from the comma list (whitespace-tolerant)
  include="$(tr ',' '\n' <<<"$emails" | tr -d '[:space:]' | grep -v '^$' \
             | jq -R '{email:{email:.}}' | jq -s '.')"
  [[ "$(jq 'length' <<<"$include")" -gt 0 ]] || { echo "❌ no valid emails given" >&2; exit 1; }

  app_id="$(app_id_for "$host")"
  if [[ -z "$app_id" ]]; then
    echo "→ creating Access app for $host"
    app_id="$(req POST "accounts/$CF_ACCOUNT_ID/access/apps" \
      "$(jq -n --arg n "homelab: $host" --arg d "$host" --arg sd "$SESSION_DURATION" \
            '{name:$n, domain:$d, type:"self_hosted", session_duration:$sd, app_launcher_visible:false}')" \
      | jq -r '.result.id')"
  else
    echo "→ app already exists for $host, updating allowlist"
  fi

  policy="$(jq -n --argjson inc "$include" \
              '{name:"'"$POLICY_NAME"'", decision:"allow", include:$inc}')"
  pol_id="$(req GET "accounts/$CF_ACCOUNT_ID/access/apps/$app_id/policies" \
            | jq -r 'first(.result[]? | select(.name=="'"$POLICY_NAME"'") | .id) // empty')"
  if [[ -z "$pol_id" ]]; then
    req POST "accounts/$CF_ACCOUNT_ID/access/apps/$app_id/policies" "$policy" >/dev/null
  else
    req PUT  "accounts/$CF_ACCOUNT_ID/access/apps/$app_id/policies/$pol_id" "$policy" >/dev/null
  fi

  echo "🔒 $host is gated. Allowed: $(jq -r '[.[].email.email]|join(", ")' <<<"$include")"
  echo "   Login = one-time PIN to those addresses. Session: $SESSION_DURATION."
}

cmd_ungate() {
  local host app_id
  host="$(resolve_host "${1:?usage: ungate <proxy|hostname>}")"
  app_id="$(app_id_for "$host")"
  [[ -n "$app_id" ]] || { echo "ℹ️  $host has no Access gate — nothing to do."; return; }
  req DELETE "accounts/$CF_ACCOUNT_ID/access/apps/$app_id" >/dev/null
  echo "🔓 $host is now public (Access gate removed)."
}

cmd_show() {
  local host app_id
  host="$(resolve_host "${1:?usage: show <proxy|hostname>}")"
  app_id="$(app_id_for "$host")"
  [[ -n "$app_id" ]] || { echo "🔓 $host — no gate (public)."; return; }
  echo "🔒 $host"
  req GET "accounts/$CF_ACCOUNT_ID/access/apps/$app_id/policies" \
    | jq -r '.result[]? | "   policy \"\(.name)\" (\(.decision)): "
              + ([.include[]?.email.email // empty] | join(", "))'
}

# print one status row given a (possibly empty) proxy name, hostname, and the
# already-fetched apps JSON. Looks up the gate + its allowlist.
print_row() {
  local name="$1" host="$2" apps="$3" app_id emails
  app_id="$(jq -r --arg d "$host" 'first(.result[]? | select(.domain==$d) | .id) // empty' <<<"$apps")"
  if [[ -n "$app_id" ]]; then
    emails="$(req GET "accounts/$CF_ACCOUNT_ID/access/apps/$app_id/policies" \
              | jq -r '[.result[]?.include[]?.email.email // empty] | unique | join(", ")')"
    printf '🔒 %-9s %-32s %s\n' "$name" "$host" "${emails:-(policy has no email rule)}"
  else
    printf '🔓 %-9s %-32s %s\n' "$name" "$host" "public — anyone"
  fi
}

cmd_list() {
  local apps proxy_hosts extra
  apps="$(req GET "accounts/$CF_ACCOUNT_ID/access/apps")"

  printf '   %-9s %-32s %s\n' "PROXY" "HOSTNAME" "WHO CAN ACCESS"
  while IFS=$'\t' read -r name host; do
    print_row "$name" "$host" "$apps"
  done < <(jq -r '.proxies[]? | [.name, .hostname] | @tsv' "$SCRIPT_DIR/proxies.json")

  # Any other gated hostnames not in proxies.json (e.g. ha., admin.)
  proxy_hosts="$(jq -r '.proxies[]?.hostname' "$SCRIPT_DIR/proxies.json")"
  extra="$(jq -r '.result[]?.domain' <<<"$apps" | grep -vxF "$proxy_hosts" || true)"
  if [[ -n "$extra" ]]; then
    echo "   — other gated hosts —"
    while read -r host; do
      [[ -n "$host" ]] && print_row "·" "$host" "$apps"
    done <<<"$extra"
  fi
}

usage() {
  cat <<EOF
cf-access.sh — Cloudflare Access email-gates for your proxies

A gate makes a proxy require a one-time-PIN login; only the emails you list can
get in. Everyone else is blocked by Cloudflare before they ever reach the Pi.

USAGE
  ./cf-access.sh <command> [args]

COMMANDS
  gate   <proxy|hostname> <email,email,...>   gate it — set/replace the allowlist
  ungate <proxy|hostname>                     remove the gate (make it public)
  show   <proxy|hostname>                     show who's allowed on one proxy
  list                                        show every proxy + who can access it
  help                                        this menu

ARGS
  <proxy|hostname>   a name from proxies.json (e.g. proxy1) OR a full hostname
                     (e.g. ha.camcosolutions.nl)
  <email,email,...>  comma-separated allowlist (spaces ok). Re-run gate to change it.

EXAMPLES
  ./cf-access.sh gate proxy1 me@example.com,po@example.com   # only those two
  ./cf-access.sh gate proxy1 me@example.com,po@example.com,new@x.com   # add a third
  ./cf-access.sh show proxy1
  ./cf-access.sh ungate proxy1
  ./cf-access.sh list

SETUP (once, in $SCRIPT_DIR/.env — gitignored)
  CF_API_TOKEN=...    token with "Access: Apps and Policies = Edit"
  CF_ACCOUNT_ID=...   Cloudflare dashboard -> Account Home -> right sidebar
  SESSION_DURATION=168h   (optional) how long a login lasts; default 1 week
EOF
}

case "${1:-}" in
  gate)            require_creds; shift; cmd_gate   "$@" ;;
  ungate)          require_creds; shift; cmd_ungate "$@" ;;
  show)            require_creds; shift; cmd_show   "$@" ;;
  list)            require_creds; shift; cmd_list   "$@" ;;
  help|-h|--help)  usage ;;
  *)               usage >&2; exit 1 ;;
esac
