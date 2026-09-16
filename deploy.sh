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
echo "💾 Backup reminder: docker compose exec db pg_dump -U \$DB_USER \$DB_NAME > backup-\$(date +%F).sql"
echo "🔐 Post-deploy: bootstrap super-admin (/api/setup?secret=...), rotate password, then UNSET SETUP_SECRET and redeploy."
