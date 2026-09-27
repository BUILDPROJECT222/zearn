# Single-service image: the backend serves the API and the built web app.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# install deps first (layer cache)
COPY apps/backend/package.json apps/backend/package-lock.json apps/backend/
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN cd apps/backend && npm ci --no-audit --no-fund --include=dev \
 && cd ../web && npm ci --no-audit --no-fund --include=dev

COPY . .
RUN cd apps/web && npm run build \
 && cd ../backend && npm run build

# SQLite lives here; mount a Railway volume at /data to persist it across deploys
RUN mkdir -p /data
ENV PORT=8787 \
    WEB_DIST=/app/apps/web/dist \
    DB_PATH=/data/zearn.db \
    DRY_RUN=true

EXPOSE 8787
WORKDIR /app/apps/backend
CMD ["node", "dist/index.js"]
