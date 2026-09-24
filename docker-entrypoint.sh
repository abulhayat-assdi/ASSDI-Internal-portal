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
# Superuser URL. Used ONLY for migrations and schema patches at boot — never
# by the running server, because a superuser bypasses row-level security and
# would make the course-isolation policies inert.
#
# Seed it from whatever DATABASE_URL we were handed, BEFORE the app-role block
# below rewrites that variable. Without this the bootstrap steps would fall
# back to the app role, which doesn't exist yet on a first boot.
: "${BOOTSTRAP_DATABASE_URL:=${DATABASE_URL:-}}"

if [ -n "${DB_USER:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
    _enc_db_pwd=$(node -e "console.log(encodeURIComponent(process.env.DB_PASSWORD))")
    BOOTSTRAP_DATABASE_URL="postgresql://${DB_USER}:${_enc_db_pwd}@db:5432/${DB_NAME:-asm_portal}?schema=public"
fi

export BOOTSTRAP_DATABASE_URL
export DATABASE_URL="$BOOTSTRAP_DATABASE_URL"

# The server's own connection: the unprivileged role created by
# scripts/ensure-app-role.js, which is NOSUPERUSER/NOBYPASSRLS and therefore
# actually subject to the RLS policies.
if [ -n "${APP_DB_PASSWORD:-}" ]; then
    _enc_app_pwd=$(node -e "console.log(encodeURIComponent(process.env.APP_DB_PASSWORD))")
    export DATABASE_URL="postgresql://${APP_DB_USER:-asm_app}:${_enc_app_pwd}@db:5432/${DB_NAME:-asm_portal}?schema=public"
else
    echo "WARNING: APP_DB_PASSWORD is not set. The app will connect as the" >&2
    echo "         database superuser, which BYPASSES row-level security and" >&2
    echo "         leaves course isolation to application code alone." >&2
fi
if [ -n "${PGRST_AUTHENTICATOR_PASSWORD:-}" ]; then
    _enc_pgrst_pwd=$(node -e "console.log(encodeURIComponent(process.env.PGRST_AUTHENTICATOR_PASSWORD))")
    export PGRST_DB_URI="postgresql://authenticator:${_enc_pgrst_pwd}@db:5432/${DB_NAME:-asm_portal}"
fi

# Drop to nextjs user for all subsequent processes (Node.js, startup scripts).
exec su-exec nextjs "$@"
