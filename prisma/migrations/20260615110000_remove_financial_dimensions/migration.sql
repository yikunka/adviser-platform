ALTER TABLE "adv_journal_lines"
DROP CONSTRAINT IF EXISTS "adv_journal_lines_costCenterId_fkey",
DROP CONSTRAINT IF EXISTS "adv_journal_lines_projectId_fkey";

ALTER TABLE "adv_journal_lines"
DROP COLUMN IF EXISTS "costCenterId",
DROP COLUMN IF EXISTS "projectId";

DROP TABLE IF EXISTS "adv_cost_centers";
DROP TABLE IF EXISTS "adv_fin_projects";
