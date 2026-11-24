#!/usr/bin/env bash
# deploy.sh — Yellow Dot backend deploy (run on the VPS as root)
#
# Usage:
#   bash /opt/yd/backend/yellowdot-backend/deploy/deploy.sh
#
# What it does:
#   1. Pulls origin/master into the checkout at /opt/yd/backend
#   2. Builds a Docker image tagged with the short commit SHA (and :latest),
#      stamping commit/branch/build-time in via build args so /api/version
#      reports what is actually running
#   3. Recreates the yd-backend container on the new image
#   4. Prunes old images, keeping a rollback window
#   5. Smoke-tests /api/version and reports the deployed commit
#
# ── Corrected 2026-11-24, after this script was found to be unrunnable ────────
# It previously pointed at /opt/yd/repo and /opt/yd/docker-compose.yml. Neither
# exists on the VPS: the checkout is /opt/yd/backend, and the container has
# never been managed by compose — `docker inspect` shows no compose labels at
# all, and MASTER_PLATFORM_STATUS.md §3 already recorded "docker run ..., no
# PM2/Kubernetes/docker-compose in actual use despite files existing in the
# repo". So the script would have exited on its first `cd`, and the deploy that
# shipped b0caeef (and every one before it) was done by hand.
#
# The `docker run` flags below are not invented: they were read back off the
# running container with `docker inspect` and match it exactly — loopback-only
# port publish, the secrets bind, the env file, the restart policy. Verified by
# using them to deploy 329fb12 on 2026-11-24.
#
# deploy/docker-compose.yml is kept for reference only and is NOT used. It
# describes a build context (/opt/yd/repo/...) and a file-mount of
# /opt/yd/firebase-sa.json that are both wrong for this host — that path is a
# directory, not a file.
#
# Rollback (previous images are kept, see PRUNE_KEEP below):
#   docker images yd-backend                    # pick a previous tag
#   docker stop yd-backend && docker rm yd-backend
#   docker run -d --name yd-backend --restart unless-stopped \
#     -p 127.0.0.1:4000:8080 -v /opt/yd/secrets:/opt/yd/secrets \
#     --env-file /opt/yd/backend.env yd-backend:<previous-tag>

set -euo pipefail

REPO_DIR=/opt/yd/backend
BACKEND_DIR="$REPO_DIR/yellowdot-backend"
ENV_FILE=/opt/yd/backend.env
SECRETS_DIR=/opt/yd/secrets
CONTAINER=yd-backend

# Container listens on 8080 (PORT in the env file); Caddy reverse-proxies
# api.kueboxs.com -> 127.0.0.1:4000. Loopback-only on purpose: published on
# 0.0.0.0 the backend would be reachable over plain HTTP, bypassing TLS.
HOST_PORT="${HOST_PORT:-4000}"
CONTAINER_PORT=8080
HEALTH_PORT="${HEALTH_PORT:-$HOST_PORT}"

# How many previous images to keep as rollback targets.
PRUNE_KEEP="${PRUNE_KEEP:-3}"

echo "=== Yellow Dot Backend Deploy $(date -u) ==="

for f in "$ENV_FILE" "$SECRETS_DIR"; do
  [ -e "$f" ] || { echo "ERROR: $f not found — wrong host, or the box was rebuilt."; exit 1; }
done

# ── Pull latest code ──────────────────────────────────────────────────────────
cd "$REPO_DIR"
git fetch origin
git pull --ff-only origin master
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Deploying commit $COMMIT on $BRANCH"

PREVIOUS=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || echo "none")
echo "Currently running: $PREVIOUS"

# ── Tag the deploy in git ─────────────────────────────────────────────────────
git tag -f "deploy-$(date -u +%Y%m%d)-$COMMIT" HEAD
echo "Tagged deploy-$(date -u +%Y%m%d)-$COMMIT"

# ── Build ─────────────────────────────────────────────────────────────────────
IMAGE_TAG="yd-backend:$COMMIT"
docker build \
  --build-arg APP_COMMIT="$COMMIT" \
  --build-arg APP_BRANCH="$BRANCH" \
  --build-arg APP_BUILD_TIME="$BUILT_AT" \
  -t "$IMAGE_TAG" \
  -t "yd-backend:latest" \
  "$BACKEND_DIR"
echo "Built $IMAGE_TAG"

# ── Recreate the container ────────────────────────────────────────────────────
# Flags mirror the running container exactly (docker inspect yd-backend).
docker stop "$CONTAINER" >/dev/null 2>&1 || true
docker rm   "$CONTAINER" >/dev/null 2>&1 || true

docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p "127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${SECRETS_DIR}:${SECRETS_DIR}" \
  --env-file "$ENV_FILE" \
  "$IMAGE_TAG" >/dev/null
echo "Container started on $IMAGE_TAG"

# ── Smoke test ────────────────────────────────────────────────────────────────
# Before pruning, so a failed deploy still has every rollback target on disk.
sleep 4
echo "=== /api/version ==="
if ! curl -sf "http://127.0.0.1:${HEALTH_PORT}/api/version" | python3 -m json.tool; then
  echo "ERROR: /api/version failed on 127.0.0.1:${HEALTH_PORT} — recent logs:"
  docker logs "$CONTAINER" --tail 50
  echo
  echo "Roll back with:"
  echo "  docker stop $CONTAINER && docker rm $CONTAINER"
  echo "  docker run -d --name $CONTAINER --restart unless-stopped \\"
  echo "    -p 127.0.0.1:${HOST_PORT}:${CONTAINER_PORT} -v ${SECRETS_DIR}:${SECRETS_DIR} \\"
  echo "    --env-file $ENV_FILE $PREVIOUS"
  exit 1
fi

# ── Prune old images ──────────────────────────────────────────────────────────
# By CREATION TIME, not tag name. This used to `sort -r` the tags, which for
# hex commit SHAs is alphabetical and therefore arbitrary — it could delete a
# recent rollback target while keeping a months-old one. `docker images` already
# returns newest first, so just skip the ones being kept.
docker images yd-backend --format '{{.Tag}}' \
  | grep -v '^latest$' \
  | grep -v "^${COMMIT}$" \
  | tail -n +"$PRUNE_KEEP" \
  | xargs -r -I{} docker rmi "yd-backend:{}" 2>/dev/null || true

echo "=== Deploy complete: $COMMIT (was ${PREVIOUS#yd-backend:}) ==="
