-- AlterTable
ALTER TABLE "cos_table_production_orders" ADD COLUMN "production_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_production_orders" ADD COLUMN "quality_check_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_production_orders" ADD COLUMN "packaging_requirements" TEXT NOT NULL DEFAULT '';
