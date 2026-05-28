-- AlterTable
ALTER TABLE "cos_table_products" ADD COLUMN "ir_curing_time" INTEGER,
ADD COLUMN "ir_curing_temp" INTEGER,
ADD COLUMN "uv_curing_intensity" DECIMAL(8,2),
ADD COLUMN "uv_curing_unit" TEXT;
