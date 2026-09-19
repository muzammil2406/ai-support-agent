# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Install deps first (cached layer).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy sources.
COPY tsconfig.json nest-cli.json ./
COPY src ./src

ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080

CMD ["node", "dist/main.js"]