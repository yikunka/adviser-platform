-- CosmoCoat customers: optional assigned sales and technical employees.
ALTER TABLE "cos_customers"
ADD COLUMN IF NOT EXISTS "salesEmployeeId" TEXT,
ADD COLUMN IF NOT EXISTS "technicalEmployeeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cos_customers_salesEmployeeId_fkey'
  ) THEN
    ALTER TABLE "cos_customers"
    ADD CONSTRAINT "cos_customers_salesEmployeeId_fkey"
    FOREIGN KEY ("salesEmployeeId") REFERENCES "cos_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cos_customers_technicalEmployeeId_fkey'
  ) THEN
    ALTER TABLE "cos_customers"
    ADD CONSTRAINT "cos_customers_technicalEmployeeId_fkey"
    FOREIGN KEY ("technicalEmployeeId") REFERENCES "cos_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cos_customers_salesEmployeeId_idx" ON "cos_customers"("salesEmployeeId");
CREATE INDEX IF NOT EXISTS "cos_customers_technicalEmployeeId_idx" ON "cos_customers"("technicalEmployeeId");

-- CosmoCoat raw materials: optional links to supplier records while preserving editable supplier snapshots.
ALTER TABLE "cos_table_raw_materials"
ADD COLUMN IF NOT EXISTS "primarySupplierId" TEXT,
ADD COLUMN IF NOT EXISTS "primarySupplierContactPerson" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "primarySupplierContactInfo" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "primarySupplierAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "secondarySupplierId" TEXT,
ADD COLUMN IF NOT EXISTS "secondarySupplierContactPerson" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "secondarySupplierContactInfo" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "secondarySupplierAddress" TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cos_table_raw_materials_primarySupplierId_fkey'
  ) THEN
    ALTER TABLE "cos_table_raw_materials"
    ADD CONSTRAINT "cos_table_raw_materials_primarySupplierId_fkey"
    FOREIGN KEY ("primarySupplierId") REFERENCES "cos_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cos_table_raw_materials_secondarySupplierId_fkey'
  ) THEN
    ALTER TABLE "cos_table_raw_materials"
    ADD CONSTRAINT "cos_table_raw_materials_secondarySupplierId_fkey"
    FOREIGN KEY ("secondarySupplierId") REFERENCES "cos_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cos_table_raw_materials_primarySupplierId_idx" ON "cos_table_raw_materials"("primarySupplierId");
CREATE INDEX IF NOT EXISTS "cos_table_raw_materials_secondarySupplierId_idx" ON "cos_table_raw_materials"("secondarySupplierId");
