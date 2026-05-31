-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "financialEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "cos_process_kits" ADD COLUMN IF NOT EXISTS "materials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "cos_process_kits" ADD COLUMN IF NOT EXISTS "otherNote" TEXT;
ALTER TABLE "cos_process_kits" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;
ALTER TABLE "cos_process_kits" ADD COLUMN IF NOT EXISTS "updatedByName" TEXT;

ALTER TABLE "cos_process_kits" DROP CONSTRAINT IF EXISTS "cos_process_kits_updatedBy_fkey";
ALTER TABLE "cos_process_kits" ADD CONSTRAINT "cos_process_kits_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
