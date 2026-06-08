# Multi-stage build for the homelab ui-admin app.
# Base is alpine (we need docker-cli + compose, not chromium).

# ── web: build the React SPA ─────────────────────────────────────────────────
FROM node:20-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── deps: install all server deps (incl. dev) for building ───────────────────
FROM node:20-alpine AS deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

# ── build: compile TS, then drop dev deps ────────────────────────────────────
FROM deps AS build
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ── runtime: lean image with docker CLI + compose + script deps ──────────────
FROM node:20-alpine AS runtime
RUN apk add --no-cache docker-cli docker-cli-compose bash curl jq coreutils
WORKDIR /app
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
COPY --from=web /web/dist ./public
ENV NODE_ENV=production
EXPOSE 8090
CMD ["node", "dist/main"]
