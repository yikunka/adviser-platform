-- Add an optional per-company financial manager assignment.
ALTER TABLE "companies" ADD COLUMN "financialManagerId" TEXT;

CREATE INDEX "companies_financialManagerId_idx" ON "companies"("financialManagerId");

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_financialManagerId_fkey"
  FOREIGN KEY ("financialManagerId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
