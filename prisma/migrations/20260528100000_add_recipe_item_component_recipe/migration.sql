-- Allow recipe items to reference either a raw material or a semi-finished recipe (component).
ALTER TABLE "cos_table_recipe_items" ALTER COLUMN "rawMaterialId" DROP NOT NULL;

ALTER TABLE "cos_table_recipe_items" ADD COLUMN "componentRecipeId" TEXT;

CREATE INDEX "cos_table_recipe_items_componentRecipeId_idx" ON "cos_table_recipe_items"("componentRecipeId");

ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_componentRecipeId_fkey"
  FOREIGN KEY ("componentRecipeId") REFERENCES "cos_table_recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_material_xor_check"
  CHECK (
    ("rawMaterialId" IS NOT NULL AND "componentRecipeId" IS NULL)
    OR ("rawMaterialId" IS NULL AND "componentRecipeId" IS NOT NULL)
  );
