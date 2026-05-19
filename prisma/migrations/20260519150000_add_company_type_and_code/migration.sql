ALTER TABLE "companies"
ADD COLUMN "companyType" TEXT,
ADD COLUMN "companyCode" TEXT;

CREATE UNIQUE INDEX "companies_companyCode_key" ON "companies"("companyCode");
