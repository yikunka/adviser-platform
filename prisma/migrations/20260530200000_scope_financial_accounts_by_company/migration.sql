ALTER TABLE "adv_accounts"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "groupId" TEXT;

ALTER TABLE "adv_accounts" DROP CONSTRAINT IF EXISTS "adv_accounts_code_key";
DROP INDEX IF EXISTS "adv_accounts_code_key";

CREATE TEMP TABLE "_financial_account_company_map" AS
SELECT
  a."id" AS "oldId",
  c."id" AS "companyId",
  c."groupId" AS "groupId",
  ('fa_' || substr(md5(a."id" || ':' || c."id"), 1, 22)) AS "newId"
FROM "adv_accounts" a
CROSS JOIN "companies" c
WHERE a."companyId" IS NULL;

INSERT INTO "adv_accounts" (
  "id",
  "code",
  "name",
  "type",
  "parentId",
  "companyId",
  "groupId",
  "level",
  "sortOrder",
  "isSystem",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  m."newId",
  a."code",
  a."name",
  a."type",
  NULL,
  m."companyId",
  m."groupId",
  a."level",
  a."sortOrder",
  a."isSystem",
  a."notes",
  a."createdAt",
  now()
FROM "_financial_account_company_map" m
JOIN "adv_accounts" a ON a."id" = m."oldId"
ON CONFLICT DO NOTHING;

UPDATE "adv_accounts" child
SET "parentId" = parent_map."newId"
FROM "_financial_account_company_map" child_map
JOIN "adv_accounts" old_child ON old_child."id" = child_map."oldId"
JOIN "_financial_account_company_map" parent_map
  ON parent_map."oldId" = old_child."parentId"
  AND parent_map."companyId" = child_map."companyId"
WHERE child."id" = child_map."newId";

UPDATE "adv_journal_lines" line
SET "accountId" = map."newId"
FROM "adv_journal_entries" entry, "_financial_account_company_map" map
WHERE line."entryId" = entry."id"
  AND map."oldId" = line."accountId"
  AND map."companyId" = entry."companyId"
  AND entry."companyId" IS NOT NULL;

UPDATE "adv_ledger" ledger
SET "accountId" = map."newId"
FROM "_financial_account_company_map" map
WHERE ledger."accountId" = map."oldId"
  AND ledger."companyId" = map."companyId"
  AND ledger."companyId" IS NOT NULL;

DROP TABLE "_financial_account_company_map";

CREATE UNIQUE INDEX IF NOT EXISTS "adv_accounts_companyId_code_key"
  ON "adv_accounts"("companyId", "code");

CREATE INDEX IF NOT EXISTS "adv_accounts_companyId_idx"
  ON "adv_accounts"("companyId");

CREATE INDEX IF NOT EXISTS "adv_accounts_groupId_idx"
  ON "adv_accounts"("groupId");

ALTER TABLE "adv_accounts"
  ADD CONSTRAINT "adv_accounts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "adv_accounts"
  ADD CONSTRAINT "adv_accounts_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "client_entity_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
