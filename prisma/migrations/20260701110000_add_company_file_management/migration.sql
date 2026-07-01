CREATE TYPE "CompanyFileAssetType" AS ENUM (
  'COMPANY_BOX',
  'COMPANY_SQUARE_SEAL',
  'COMPANY_ROUND_SEAL'
);

CREATE TYPE "CompanyFileMovementType" AS ENUM ('IN', 'OUT');

ALTER TABLE "companies"
  ADD COLUMN "hasCompanyBox" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasCompanySquareSeal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasCompanyRoundSeal" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "company_file_management_records" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "assetType" "CompanyFileAssetType" NOT NULL,
  "movementType" "CompanyFileMovementType" NOT NULL,
  "movementDate" TIMESTAMP(3) NOT NULL,
  "handler" TEXT NOT NULL,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_file_management_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_file_management_records_companyId_assetType_movemen_idx"
  ON "company_file_management_records"("companyId", "assetType", "movementDate");

CREATE INDEX "company_file_management_records_createdById_idx"
  ON "company_file_management_records"("createdById");

ALTER TABLE "company_file_management_records"
  ADD CONSTRAINT "company_file_management_records_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "company_file_management_records_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
