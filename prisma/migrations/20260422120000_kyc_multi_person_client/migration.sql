-- KeyPerson: client multi-KYC + fields aligned to KYC form
ALTER TABLE "key_persons" ADD COLUMN IF NOT EXISTS "submittedByUserId" TEXT;
ALTER TABLE "key_persons" ADD COLUMN IF NOT EXISTS "idType" TEXT;
ALTER TABLE "key_persons" ADD COLUMN IF NOT EXISTS "placeOfBirth" TEXT;
ALTER TABLE "key_persons" ADD COLUMN IF NOT EXISTS "isPep" BOOLEAN;
ALTER TABLE "key_persons" ADD COLUMN IF NOT EXISTS "sourceOfFunds" TEXT;

-- FK to users (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'key_persons_submittedByUserId_fkey'
  ) THEN
    ALTER TABLE "key_persons"
    ADD CONSTRAINT "key_persons_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "key_persons_submittedByUserId_idx" ON "key_persons"("submittedByUserId");
