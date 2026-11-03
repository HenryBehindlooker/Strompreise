# syntax=docker/dockerfile:1

# Abhängigkeiten installieren. Skripte werden übersprungen: better-sqlite3 liefert sein
# Binary für Alpine (linuxmusl) im Paket mit, ein Kompilieren ist nicht nötig.
FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

# Anwendung bauen.
FROM deps AS build
COPY . .
RUN npm run build

# Nur Produktions-Abhängigkeiten.
FROM node:lts-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Laufzeit-Image: klein, ohne Quellcode, als Benutzer "node".
FROM node:lts-alpine AS runtime
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATABASE_PATH=/data/strompreise.db \
	MIGRATIONS_DIR=/app/migrations \
	JOBS_ENABLED=true
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/src/lib/server/db/migrations ./migrations
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -q -O /dev/null http://127.0.0.1:3000/api/status || exit 1
CMD ["node", "build/index.js"]
