CREATE TABLE IF NOT EXISTS "adv_contracts" (
    "id" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "adv_contracts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "adv_contracts_contractName_idx" ON "adv_contracts"("contractName");
CREATE INDEX IF NOT EXISTS "adv_contracts_startDate_idx" ON "adv_contracts"("startDate");
CREATE INDEX IF NOT EXISTS "adv_contracts_endDate_idx" ON "adv_contracts"("endDate");

ALTER TABLE "adv_contracts"
ADD CONSTRAINT "adv_contracts_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "adv_tcsp_service_prices" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "customerLevel" TEXT NOT NULL,
    "serviceCategory" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "adv_tcsp_service_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "adv_tcsp_service_prices_jurisdiction_customerLevel_serviceCategory_serviceName_key"
ON "adv_tcsp_service_prices"("jurisdiction", "customerLevel", "serviceCategory", "serviceName");

CREATE INDEX IF NOT EXISTS "adv_tcsp_service_prices_jurisdiction_customerLevel_idx"
ON "adv_tcsp_service_prices"("jurisdiction", "customerLevel");

ALTER TABLE "adv_tcsp_service_prices"
ADD CONSTRAINT "adv_tcsp_service_prices_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "adv_tcsp_service_prices"
ADD CONSTRAINT "adv_tcsp_service_prices_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
