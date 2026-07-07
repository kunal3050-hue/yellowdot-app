# Yellow Dot Backend — Docker image
# Build context: yellowdot-backend/
# Usage (from yellowdot-backend/):
#   docker build -t yd-backend:$(git rev-parse --short HEAD) .

FROM node:18-alpine

WORKDIR /app

# Install deps first (cached layer unless package.json changes)
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev

# Copy source
COPY . .

# Bake git commit into build-info.json so /api/version reports correctly.
# Best-effort: script is silent if git is unavailable inside the build context.
RUN npm run build:info || true

EXPOSE 5000

CMD ["node", "server.js"]
