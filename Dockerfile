# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
COPY prisma ./prisma/
RUN NODE_ENV=development npm ci --no-audit --no-fund

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

# NEXT_PUBLIC_* is compiled into the client bundles, so it has to be present
# at BUILD time — setting it only at runtime has no effect on them. Server
# code reads the runtime BASE_DOMAIN instead (see src/lib/course.ts).
ARG NEXT_PUBLIC_BASE_DOMAIN=tasm-skill.asf.bd
ENV NEXT_PUBLIC_BASE_DOMAIN=$NEXT_PUBLIC_BASE_DOMAIN
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
# `prisma migrate deploy` is fatal on failure (set -e): booting the app against
# a schema that didn't fully migrate corrupts data and produces 500s that look
# like application bugs. The three steps after it are idempotent best-effort
# patchers that are allowed to fail, so -e is lifted around them. `exec` on the
# server hands it PID 1's signals for a clean shutdown.
# DDL steps run as the superuser via BOOTSTRAP_DATABASE_URL; the server then
# starts with DATABASE_URL pointing at the unprivileged app role (see
# docker-entrypoint.sh and scripts/ensure-app-role.js). ensure-app-role and
# migrate are fatal on failure — booting without either means running with no
# tenant isolation, or against a half-migrated schema.
CMD ["sh", "-c", "set -e; DATABASE_URL=\"${BOOTSTRAP_DATABASE_URL:-$DATABASE_URL}\" node scripts/ensure-app-role.js; DATABASE_URL=\"${BOOTSTRAP_DATABASE_URL:-$DATABASE_URL}\" prisma migrate deploy; set +e; DATABASE_URL=\"${BOOTSTRAP_DATABASE_URL:-$DATABASE_URL}\" node scripts/startup.js; DATABASE_URL=\"${BOOTSTRAP_DATABASE_URL:-$DATABASE_URL}\" node scripts/typing-game-migrate.js; DATABASE_URL=\"${BOOTSTRAP_DATABASE_URL:-$DATABASE_URL}\" node prisma/seed.js; set -e; exec node server.js"]
