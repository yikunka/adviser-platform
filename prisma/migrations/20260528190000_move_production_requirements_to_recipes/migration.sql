-- Add production requirement fields to recipes (idempotent)
ALTER TABLE "cos_table_recipes" ADD COLUMN IF NOT EXISTS "stirring_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_recipes" ADD COLUMN IF NOT EXISTS "packaging_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_recipes" ADD COLUMN IF NOT EXISTS "production_notes"       TEXT NOT NULL DEFAULT '';

-- Migrate existing factory product data into linked recipes.
-- Wrapped in a DO block so it is skipped safely if the source columns no longer exist
-- (e.g. the DB was already migrated manually or via db push).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cos_table_factory_products'
      AND column_name = 'production_requirements'
  ) THEN
    UPDATE "cos_table_recipes" r
    SET "stirring_requirements" = fp."production_requirements"
    FROM "cos_table_factory_products" fp
    WHERE fp."currentRecipeId" = r."id"
      AND fp."production_requirements" <> ''
      AND r."stirring_requirements" = '';

    UPDATE "cos_table_recipes" r
    SET "packaging_requirements" = fp."packaging_requirements"
    FROM "cos_table_factory_products" fp
    WHERE fp."currentRecipeId" = r."id"
      AND fp."packaging_requirements" <> ''
      AND r."packaging_requirements" = '';

    UPDATE "cos_table_recipes" r
    SET "production_notes" = fp."quality_check_requirements"
    FROM "cos_table_factory_products" fp
    WHERE fp."currentRecipeId" = r."id"
      AND fp."quality_check_requirements" <> ''
      AND r."production_notes" = '';

    UPDATE "cos_table_recipes" r
    SET "production_notes" = r."production_notes"
                          || E'\n\n【原质检要求-待确认】\n'
                          || fp."quality_check_requirements"
    FROM "cos_table_factory_products" fp
    WHERE fp."currentRecipeId" = r."id"
      AND fp."quality_check_requirements" <> ''
      AND r."production_notes" <> ''
      AND r."production_notes" NOT LIKE '%【原质检要求-待确认】%'
      AND fp."quality_check_requirements" IS DISTINCT FROM r."production_notes";
  END IF;
END $$;

-- Remove fields from factory products (idempotent)
ALTER TABLE "cos_table_factory_products" DROP COLUMN IF EXISTS "production_requirements";
ALTER TABLE "cos_table_factory_products" DROP COLUMN IF EXISTS "quality_check_requirements";
ALTER TABLE "cos_table_factory_products" DROP COLUMN IF EXISTS "packaging_requirements";
