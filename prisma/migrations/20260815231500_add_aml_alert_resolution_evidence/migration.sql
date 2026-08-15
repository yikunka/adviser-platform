-- AlterTable
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "evidenceStorageKey" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "evidenceFileName" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "evidenceMimeType" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "evidenceFileSize" INTEGER;
