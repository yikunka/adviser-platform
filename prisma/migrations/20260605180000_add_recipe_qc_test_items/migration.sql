-- AlterTable
ALTER TABLE "cos_table_recipes" ADD COLUMN IF NOT EXISTS "qc_test_items" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
