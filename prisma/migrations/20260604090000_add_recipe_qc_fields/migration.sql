-- AlterTable
ALTER TABLE "cos_table_recipes" ADD COLUMN IF NOT EXISTS "qc_test_standard" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "qc_result" TEXT NOT NULL DEFAULT '';
