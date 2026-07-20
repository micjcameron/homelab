#!/usr/bin/env bash
# harden.sh — reusable baseline hardening for a fresh Ubuntu/Debian VPS.
#
# Safe to run on the egress box (STRATO, 217.160.75.214) AND on any other VPS.
# It is deliberately conservative so it can't lock you out or break the exit node:
#   • Keeps ROOT key login working (only blocks root *password* login).
#   • Only disables password auth if it can see an SSH key first (else it aborts).
#   • Touches only the firewall's INCOMING policy — never the FORWARD/routed policy,
#     so the Tailscale exit-node forwarding on this box keeps working.
#   • Writes SSH settings to a drop-in file, never mangling the main sshd_config.
#
# What it does:
#   1. apt update/upgrade
#   2. unattended-upgrades (automatic security patches)
#   3. ufw: deny incoming / allow outgoing, allow SSH (+ optional 80/443 + extra ports)
#   4. SSH: root=key-only, password auth off, keyboard-interactive off  (drop-in)
#   5. fail2ban: ban SSH brute-forcers
#
# Usage (run as root on the VPS):
#   ./harden.sh                       # baseline, SSH only
#   ALLOW_HTTP=true ./harden.sh       # also open 80/443 (use this on the web-host box)
#   EXTRA_UDP_PORTS="51820" ALLOW_HTTP=true ./harden.sh   # + a WireGuard port
#   FORCE=1 ./harden.sh               # skip the confirmation prompt
#
# Config (all overridable via env):
SSH_PORT="${SSH_PORT:-22}"                       # leave at 22 unless you really moved it
ALLOW_HTTP="${ALLOW_HTTP:-false}"                # open 80/443 (true on the site host)
EXTRA_TCP_PORTS="${EXTRA_TCP_PORTS:-}"           # space-separated, e.g. "8080 2222"
EXTRA_UDP_PORTS="${EXTRA_UDP_PORTS:-}"           # space-separated, e.g. "51820"
DISABLE_PASSWORD_AUTH="${DISABLE_PASSWORD_AUTH:-true}"
FORCE="${FORCE:-0}"

set -euo pipefail

# ---- guards ---------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (e.g. sudo ./harden.sh)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script targets Debian/Ubuntu (apt). Aborting." >&2
  exit 1
fi

log() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

# Refuse to disable password auth unless we can prove a key is installed —
# this is the anti-lockout check.
key_present() {
  for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
    [ -s "$f" ] && return 0
  done
  return 1
}

if [ "$DISABLE_PASSWORD_AUTH" = "true" ] && ! key_present; then
  echo "✋ DISABLE_PASSWORD_AUTH=true but no authorized_keys found." >&2
  echo "   Add your SSH public key first, or rerun with DISABLE_PASSWORD_AUTH=false." >&2
  exit 1
fi

# ---- confirm --------------------------------------------------------------
cat <<SUMMARY

About to harden this host:
  SSH port ............ ${SSH_PORT}
  Open 80/443 ......... ${ALLOW_HTTP}
  Extra TCP ports ..... ${EXTRA_TCP_PORTS:-none}
  Extra UDP ports ..... ${EXTRA_UDP_PORTS:-none}
  Disable password SSH  ${DISABLE_PASSWORD_AUTH}   (root stays key-only either way)
  Firewall FORWARD policy is left untouched (exit-node safe).
SUMMARY

if [ "$FORCE" != "1" ]; then
  read -r -p $'\nProceed? [y/N] ' reply
  case "$reply" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 0 ;; esac
fi

# ---- 1. updates -----------------------------------------------------------
log "Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# ---- 2. automatic security updates ---------------------------------------
log "Enabling unattended-upgrades"
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# ---- 3. firewall ----------------------------------------------------------
log "Configuring ufw (incoming only — forward policy left as-is)"
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp" comment 'SSH'

if [ "$ALLOW_HTTP" = "true" ]; then
  ufw allow 80/tcp  comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
fi
for p in $EXTRA_TCP_PORTS; do ufw allow "${p}/tcp" comment 'extra'; done
for p in $EXTRA_UDP_PORTS; do ufw allow "${p}/udp" comment 'extra'; done

ufw --force enable

# ---- 4. SSH hardening (drop-in, validated before applying) ---------------
log "Hardening SSH (drop-in at /etc/ssh/sshd_config.d/99-harden.conf)"
DROPIN=/etc/ssh/sshd_config.d/99-harden.conf
{
  echo "# Managed by vps-egress/harden.sh — do not edit by hand."
  echo "Port ${SSH_PORT}"
  echo "PermitRootLogin prohibit-password"   # root via key OK, password root login blocked
  echo "KbdInteractiveAuthentication no"
  echo "ChallengeResponseAuthentication no"
  echo "X11Forwarding no"
  echo "MaxAuthTries 4"
  [ "$DISABLE_PASSWORD_AUTH" = "true" ] && echo "PasswordAuthentication no"
} > "$DROPIN"

# Validate config before reloading — a bad config here could lock you out.
if sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "SSH config valid and reloaded."
else
  echo "✋ sshd config test FAILED — reverting drop-in, leaving SSH untouched." >&2
  rm -f "$DROPIN"
  exit 1
fi

# ---- 5. fail2ban ----------------------------------------------------------
log "Installing fail2ban (SSH brute-force protection)"
apt-get install -y fail2ban
cat >/etc/fail2ban/jail.local <<JAIL
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = ${SSH_PORT}
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---- done -----------------------------------------------------------------
log "Done. Summary:"
echo "  • Security auto-updates: on"
ufw status verbose | sed 's/^/  ufw │ /'
echo "  • fail2ban:"
fail2ban-client status sshd 2>/dev/null | sed 's/^/  f2b │ /' || true

cat <<'NEXT'

⚠️  Before you close this session, open a SECOND terminal and confirm you can still
    SSH in. If you're locked out, this window is still open to fix it.
NEXT
