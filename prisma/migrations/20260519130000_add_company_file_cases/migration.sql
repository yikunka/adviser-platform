CREATE TABLE "company_file_cases" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "caseDate" TIMESTAMP(3),
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_file_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_file_cases_companyId_idx" ON "company_file_cases"("companyId");

ALTER TABLE "company_file_cases"
ADD CONSTRAINT "company_file_cases_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"
ADD COLUMN "fileCaseId" TEXT,
ADD COLUMN "caseFileRole" TEXT,
ADD COLUMN "customDocumentType" TEXT,
ADD COLUMN "submissionDate" TIMESTAMP(3);

ALTER TABLE "documents"
ADD CONSTRAINT "documents_fileCaseId_fkey"
FOREIGN KEY ("fileCaseId") REFERENCES "company_file_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
