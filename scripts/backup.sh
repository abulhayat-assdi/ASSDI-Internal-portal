#!/bin/bash
# ASM Portal — database + uploads backup.
#
# Run from the repo root on the VPS, where docker-compose.yml and .env live.
# Install as a nightly cron job:
#   0 2 * * * cd /path/to/asm-portal && ./scripts/backup.sh >> /var/log/asm-backup.log 2>&1
#
# Keeps RETENTION_DAYS of history and prunes older files. A backup that has
# never been restored is a guess, so see the restore note at the bottom.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%F_%H%M)"

if [ ! -f .env ]; then
    echo "❌ .env not found — run this from the repo root on the VPS."
    exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

: "${DB_USER:?DB_USER must be set in .env}"
: "${DB_NAME:?DB_NAME must be set in .env}"

mkdir -p "$BACKUP_DIR"

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
FILES_FILE="$BACKUP_DIR/storage-$STAMP.tar.gz"

echo "🗄️  Dumping database → $DB_FILE"
# --clean --if-exists makes the dump restorable over an existing database.
docker compose exec -T db pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" \
    | gzip > "$DB_FILE"

# A zero-length or truncated dump is worse than none, because it looks like a
# backup. Check the gzip stream end-to-end before trusting it.
if ! gzip -t "$DB_FILE" 2>/dev/null || [ ! -s "$DB_FILE" ]; then
    echo "❌ Database dump is empty or corrupt — removing it."
    rm -f "$DB_FILE"
    exit 1
fi

echo "📁 Archiving uploads → $FILES_FILE"
# Uploads live in the storage_data volume, mounted at /app/storage in the app
# container. The DB alone is not a full backup: homework and CV files are here.
docker compose exec -T app tar -cz -C /app/storage . > "$FILES_FILE"

if ! gzip -t "$FILES_FILE" 2>/dev/null || [ ! -s "$FILES_FILE" ]; then
    echo "❌ Storage archive is empty or corrupt — removing it."
    rm -f "$FILES_FILE"
    exit 1
fi

echo "🧹 Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'db-*.sql.gz'      -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "✅ Backup complete:"
ls -lh "$DB_FILE" "$FILES_FILE"
echo ""
echo "⚠️  These files sit on the same machine as the database. Copy them off"
echo "   the host (rclone/scp/S3) or a disk failure takes both with it."
echo ""
echo "To restore:"
echo "  gunzip -c $DB_FILE | docker compose exec -T db psql -U \$DB_USER \$DB_NAME"
echo "  gunzip -c $FILES_FILE | docker compose exec -T app tar -x -C /app/storage"
