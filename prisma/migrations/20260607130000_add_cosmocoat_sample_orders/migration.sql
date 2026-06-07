-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CosSampleOrderStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: CosmoCoat 打样单 / 样品单
CREATE TABLE IF NOT EXISTS "cos_sample_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "CosSampleOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_sample_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 打样单关联工艺书
CREATE TABLE IF NOT EXISTS "cos_sample_order_process_kits" (
    "id" TEXT NOT NULL,
    "sampleOrderId" TEXT NOT NULL,
    "processKitId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_sample_order_process_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 打样单关联调色配方
CREATE TABLE IF NOT EXISTS "cos_sample_order_color_formulas" (
    "id" TEXT NOT NULL,
    "sampleOrderId" TEXT NOT NULL,
    "colorFormulaId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_sample_order_color_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cos_sample_orders_code_key" ON "cos_sample_orders"("code");
CREATE INDEX IF NOT EXISTS "cos_sample_orders_customerId_idx" ON "cos_sample_orders"("customerId");
CREATE INDEX IF NOT EXISTS "cos_sample_orders_status_createdAt_idx" ON "cos_sample_orders"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "cos_sample_order_process_kits_sampleOrderId_sortOrder_idx" ON "cos_sample_order_process_kits"("sampleOrderId", "sortOrder");
CREATE INDEX IF NOT EXISTS "cos_sample_order_process_kits_processKitId_idx" ON "cos_sample_order_process_kits"("processKitId");
CREATE INDEX IF NOT EXISTS "cos_sample_order_color_formulas_sampleOrderId_sortOrder_idx" ON "cos_sample_order_color_formulas"("sampleOrderId", "sortOrder");
CREATE INDEX IF NOT EXISTS "cos_sample_order_color_formulas_colorFormulaId_idx" ON "cos_sample_order_color_formulas"("colorFormulaId");

-- AddForeignKey
ALTER TABLE "cos_sample_orders" DROP CONSTRAINT IF EXISTS "cos_sample_orders_customerId_fkey";
ALTER TABLE "cos_sample_orders" ADD CONSTRAINT "cos_sample_orders_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "cos_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cos_sample_orders" DROP CONSTRAINT IF EXISTS "cos_sample_orders_createdById_fkey";
ALTER TABLE "cos_sample_orders" ADD CONSTRAINT "cos_sample_orders_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_sample_order_process_kits" DROP CONSTRAINT IF EXISTS "cos_sample_order_process_kits_sampleOrderId_fkey";
ALTER TABLE "cos_sample_order_process_kits" ADD CONSTRAINT "cos_sample_order_process_kits_sampleOrderId_fkey"
    FOREIGN KEY ("sampleOrderId") REFERENCES "cos_sample_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cos_sample_order_process_kits" DROP CONSTRAINT IF EXISTS "cos_sample_order_process_kits_processKitId_fkey";
ALTER TABLE "cos_sample_order_process_kits" ADD CONSTRAINT "cos_sample_order_process_kits_processKitId_fkey"
    FOREIGN KEY ("processKitId") REFERENCES "cos_process_kits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cos_sample_order_color_formulas" DROP CONSTRAINT IF EXISTS "cos_sample_order_color_formulas_sampleOrderId_fkey";
ALTER TABLE "cos_sample_order_color_formulas" ADD CONSTRAINT "cos_sample_order_color_formulas_sampleOrderId_fkey"
    FOREIGN KEY ("sampleOrderId") REFERENCES "cos_sample_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cos_sample_order_color_formulas" DROP CONSTRAINT IF EXISTS "cos_sample_order_color_formulas_colorFormulaId_fkey";
ALTER TABLE "cos_sample_order_color_formulas" ADD CONSTRAINT "cos_sample_order_color_formulas_colorFormulaId_fkey"
    FOREIGN KEY ("colorFormulaId") REFERENCES "cos_table_color_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
