-- Denormalize company/entity-group scope onto ledger rows so balances and
-- ledger filtering stay isolated per client company.

ALTER TABLE "adv_ledger" ADD COLUMN "companyId" TEXT;
ALTER TABLE "adv_ledger" ADD COLUMN "groupId" TEXT;

UPDATE "adv_ledger" l
SET
  "companyId" = j."companyId",
  "groupId" = j."groupId"
FROM "adv_journal_entries" j
WHERE l."entryId" = j."id";

CREATE INDEX "adv_ledger_companyId_accountId_date_lineNum_idx" ON "adv_ledger"("companyId", "accountId", "date", "lineNum");
CREATE INDEX "adv_ledger_groupId_accountId_date_lineNum_idx" ON "adv_ledger"("groupId", "accountId", "date", "lineNum");

ALTER TABLE "adv_ledger" ADD CONSTRAINT "adv_ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "adv_ledger" ADD CONSTRAINT "adv_ledger_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "client_entity_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
