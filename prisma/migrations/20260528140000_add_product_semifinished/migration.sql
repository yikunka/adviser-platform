-- Sol. 半成品库存表，以及配方行可引用库存半成品
CREATE TABLE "cos_table_product_semifinished" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Sol.',
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "unitPrice" DECIMAL(12,4),
    "sourceProductionOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_product_semifinished_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cos_table_product_semifinished_code_key" ON "cos_table_product_semifinished"("code");
CREATE INDEX "cos_table_product_semifinished_category_idx" ON "cos_table_product_semifinished"("category");
CREATE INDEX "cos_table_product_semifinished_name_idx" ON "cos_table_product_semifinished"("name");
CREATE INDEX "cos_table_product_semifinished_sourceProductionOrderId_idx" ON "cos_table_product_semifinished"("sourceProductionOrderId");

ALTER TABLE "cos_table_product_semifinished" ADD CONSTRAINT "cos_table_product_semifinished_sourceProductionOrderId_fkey"
  FOREIGN KEY ("sourceProductionOrderId") REFERENCES "cos_table_production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_table_recipe_items" ADD COLUMN "productSemifinishedId" TEXT;

CREATE INDEX "cos_table_recipe_items_productSemifinishedId_idx" ON "cos_table_recipe_items"("productSemifinishedId");

ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_productSemifinishedId_fkey"
  FOREIGN KEY ("productSemifinishedId") REFERENCES "cos_table_product_semifinished"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT IF EXISTS "cos_table_recipe_items_material_xor_check";

ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_material_xor_check"
  CHECK (
    (
      ("rawMaterialId" IS NOT NULL)::int +
      ("componentRecipeId" IS NOT NULL)::int +
      ("productSemifinishedId" IS NOT NULL)::int
    ) = 1
  );
