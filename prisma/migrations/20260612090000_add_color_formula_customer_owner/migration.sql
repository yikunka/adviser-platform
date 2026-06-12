ALTER TABLE "cos_table_color_formulas"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "technicalOwnerId" TEXT;

UPDATE "cos_table_color_formulas" AS formula
SET "customerId" = (
  SELECT customer.id
  FROM "cos_customers" AS customer
  WHERE lower(btrim(customer.name)) = lower(btrim(formula."customerName"))
  ORDER BY customer."updatedAt" DESC
  LIMIT 1
)
WHERE formula."customerId" IS NULL
  AND btrim(formula."customerName") <> '';

CREATE INDEX "cos_table_color_formulas_customerId_idx"
  ON "cos_table_color_formulas"("customerId");

CREATE INDEX "cos_table_color_formulas_technicalOwnerId_idx"
  ON "cos_table_color_formulas"("technicalOwnerId");

ALTER TABLE "cos_table_color_formulas"
  ADD CONSTRAINT "cos_table_color_formulas_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "cos_customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_table_color_formulas"
  ADD CONSTRAINT "cos_table_color_formulas_technicalOwnerId_fkey"
  FOREIGN KEY ("technicalOwnerId") REFERENCES "cos_employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
