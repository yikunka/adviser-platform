-- Add CosmoCoat sample-order sales and technical employee assignments
ALTER TABLE "cos_sample_orders" ADD COLUMN IF NOT EXISTS "salesEmployeeId" TEXT;
ALTER TABLE "cos_sample_orders" ADD COLUMN IF NOT EXISTS "technicalEmployeeId" TEXT;

CREATE INDEX IF NOT EXISTS "cos_sample_orders_salesEmployeeId_idx"
    ON "cos_sample_orders"("salesEmployeeId");
CREATE INDEX IF NOT EXISTS "cos_sample_orders_technicalEmployeeId_idx"
    ON "cos_sample_orders"("technicalEmployeeId");

ALTER TABLE "cos_sample_orders" DROP CONSTRAINT IF EXISTS "cos_sample_orders_salesEmployeeId_fkey";
ALTER TABLE "cos_sample_orders" ADD CONSTRAINT "cos_sample_orders_salesEmployeeId_fkey"
    FOREIGN KEY ("salesEmployeeId") REFERENCES "cos_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_sample_orders" DROP CONSTRAINT IF EXISTS "cos_sample_orders_technicalEmployeeId_fkey";
ALTER TABLE "cos_sample_orders" ADD CONSTRAINT "cos_sample_orders_technicalEmployeeId_fkey"
    FOREIGN KEY ("technicalEmployeeId") REFERENCES "cos_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
