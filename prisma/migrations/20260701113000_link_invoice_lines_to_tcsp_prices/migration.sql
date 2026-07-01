ALTER TABLE "invoice_line_items"
  ADD COLUMN "tcspServicePriceId" TEXT;

CREATE INDEX "invoice_line_items_tcspServicePriceId_idx"
  ON "invoice_line_items"("tcspServicePriceId");

ALTER TABLE "invoice_line_items"
  ADD CONSTRAINT "invoice_line_items_tcspServicePriceId_fkey"
    FOREIGN KEY ("tcspServicePriceId")
    REFERENCES "adv_tcsp_service_prices"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
