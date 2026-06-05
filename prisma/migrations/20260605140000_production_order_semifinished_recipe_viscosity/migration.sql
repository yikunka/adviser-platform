-- AlterTable
ALTER TABLE "cos_table_recipes" ADD COLUMN "viscosity" TEXT,
ADD COLUMN "viscosity_unit" TEXT;

-- AlterTable
ALTER TABLE "cos_table_production_order_items" ALTER COLUMN "rawMaterialId" DROP NOT NULL,
ADD COLUMN "productSemifinishedId" TEXT;

-- CreateIndex
CREATE INDEX "cos_table_production_order_items_productSemifinishedId_idx" ON "cos_table_production_order_items"("productSemifinishedId");

-- AddForeignKey
ALTER TABLE "cos_table_production_order_items" ADD CONSTRAINT "cos_table_production_order_items_productSemifinishedId_fkey" FOREIGN KEY ("productSemifinishedId") REFERENCES "cos_table_product_semifinished"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
