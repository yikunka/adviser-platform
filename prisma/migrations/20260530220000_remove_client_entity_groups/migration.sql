-- Drop foreign keys referencing client_entity_groups
ALTER TABLE "adv_accounts" DROP CONSTRAINT IF EXISTS "adv_accounts_groupId_fkey";
ALTER TABLE "adv_ledger" DROP CONSTRAINT IF EXISTS "adv_ledger_groupId_fkey";
ALTER TABLE "adv_journal_entries" DROP CONSTRAINT IF EXISTS "adv_journal_entries_groupId_fkey";
ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "companies_groupId_fkey";

-- Drop indexes on groupId columns
DROP INDEX IF EXISTS "adv_accounts_groupId_idx";
DROP INDEX IF EXISTS "adv_ledger_groupId_accountId_date_lineNum_idx";
DROP INDEX IF EXISTS "adv_journal_entries_groupId_idx";
DROP INDEX IF EXISTS "companies_groupId_idx";

-- Drop groupId columns from financial and company tables
ALTER TABLE "adv_accounts" DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "adv_ledger" DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "adv_journal_entries" DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "groupId";

-- Drop client entity group membership and group tables
DROP TABLE IF EXISTS "client_entity_group_members";
DROP TABLE IF EXISTS "client_entity_groups";
