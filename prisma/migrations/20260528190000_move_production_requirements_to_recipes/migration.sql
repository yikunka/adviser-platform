-- Add production requirement fields to recipes
ALTER TABLE "cos_table_recipes" ADD COLUMN "stirring_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_recipes" ADD COLUMN "packaging_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_recipes" ADD COLUMN "production_notes" TEXT NOT NULL DEFAULT '';

-- Migrate existing factory product data into linked current recipe (recipe fields stay empty only)
UPDATE "cos_table_recipes" r
SET "stirring_requirements" = fp."production_requirements"
FROM "cos_table_factory_products" fp
WHERE fp."current_recipe_id" = r."id"
  AND fp."production_requirements" <> ''
  AND r."stirring_requirements" = '';

UPDATE "cos_table_recipes" r
SET "packaging_requirements" = fp."packaging_requirements"
FROM "cos_table_factory_products" fp
WHERE fp."current_recipe_id" = r."id"
  AND fp."packaging_requirements" <> ''
  AND r."packaging_requirements" = '';

UPDATE "cos_table_recipes" r
SET "production_notes" = fp."quality_check_requirements"
FROM "cos_table_factory_products" fp
WHERE fp."current_recipe_id" = r."id"
  AND fp."quality_check_requirements" <> ''
  AND r."production_notes" = '';

UPDATE "cos_table_recipes" r
SET "production_notes" = r."production_notes" || E'\n\n【原质检要求-待确认】\n' || fp."quality_check_requirements"
FROM "cos_table_factory_products" fp
WHERE fp."current_recipe_id" = r."id"
  AND fp."quality_check_requirements" <> ''
  AND r."production_notes" <> ''
  AND r."production_notes" NOT LIKE '%【原质检要求-待确认】%'
  AND fp."quality_check_requirements" IS DISTINCT FROM r."production_notes";

-- Remove fields from factory products
ALTER TABLE "cos_table_factory_products" DROP COLUMN "production_requirements";
ALTER TABLE "cos_table_factory_products" DROP COLUMN "quality_check_requirements";
ALTER TABLE "cos_table_factory_products" DROP COLUMN "packaging_requirements";
