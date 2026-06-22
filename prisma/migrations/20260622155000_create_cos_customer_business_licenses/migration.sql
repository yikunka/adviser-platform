-- Recovery migration: the cos_customer_business_licenses table is defined in the
-- Prisma schema but no migration ever created it (a later migration only ALTERs it).
-- This recreates the genuinely-missing CREATE step. Idempotent so it is safe on
-- databases where the table was previously created out-of-band (e.g. via db push).

-- CreateTable
CREATE TABLE IF NOT EXISTS "cos_customer_business_licenses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BUSINESS_LICENSE',
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cos_customer_business_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cos_customer_business_licenses_customerId_idx" ON "cos_customer_business_licenses"("customerId");

-- AddForeignKey (guarded — ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cos_customer_business_licenses_customerId_fkey'
  ) THEN
    ALTER TABLE "cos_customer_business_licenses"
      ADD CONSTRAINT "cos_customer_business_licenses_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "cos_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cos_customer_business_licenses_uploadedById_fkey'
  ) THEN
    ALTER TABLE "cos_customer_business_licenses"
      ADD CONSTRAINT "cos_customer_business_licenses_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
