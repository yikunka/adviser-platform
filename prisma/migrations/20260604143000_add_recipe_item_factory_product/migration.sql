-- 配方行可引用工厂成品
ALTER TABLE "cos_table_recipe_items" ADD COLUMN "factoryProductId" TEXT;

CREATE INDEX "cos_table_recipe_items_factoryProductId_idx" ON "cos_table_recipe_items"("factoryProductId");

ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_factoryProductId_fkey"
  FOREIGN KEY ("factoryProductId") REFERENCES "cos_table_factory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT IF EXISTS "cos_table_recipe_items_material_xor_check";

ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_material_xor_check"
  CHECK (
    (
      ("rawMaterialId" IS NOT NULL)::int +
      ("componentRecipeId" IS NOT NULL)::int +
      ("productSemifinishedId" IS NOT NULL)::int +
      ("factoryProductId" IS NOT NULL)::int
    ) = 1
  );
