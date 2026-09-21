-- AlterTable
ALTER TABLE "sfs_customers" ADD COLUMN     "company" TEXT,
ADD COLUMN     "expectedVolume" TEXT,
ADD COLUMN     "market" TEXT,
ADD COLUMN     "moqNote" TEXT,
ADD COLUMN     "territoryNote" TEXT;

-- CreateIndex
CREATE INDEX "sfs_customers_market_idx" ON "sfs_customers"("market");
