-- AlterTable: add reference sample image URL
ALTER TABLE "cos_sample_orders" ADD COLUMN IF NOT EXISTS "referenceImageUrl" TEXT;

-- Remove duplicate process-kit rows (keep earliest sortOrder per sample order)
DELETE FROM "cos_sample_order_process_kits" AS dup
WHERE dup."id" NOT IN (
  SELECT DISTINCT ON ("sampleOrderId") "id"
  FROM "cos_sample_order_process_kits"
  ORDER BY "sampleOrderId", "sortOrder" ASC, "createdAt" ASC
);

-- DropIndex
DROP INDEX IF EXISTS "cos_sample_order_process_kits_sampleOrderId_sortOrder_idx";

-- CreateIndex: one process kit per sample order
CREATE UNIQUE INDEX IF NOT EXISTS "cos_sample_order_process_kits_sampleOrderId_key" ON "cos_sample_order_process_kits"("sampleOrderId");
