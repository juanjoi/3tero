# syntax=docker/dockerfile:1

# ── Build ───────────────────────────────────────────────────────────────────
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NUXT_DATA_DIR=/data \
    NUXT_MIGRATIONS_DIR=/app/migrations

COPY --from=build /app/.output ./.output
COPY --from=build /app/server/db/migrations ./migrations

RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
