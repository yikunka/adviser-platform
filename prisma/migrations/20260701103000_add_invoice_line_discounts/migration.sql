CREATE TYPE "InvoiceLineDiscountType" AS ENUM ('PERCENT', 'FIXED');

ALTER TABLE "invoice_line_items"
  ADD COLUMN "discountType" "InvoiceLineDiscountType",
  ADD COLUMN "discountValue" DECIMAL(10, 4);
