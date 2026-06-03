-- AlterTable: factory product viscosity supports free-text ranges (e.g. 9.7-9.8)
ALTER TABLE "cos_table_factory_products" ALTER COLUMN "viscosity" TYPE TEXT USING (
  CASE
    WHEN "viscosity" IS NULL THEN NULL
    ELSE TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM "viscosity"::text))
  END
);
