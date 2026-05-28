-- AlterTable
ALTER TABLE "cos_table_products" ADD COLUMN "mixing_ratio" TEXT,
ADD COLUMN "compatible_products" TEXT,
ADD COLUMN "requires_compatibility" BOOLEAN NOT NULL DEFAULT false;
