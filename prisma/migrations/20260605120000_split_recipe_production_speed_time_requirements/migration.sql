-- Split stirring_requirements into production_speed_requirements and production_time_requirements
ALTER TABLE "cos_table_recipes" ADD COLUMN "production_speed_requirements" TEXT NOT NULL DEFAULT '';
ALTER TABLE "cos_table_recipes" ADD COLUMN "production_time_requirements" TEXT NOT NULL DEFAULT '';

UPDATE "cos_table_recipes"
SET
  "production_speed_requirements" = CASE
    WHEN position('/' in replace("stirring_requirements", ' / ', '/')) > 0
    THEN trim(split_part(replace("stirring_requirements", ' / ', '/'), '/', 1))
    ELSE "stirring_requirements"
  END,
  "production_time_requirements" = CASE
    WHEN position('/' in replace("stirring_requirements", ' / ', '/')) > 0
    THEN trim(split_part(replace("stirring_requirements", ' / ', '/'), '/', 2))
    ELSE ''
  END
WHERE "stirring_requirements" <> '';

ALTER TABLE "cos_table_recipes" DROP COLUMN "stirring_requirements";
