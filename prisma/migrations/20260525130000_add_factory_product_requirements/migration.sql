-- AlterTable
ALTER TABLE "cos_table_factory_products" ADD COLUMN     "production_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_factory_products" ADD COLUMN     "quality_check_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_factory_products" ADD COLUMN     "packaging_requirements" TEXT NOT NULL DEFAULT '';
