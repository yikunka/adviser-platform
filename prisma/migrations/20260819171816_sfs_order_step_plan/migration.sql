-- AlterTable
ALTER TABLE "sfs_orders" ADD COLUMN IF NOT EXISTS "stepPlan" JSONB;

-- AlterTable
ALTER TABLE "sfs_order_steps" ADD COLUMN IF NOT EXISTS "planStepId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sfs_order_steps_orderId_planStepId_idx" ON "sfs_order_steps"("orderId", "planStepId");
