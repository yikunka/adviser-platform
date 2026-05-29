-- Align journal status values with the Adviser financial UI/API and retain
-- deterministic ledger ordering by original journal line order.
ALTER TYPE "JournalStatus" RENAME VALUE 'REVERSED' TO 'CANCELLED';

ALTER TABLE "adv_ledger" ADD COLUMN "lineNum" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "adv_journal_entries" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "adv_journal_entries" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "adv_ledger_accountId_date_idx";
CREATE INDEX "adv_ledger_accountId_date_lineNum_idx" ON "adv_ledger"("accountId", "date", "lineNum");
