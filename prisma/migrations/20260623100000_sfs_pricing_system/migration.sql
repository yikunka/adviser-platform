-- SFS Diamond two-tier pricing + customer-differentiated pricing (#360)

-- AlterTable: per-customer overall discount rate
ALTER TABLE "sfs_customers" ADD COLUMN "discountRate" DECIMAL(5,4);

-- AlterTable: price on each spec option (meaning depends on category)
ALTER TABLE "sfs_diamond_spec_options" ADD COLUMN "price" DECIMAL(18,2);

-- CreateTable: per-customer base-price overrides for a specific spec option
CREATE TABLE "sfs_customer_price_overrides" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" "SfsDiamondSpecCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfs_customer_price_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: order-total diamond-count discount tiers
CREATE TABLE "sfs_diamond_price_tiers" (
    "id" TEXT NOT NULL,
    "minCount" INTEGER NOT NULL,
    "maxCount" INTEGER,
    "discountRate" DECIMAL(5,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfs_diamond_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sfs_customer_price_overrides_customerId_idx" ON "sfs_customer_price_overrides"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sfs_customer_price_overrides_customerId_category_value_key" ON "sfs_customer_price_overrides"("customerId", "category", "value");

-- CreateIndex
CREATE INDEX "sfs_diamond_price_tiers_sortOrder_idx" ON "sfs_diamond_price_tiers"("sortOrder");

-- AddForeignKey
ALTER TABLE "sfs_customer_price_overrides" ADD CONSTRAINT "sfs_customer_price_overrides_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sfs_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
