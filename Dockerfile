# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN NODE_ENV=development npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set necessary env vars for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_CLIENT_ENGINE_TYPE=library
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Use a dummy DB URL during build to satisfy Prisma validation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_CLIENT_ENGINE_TYPE=library

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Full node_modules from the builder stage (deps' install + the prisma
# client generated on top of it there) — not just .prisma/@prisma/client —
# because scripts/*.js run as plain `node` scripts outside Next's standalone
# bundle/tracing, so anything they import (pg, for
# scripts/typing-game-migrate.js) must physically exist here.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/supabase-migrations ./supabase-migrations

RUN npm install -g prisma@6

# Install su-exec and native compatibility libs for privilege dropping and Prisma engine
RUN apk add --no-cache su-exec libc6-compat openssl

# Entrypoint: fixes /app/storage ownership then drops to nextjs user
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Entrypoint runs as root → fixes volume permissions → drops to nextjs
# NOTE: /app/server.js here IS .next/standalone/server.js (copied above),
# NOT the repo-root server.js (cPanel legacy — not copied into runner).
# migrate deploy runs on every boot so VPS reboots/redeploys never skip schema.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "prisma migrate deploy || true; node scripts/startup.js || true; node scripts/typing-game-migrate.js || true; node prisma/seed.js || true; node server.js"]
