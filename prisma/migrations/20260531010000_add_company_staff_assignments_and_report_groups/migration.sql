-- Company-level staff permissions. Keeps companies as the accounting subject while
-- allowing multiple staff users to operate the same company.
CREATE TABLE IF NOT EXISTS "company_staff_assignments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_staff_assignments_pkey" PRIMARY KEY ("id")
);

INSERT INTO "company_staff_assignments" ("id", "companyId", "userId", "createdAt")
SELECT
  ('legacy_' || "id") AS "id",
  "id" AS "companyId",
  "assignedStaffId" AS "userId",
  CURRENT_TIMESTAMP AS "createdAt"
FROM "companies"
WHERE "assignedStaffId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "company_staff_assignments_companyId_userId_key"
  ON "company_staff_assignments"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "company_staff_assignments_userId_idx"
  ON "company_staff_assignments"("userId");
CREATE INDEX IF NOT EXISTS "company_staff_assignments_createdById_idx"
  ON "company_staff_assignments"("createdById");

ALTER TABLE "company_staff_assignments"
  ADD CONSTRAINT "company_staff_assignments_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_staff_assignments"
  ADD CONSTRAINT "company_staff_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_staff_assignments"
  ADD CONSTRAINT "company_staff_assignments_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Reporting-only portfolios for consolidated financial reports. These do not own
-- journal entries, ledger rows, or chart-of-account records.
CREATE TABLE IF NOT EXISTS "financial_report_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "financial_report_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_report_group_companies" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "financial_report_group_companies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "financial_report_groups_name_idx"
  ON "financial_report_groups"("name");
CREATE INDEX IF NOT EXISTS "financial_report_groups_createdById_idx"
  ON "financial_report_groups"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "financial_report_group_companies_groupId_companyId_key"
  ON "financial_report_group_companies"("groupId", "companyId");
CREATE INDEX IF NOT EXISTS "financial_report_group_companies_companyId_idx"
  ON "financial_report_group_companies"("companyId");
CREATE INDEX IF NOT EXISTS "financial_report_group_companies_groupId_sortOrder_idx"
  ON "financial_report_group_companies"("groupId", "sortOrder");

ALTER TABLE "financial_report_groups"
  ADD CONSTRAINT "financial_report_groups_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_report_group_companies"
  ADD CONSTRAINT "financial_report_group_companies_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "financial_report_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_report_group_companies"
  ADD CONSTRAINT "financial_report_group_companies_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
