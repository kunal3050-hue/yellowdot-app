#!/usr/bin/env bash
# deploy.sh — Yellow Dot backend deploy script (REVIEW ONLY — run on VPS as root)
#
# Usage:
#   bash /opt/yd/deploy.sh
#
# What it does:
#   1. Pulls latest code from git
#   2. Builds a tagged Docker image (tag = short commit SHA)
#   3. Runs npm run build:info inside the build
#   4. Updates docker-compose to use the new tag
#   5. Brings up the new container (zero-downtime: compose replaces the container)
#   6. Prints /api/version to confirm the deployed commit
#
# Rollback:
#   BACKEND_TAG=<previous-sha> docker compose -f /opt/yd/docker-compose.yml up -d

set -euo pipefail

REPO_DIR=/opt/yd/repo
COMPOSE_FILE=/opt/yd/docker-compose.yml
BACKEND_DIR=$REPO_DIR/yellowdot-backend

echo "=== Yellow Dot Backend Deploy $(date -u) ==="

# ── Pull latest code ──────────────────────────────────────────────────────────
cd "$REPO_DIR"
git fetch origin
git pull origin master
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Deploying commit $COMMIT on $BRANCH"

# ── Tag the deploy in git ─────────────────────────────────────────────────────
git tag -f "deploy-$(date -u +%Y%m%d)-$COMMIT" HEAD
echo "Tagged deploy-$(date -u +%Y%m%d)-$COMMIT"

# ── Build Docker image ────────────────────────────────────────────────────────
IMAGE_TAG="yd-backend:$COMMIT"
docker build \
  --build-arg APP_COMMIT="$COMMIT" \
  --build-arg APP_BRANCH="$BRANCH" \
  --build-arg APP_BUILD_TIME="$BUILT_AT" \
  -t "$IMAGE_TAG" \
  -t "yd-backend:latest" \
  "$BACKEND_DIR"

echo "Built image $IMAGE_TAG"

# ── Keep only last 3 images (rollback window) ─────────────────────────────────
docker images yd-backend --format "{{.Tag}}" \
  | grep -v "latest" \
  | sort -r \
  | tail -n +4 \
  | xargs -r -I{} docker rmi "yd-backend:{}" 2>/dev/null || true

# ── Deploy ────────────────────────────────────────────────────────────────────
BACKEND_TAG="$COMMIT" docker compose -f "$COMPOSE_FILE" up -d --no-build
echo "Container started"

# ── Smoke test ────────────────────────────────────────────────────────────────
sleep 3
echo "=== /api/version ==="
curl -sf http://127.0.0.1:5000/api/version | python3 -m json.tool || \
  { echo "ERROR: /api/version failed — check logs"; docker logs yd-backend --tail 50; exit 1; }

echo "=== Deploy complete: $COMMIT ==="
