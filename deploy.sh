#!/bin/bash
set -e
# ASM Portal V2 — MVP production deploy (VPS, Docker Compose + reverse proxy)
# Usage: ./deploy.sh   (run from repo root on the VPS)

echo "🚀 Starting Deployment..."

if [ ! -f .env ]; then
    echo "❌ Error: .env file not found! Copy .env.example → .env first."
    exit 1
fi
chmod 600 .env || true

# Guard: block dev-only secrets in production
if grep -q "dev-only-secret" .env; then
    echo "❌ BLOCKED: .env still contains dev-only JWT_SECRET. Rotate before deploy."
    exit 1
fi

# Guard: without APP_DB_PASSWORD the app connects as the Postgres superuser,
# which bypasses row-level security and silently disables tenant isolation.
if ! grep -qE '^APP_DB_PASSWORD=.+' .env; then
    echo "❌ BLOCKED: APP_DB_PASSWORD is not set in .env."
    echo "   Without it the app runs as the DB superuser and RLS is bypassed."
    exit 1
fi
if grep -qE '^(DB_PASSWORD|APP_DB_PASSWORD|JWT_SECRET)=CHANGE_ME' .env; then
    echo "❌ BLOCKED: .env still has CHANGE_ME placeholder secrets."
    exit 1
fi

echo "🏗️ Building and starting containers..."
docker compose up -d --build

echo "⏳ Waiting for app health..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        echo "✅ App healthy."
        break
    fi
    if [ "$i" = "30" ]; then
        echo "❌ App did not become healthy in 150s. Check: docker compose logs app"
        exit 1
    fi
    sleep 5
done

echo "🗄️ Ensuring migrations (idempotent; also runs on container boot)..."
docker compose exec -T app prisma migrate deploy || true

echo ""
echo "✅ Deployment completed."
echo "🌐 Public traffic via reverse proxy → http://127.0.0.1:3000 (do NOT expose :3000 directly)"
echo "💾 Backups: ./scripts/backup.sh (DB + uploads). Schedule it nightly:"
echo "   0 2 * * * cd \$(pwd) && ./scripts/backup.sh >> /var/log/asm-backup.log 2>&1"
echo "🔐 Post-deploy: bootstrap the super-admin, then UNSET SETUP_SECRET and redeploy:"
echo "   curl -X POST https://admin.\$NEXT_PUBLIC_BASE_DOMAIN/api/setup -H \"x-setup-secret: \$SETUP_SECRET\""
