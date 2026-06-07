ALTER TABLE "cos_table_production_order_items"
ADD COLUMN "componentRecipeId" TEXT;

CREATE INDEX "cos_table_production_order_items_componentRecipeId_idx"
ON "cos_table_production_order_items"("componentRecipeId");

ALTER TABLE "cos_table_production_order_items"
ADD CONSTRAINT "cos_table_production_order_items_componentRecipeId_fkey"
FOREIGN KEY ("componentRecipeId") REFERENCES "cos_table_recipes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
