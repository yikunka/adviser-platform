-- Reserve client email before signup; linked on registration via claim helper
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "pendingClientEmail" TEXT;
CREATE INDEX IF NOT EXISTS "companies_pendingClientEmail_idx" ON "companies"("pendingClientEmail");
