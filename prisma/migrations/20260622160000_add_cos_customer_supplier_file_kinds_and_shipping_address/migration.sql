ALTER TABLE "cos_customer_business_licenses"
ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'BUSINESS_LICENSE';

CREATE INDEX IF NOT EXISTS "cos_customer_business_licenses_customerId_kind_idx"
ON "cos_customer_business_licenses"("customerId", "kind");

ALTER TABLE "cos_suppliers"
ADD COLUMN IF NOT EXISTS "shippingAddress" TEXT;

ALTER TABLE "cos_supplier_files"
ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'GENERAL';

CREATE INDEX IF NOT EXISTS "cos_supplier_files_supplierId_kind_idx"
ON "cos_supplier_files"("supplierId", "kind");
