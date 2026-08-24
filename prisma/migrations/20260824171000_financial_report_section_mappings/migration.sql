-- CreateEnum
CREATE TYPE "FinancialReportSection" AS ENUM (
  'PL_REVENUE',
  'PL_COST_OF_SALES',
  'PL_EXPENSE_SALES',
  'PL_EXPENSE_ADMINISTRATIVE',
  'PL_EXPENSE_FINANCE',
  'BS_CURRENT_ASSETS',
  'BS_NON_CURRENT_ASSETS',
  'BS_CURRENT_LIABILITIES',
  'BS_NON_CURRENT_LIABILITIES',
  'BS_EQUITY'
);

-- CreateTable
CREATE TABLE "adv_financial_report_section_mappings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "section" "FinancialReportSection" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_financial_report_section_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adv_financial_report_section_mappings_companyId_section_idx" ON "adv_financial_report_section_mappings"("companyId", "section");

-- CreateIndex
CREATE INDEX "adv_financial_report_section_mappings_accountId_idx" ON "adv_financial_report_section_mappings"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "adv_financial_report_section_mappings_companyId_section_accountId_key" ON "adv_financial_report_section_mappings"("companyId", "section", "accountId");

-- AddForeignKey
ALTER TABLE "adv_financial_report_section_mappings" ADD CONSTRAINT "adv_financial_report_section_mappings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_financial_report_section_mappings" ADD CONSTRAINT "adv_financial_report_section_mappings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "adv_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
