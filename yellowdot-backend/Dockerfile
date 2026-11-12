# Yellow Dot Backend — Docker image
# Build context: yellowdot-backend/
# Usage (from yellowdot-backend/):
#   docker build -t yd-backend:$(git rev-parse --short HEAD) .

FROM node:18-alpine

# Build metadata passed in by deploy.sh (see deploy/deploy.sh). Declared here
# so the --build-arg values are actually captured — .dockerignore excludes
# .git from the build context, so genBuildInfo.js's `git rev-parse` approach
# cannot work inside this image; build-info.json is written directly below
# from these args instead.
ARG APP_COMMIT=unknown
ARG APP_BRANCH=unknown
ARG APP_BUILD_TIME=unknown

WORKDIR /app

# Install deps first (cached layer unless package.json changes)
#
# This was `npm ci --legacy-peer-deps` for as long as firebase-functions@4.9
# was a dependency: it declared a peer of firebase-admin ^10||^11||^12 while
# the app pins ^13, so a strict install aborted with ERESOLVE. That package is
# gone along with the Cloud Functions entry point it served, and a strict
# install now resolves cleanly, so the flag is no longer needed and peer
# conflicts can fail the build again — which is what we want from it.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Bake the deploy-time commit/branch/build-time into build-info.json so
# /api/version reports the real deployed commit instead of "unknown".
RUN printf '{"commit":"%s","branch":"%s","builtAt":"%s"}\n' "$APP_COMMIT" "$APP_BRANCH" "$APP_BUILD_TIME" > build-info.json

EXPOSE 5000

CMD ["node", "server.js"]
