-- CreateEnum
CREATE TYPE "AMLScreenScope" AS ENUM ('SANCTIONS', 'FATF', 'PEP', 'FULL');

-- AlterTable
ALTER TABLE "aml_checks" ADD COLUMN     "scope" "AMLScreenScope" NOT NULL DEFAULT 'FULL';

-- CreateIndex
CREATE INDEX "aml_checks_keyPersonId_scope_checkedAt_idx" ON "aml_checks"("keyPersonId", "scope", "checkedAt");

-- CreateIndex
CREATE INDEX "aml_checks_companyId_scope_checkedAt_idx" ON "aml_checks"("companyId", "scope", "checkedAt");
