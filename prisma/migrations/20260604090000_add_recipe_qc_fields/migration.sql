-- AlterTable
ALTER TABLE "cos_table_recipes" ADD COLUMN     "qc_test_standard" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "qc_result" TEXT NOT NULL DEFAULT '';
