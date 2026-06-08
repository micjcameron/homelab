#!/usr/bin/env bash
#
# ha-deploy.sh — Safe, hybrid Home Assistant config deploy.
#
# WORKFLOW
#   1. Edit YAML on your Mac, commit & push.
#   2. Run `./ha-deploy.sh` on your Mac. It SSHes to the Pi, git-pulls, and runs
#      the safe deploy (this same script with --local) where Docker actually is.
#
# SAFE DEPLOY (runs on the Pi, --local mode)
#   backup live -> build staging (live secrets/.storage + repo config) ->
#   validate with HA's check_config -> promote to live only if valid ->
#   restart -> health-check :8123 -> auto-rollback if the restart never comes up.
#
# A broken commit can never take HA down: validation happens against a staging
# copy before anything touches the live config.
#
# Usage:
#   ./ha-deploy.sh            # from Mac: ssh -> Pi -> git pull -> deploy
#   ./ha-deploy.sh --local    # on the Pi: run the safe deploy directly
#   ./ha-deploy.sh pull       # from Mac: mirror live HA config -> repo (capture UI edits)

set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
PI_HOST="micjcameron@192.168.1.128"
PI_REPO="\$HOME/homelab"                       # repo path ON the Pi (expanded remotely)
LIVE_DIR="/home/micjcameron/homeassistant"     # host-side bind-mount of /config
CONTAINER="homeassistant"
BACKUP_ROOT="$HOME/ha-backups"
BRANCH="main"
KEEP_BACKUPS=10
HEALTH_URL="http://localhost:8123/"            # HA uses network_mode: host on the Pi
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_CONFIG="$(cd "$SCRIPT_DIR/.." && pwd)/homeassistant-config"

# Never overwrite these on the live target (live-only state + secrets).
# Blueprints DO deploy (so you can author them in the repo) — we only skip HA's
# auto-generated built-in examples, which the Pi regenerates on its own.
EXCLUDES=(
  --exclude=secrets.yaml --exclude=.storage/ --exclude=.storage.bak*
  --exclude=*.db --exclude=*.db-* --exclude=*.log --exclude=*.log.*
  --exclude=.HA_VERSION --exclude=.uuid --exclude=.cloud/
  --exclude=deps/ --exclude=tts/ --exclude=backups/
  --exclude=custom_components/ --exclude=www/ --exclude=sync.sh
  --exclude=blueprints/automation/homeassistant/
  --exclude=blueprints/script/homeassistant/
)
# Lighter set for backup / staging-from-live: keep secrets + .storage so the
# config check can resolve !secret and integrations, but skip the heavy churn.
HEAVY_ONLY=(
  --exclude=*.db --exclude=*.db-* --exclude=*.log --exclude=*.log.*
  --exclude=deps/ --exclude=tts/ --exclude=backups/
  --exclude=.cloud/ --exclude=.storage.bak*
)
# Full reference mirror (`mirror` cmd): pull the ENTIRE live config for reference
# — incl. .storage, secrets, custom_components — minus only huge/volatile/
# regenerable files that have no reference value and would bloat git.
MIRROR_EXCLUDES=(
  --exclude=*.db --exclude=*.db-* --exclude=*.log --exclude=*.log.*
  --exclude=deps/ --exclude=tts/ --exclude=.cloud/ --exclude=backups/
  --exclude=__pycache__/ --exclude=*.pyc
  --exclude=.storage.bak*                # timestamped .storage backups (Pi-only)
  --exclude=custom_components/hacs/       # 51M package-manager source, not reference
)

log() { printf '\033[1;34m› %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
err() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

# rsync that tolerates "partial transfer" (23/24) from root-owned files HA writes
# (e.g. .storage/auth) which our user can't read — they aren't needed to deploy.
rsync_safe() {
  local rc=0
  rsync "$@" || rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 23 ] && [ "$rc" -ne 24 ]; then return "$rc"; fi
  return 0
}

# ─── Remote trigger (Mac side) ───────────────────────────────────────────────
remote_deploy() {
  log "Deploying via $PI_HOST ..."
  ssh "$PI_HOST" "set -e; cd $PI_REPO && git pull --ff-only origin $BRANCH && bash $PI_REPO/home-automation/scripts/ha-deploy.sh --local"
}

remote_pull() {
  log "Pulling tracked HA config from Pi -> repo (deploy round-trip) ..."
  rsync -avz "${EXCLUDES[@]}" "${PI_HOST}:${LIVE_DIR}/" "${REPO_CONFIG}/"
  ok "Pulled. Review with: git status"
}

remote_push() {
  # Git-free deploy: rsync the repo config + this script to a staging area on the
  # Pi, then run the same safe deploy there. Great for iterating without committing.
  local inc="ha-incoming"
  log "Pushing repo config -> Pi:~/$inc (rsync, no git needed) ..."
  ssh "$PI_HOST" "mkdir -p ~/$inc/homeassistant-config ~/$inc/scripts"
  rsync -az "${EXCLUDES[@]}" "$REPO_CONFIG/" "$PI_HOST:~/$inc/homeassistant-config/"
  rsync -az "$SCRIPT_DIR/ha-deploy.sh" "$PI_HOST:~/$inc/scripts/ha-deploy.sh"
  log "Running safe deploy on the Pi from the pushed copy ..."
  ssh "$PI_HOST" "bash ~/$inc/scripts/ha-deploy.sh --local"
}

remote_mirror() {
  log "Mirroring FULL live HA config from Pi -> repo (reference copy) ..."
  # Additive (no --delete): never removes repo-only files like our own blueprints.
  rsync -avz "${MIRROR_EXCLUDES[@]}" "${PI_HOST}:${LIVE_DIR}/" "${REPO_CONFIG}/"
  ok "Mirror complete. Review with: git status"
}

# ─── Safe deploy (Pi side) ───────────────────────────────────────────────────
local_deploy() {
  command -v docker >/dev/null || { err "docker not found — run this on the Pi."; exit 1; }
  [ -d "$LIVE_DIR" ] || { err "Live dir $LIVE_DIR not found."; exit 1; }
  docker inspect "$CONTAINER" >/dev/null 2>&1 || { err "Container '$CONTAINER' not found."; exit 1; }

  # 1. Backup live config.
  local ts backup
  ts="$(date +%Y%m%d-%H%M%S)"; backup="$BACKUP_ROOT/$ts"
  log "Backing up live config -> $backup"
  mkdir -p "$backup"
  rsync_safe -a "${HEAVY_ONLY[@]}" "$LIVE_DIR/" "$backup/"
  ls -1dt "$BACKUP_ROOT"/*/ 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf
  ok "Backup complete"

  # 2. Build staging (live secrets/.storage overlaid with repo config).
  local staging; staging="$(mktemp -d)"
  log "Staging merged config in $staging"
  rsync_safe -a "${HEAVY_ONLY[@]}" "$LIVE_DIR/" "$staging/"   # live incl. secrets + .storage
  rsync -a "${EXCLUDES[@]}" "$REPO_CONFIG/" "$staging/"       # overlay repo (keeps secrets/.storage)
  ok "Staging ready"

  # 3. Validate against staging using the running image's exact version.
  log "Running HA check_config against staging ..."
  local image; image="$(docker inspect "$CONTAINER" -f '{{ .Config.Image }}')"
  if docker run --rm -v "$staging:/config" --entrypoint python3 "$image" \
       -m homeassistant --script check_config -c /config; then
    ok "Config check passed"
  else
    err "Config check FAILED — aborting. Live HA untouched."
    rm -rf "$staging"; exit 1
  fi
  rm -rf "$staging"

  # 4. Promote repo config -> live (secrets/.storage preserved by EXCLUDES).
  # --no-owner/--no-group: we're not root, and HA writes some files as root. We own
  # the dir so we can replace file *contents*, but must not try to chown them.
  log "Promoting validated config to live ..."
  trap 'err "Deploy failed — rolling back."; rsync_safe -a --no-owner --no-group "${EXCLUDES[@]}" "$backup/" "$LIVE_DIR/"; docker restart "$CONTAINER" >/dev/null 2>&1 || true' ERR
  rsync_safe -a --no-owner --no-group "${EXCLUDES[@]}" "$REPO_CONFIG/" "$LIVE_DIR/"
  ok "Config deployed"

  # 5. Restart + health check.
  log "Restarting '$CONTAINER' ..."
  docker restart "$CONTAINER" >/dev/null
  log "Waiting for HA to answer on 8123 ..."
  local i
  for i in $(seq 1 30); do
    if curl -sf -m 4 "$HEALTH_URL" >/dev/null 2>&1; then
      trap - ERR
      ok "Home Assistant is back up (deployed $(cd "$REPO_CONFIG" && git rev-parse --short HEAD 2>/dev/null || echo '?'))"
      return 0
    fi
    sleep 5
  done
  err "HA did not respond within ~150s."
  return 1   # triggers ERR trap -> rollback
}

# ─── Dispatch ────────────────────────────────────────────────────────────────
case "${1:-push}" in
  --local) local_deploy ;;
  push)    remote_push ;;
  pull)    remote_pull ;;
  mirror)  remote_mirror ;;
  deploy)  remote_deploy ;;
  *) echo "Usage: $0 [push|deploy|pull|mirror|--local]"; exit 1 ;;
esac
