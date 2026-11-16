-- AlterTable
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddStorageKey" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddFileName" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddMimeType" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddFileSize" INTEGER;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddNotes" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddCompletedAt" TIMESTAMP(3);
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddCompletedById" TEXT;
ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "eddOutcome" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_eddCompletedById_fkey" FOREIGN KEY ("eddCompletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
