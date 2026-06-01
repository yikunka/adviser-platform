ALTER TABLE "cos_table_color_formula_items"
  ALTER COLUMN "rawMaterialId" DROP NOT NULL,
  ADD COLUMN "productSemifinishedId" TEXT,
  ADD COLUMN "manual_production_code" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manual_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manual_attribute_code" TEXT NOT NULL DEFAULT '';

CREATE INDEX "cos_table_color_formula_items_productSemifinishedId_idx"
  ON "cos_table_color_formula_items"("productSemifinishedId");

ALTER TABLE "cos_table_color_formula_items"
  ADD CONSTRAINT "cos_table_color_formula_items_productSemifinishedId_fkey"
  FOREIGN KEY ("productSemifinishedId")
  REFERENCES "cos_table_product_semifinished"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
