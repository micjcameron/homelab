#!/usr/bin/env bash
#
# docker-prune.sh — monthly disk hygiene, deliberately boring.
#
# Removes ONLY:
#   - dangling image layers (untagged <none> leftovers from rebuilds)
#   - build cache older than 7 days
#
# Chaos-free by construction: it can never delete a tagged image — not even of
# a stopped container — and never touches containers or volumes. The 2.5GB-of-
# unused-images class of cleanup (image prune -a) stays a manual, eyes-on job.
#
set -euo pipefail

echo "=== docker-prune $(date '+%F %T') ==="
echo "before: $(df -h / | tail -1 | awk '{print $3" used, "$4" free ("$5")"}')"

docker image prune -f
docker builder prune -af --filter until=168h

echo "after:  $(df -h / | tail -1 | awk '{print $3" used, "$4" free ("$5")"}')"
