-- CreateTable
CREATE TABLE "sfs_multi_diamond_discount_tiers" (
    "id" TEXT NOT NULL,
    "minDiamondCount" INTEGER NOT NULL,
    "discountPercent" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfs_multi_diamond_discount_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfs_customer_multi_diamond_discount_tiers" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "minDiamondCount" INTEGER NOT NULL,
    "discountPercent" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfs_customer_multi_diamond_discount_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sfs_multi_diamond_discount_tiers_minDiamondCount_key" ON "sfs_multi_diamond_discount_tiers"("minDiamondCount");

-- CreateIndex
CREATE INDEX "sfs_customer_multi_diamond_discount_tiers_customerId_idx" ON "sfs_customer_multi_diamond_discount_tiers"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sfs_customer_multi_diamond_discount_tiers_customerId_minDia_key" ON "sfs_customer_multi_diamond_discount_tiers"("customerId", "minDiamondCount");

-- AddForeignKey
ALTER TABLE "sfs_customer_multi_diamond_discount_tiers" ADD CONSTRAINT "sfs_customer_multi_diamond_discount_tiers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sfs_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
