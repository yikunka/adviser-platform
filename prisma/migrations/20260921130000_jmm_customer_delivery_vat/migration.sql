-- AlterTable
ALTER TABLE "jmm_customers" ADD COLUMN     "deliveryAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vatNumber" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "jmm_customers_vatNumber_idx" ON "jmm_customers"("vatNumber");
