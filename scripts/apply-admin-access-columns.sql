-- Run once on any DB that has users table but missing admin columns.
-- Usage:
--   npx prisma db execute --file scripts/apply-admin-access-columns.sql
--   # or: psql "$DATABASE_URL" -f scripts/apply-admin-access-columns.sql

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminPlatforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminMenuKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
