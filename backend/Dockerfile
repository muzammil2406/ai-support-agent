# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Install deps first (cached layer).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy sources.
COPY tsconfig.json nest-cli.json ./
COPY src ./src
COPY prisma ./prisma

# Generate the Prisma client, then compile with SWC (fast, low-memory).
RUN npx prisma generate
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-slim AS runner
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 8080

# Apply pending migrations (idempotent) then boot the app.
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || true; node dist/main.js"]
