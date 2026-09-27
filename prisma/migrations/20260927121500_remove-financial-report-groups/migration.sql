-- DropForeignKey
ALTER TABLE "financial_report_groups" DROP CONSTRAINT "financial_report_groups_createdById_fkey";

-- DropForeignKey
ALTER TABLE "financial_report_group_companies" DROP CONSTRAINT "financial_report_group_companies_groupId_fkey";

-- DropForeignKey
ALTER TABLE "financial_report_group_companies" DROP CONSTRAINT "financial_report_group_companies_companyId_fkey";

-- DropTable
DROP TABLE "financial_report_group_companies";

-- DropTable
DROP TABLE "financial_report_groups";
