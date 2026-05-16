#!/bin/sh
set -e
# Production: apply pending migrations before starting Next.js (idempotent).
# Opt out: docker run -e SKIP_PRISMA_MIGRATE=1 …

if [ "${SKIP_PRISMA_MIGRATE:-}" = "1" ]; then
  echo "[entrypoint] SKIP_PRISMA_MIGRATE=1 — skipping prisma migrate deploy"
elif [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set; cannot run prisma migrate deploy"
  exit 1
else
  echo "[entrypoint] prisma migrate deploy…"
  prisma migrate deploy
fi

exec "$@"
