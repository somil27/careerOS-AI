# syntax=docker/dockerfile:1.7

# --- Build stage ---------------------------------------------------------
FROM oven/bun:1.1.34-alpine AS build
WORKDIR /app

# Install deps against the lockfile for reproducible builds.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Copy the rest of the source and build.
COPY . .
ENV NODE_ENV=production
RUN bun run build

# --- Runtime stage -------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Only ship the built server + client assets and a minimal Node entry.
COPY --from=build /app/dist ./dist
COPY docker/server.mjs ./server.mjs

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.mjs"]
