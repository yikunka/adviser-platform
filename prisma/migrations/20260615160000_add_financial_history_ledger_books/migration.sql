CREATE TABLE "adv_financial_history_ledger_books" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "sheets" JSONB NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "adv_financial_history_ledger_books_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "adv_financial_history_ledger_books_companyId_createdAt_idx"
  ON "adv_financial_history_ledger_books"("companyId", "createdAt");

CREATE INDEX "adv_financial_history_ledger_books_uploadedById_idx"
  ON "adv_financial_history_ledger_books"("uploadedById");

ALTER TABLE "adv_financial_history_ledger_books"
  ADD CONSTRAINT "adv_financial_history_ledger_books_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "adv_financial_history_ledger_books"
  ADD CONSTRAINT "adv_financial_history_ledger_books_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
