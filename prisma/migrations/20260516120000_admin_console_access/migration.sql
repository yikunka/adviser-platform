-- Admin Console: platform enum + per-staff platform/menu scope
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
