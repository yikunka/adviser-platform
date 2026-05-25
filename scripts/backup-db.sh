#!/usr/bin/env bash
# Dump PostgreSQL (Docker or DATABASE_URL) and upload to OSS with retention.
#
# Usage (manual):
#   ./scripts/backup-db.sh
#
# Cron (every 3 days at 03:00 HKT, adjust path):
#   0 3 */3 * * cd /opt/adviser && ./scripts/backup-db.sh >> /var/log/adviser-backup.log 2>&1
#
# Requires: gzip, node, OSS env vars in .env (see .env.example)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="/tmp/adviser_backup_${TIMESTAMP}.sql.gz"

cleanup() {
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

echo "[$(date -Iseconds)] Starting database backup..."

if command -v docker >/dev/null 2>&1 && docker compose ps db 2>/dev/null | grep -qE 'running|Up'; then
  echo "Using docker compose db service"
  docker compose exec -T db pg_dump -U adviser adviser_db | gzip > "$DUMP_FILE"
elif [[ -n "${DATABASE_URL:-}" ]] && command -v pg_dump >/dev/null; then
  echo "Using pg_dump with DATABASE_URL"
  pg_dump "$DATABASE_URL" | gzip > "$DUMP_FILE"
else
  echo "ERROR: No running docker compose db service and no pg_dump + DATABASE_URL available." >&2
  exit 1
fi

SIZE_MB="$(du -m "$DUMP_FILE" | awk '{print $1}')"
echo "Local dump ready: ${DUMP_FILE} (${SIZE_MB} MB)"

node "$SCRIPT_DIR/backup-db-to-oss.mjs" "$DUMP_FILE"

echo "[$(date -Iseconds)] Backup finished."
