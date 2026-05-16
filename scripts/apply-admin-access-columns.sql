-- Run once on any DB that has users table but missing admin columns.
-- Usage:
--   npx prisma db execute --file scripts/apply-admin-access-columns.sql
--   # or: psql "$DATABASE_URL" -f scripts/apply-admin-access-columns.sql

-- Platform enum: COSMICOAT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Platform' AND e.enumlabel = 'COSMICOAT'
  ) THEN
    ALTER TYPE "Platform" ADD VALUE 'COSMICOAT';
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminPlatforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminMenuKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
