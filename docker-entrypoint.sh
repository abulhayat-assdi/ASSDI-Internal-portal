#!/bin/sh
set -e

# Fix storage volume ownership so the nextjs user (uid 1001) can write to it.
mkdir -p /app/storage
chown -R nextjs:nodejs /app/storage

# ── Fix P1013: DB passwords with special chars (@ : / # ? etc) break the
#    DATABASE_URL / PGRST_DB_URI that docker-compose builds via string
#    interpolation. If the raw password contains URI-reserved chars, the
#    connection string's port/host parsing fails with "invalid port number".
#    We rebuild both URIs here with a percent-encoded password so any
#    user-chosen password works (Coolify envs often auto-generate symbols).
#    Only runs when DB_* vars are present (Coolify always sets them).
if [ -n "${DB_USER:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
    _enc_db_pwd=$(node -e "console.log(encodeURIComponent(process.env.DB_PASSWORD))")
    export DATABASE_URL="postgresql://${DB_USER}:${_enc_db_pwd}@db:5432/${DB_NAME:-asm_portal}?schema=public"
fi
if [ -n "${PGRST_AUTHENTICATOR_PASSWORD:-}" ]; then
    _enc_pgrst_pwd=$(node -e "console.log(encodeURIComponent(process.env.PGRST_AUTHENTICATOR_PASSWORD))")
    export PGRST_DB_URI="postgresql://authenticator:${_enc_pgrst_pwd}@db:5432/${DB_NAME:-asm_portal}"
fi

# Drop to nextjs user for all subsequent processes (Node.js, startup scripts).
exec su-exec nextjs "$@"
