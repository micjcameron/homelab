#!/usr/bin/env bash
# Build the site locally and push the static output to the VPS.
# Run from the lulula-website/ directory:  ./deploy/deploy.sh
#
# The VPS needs nothing but Caddy — no Node, no build tools. All the heavy
# lifting happens here; only plain files get shipped.
#
# Configure once (or export these in your shell / a .env you source):
#   VPS  = ssh target for the box   e.g. root@203.0.113.10
#   DEST = folder Caddy serves from e.g. /var/www/lulula
set -euo pipefail

VPS="${VPS:-CHANGE_ME@your.vps.ip}"
DEST="${DEST:-/var/www/lulula}"

echo "▶ Building static site…"
npm ci
npm run build

echo "▶ Syncing out/ → ${VPS}:${DEST}"
# --delete removes files on the server that no longer exist locally,
# so old gallery images etc. get cleaned up automatically.
rsync -avz --delete out/ "${VPS}:${DEST}/"

echo "✔ Deployed. Live at https://lulula.nl"
