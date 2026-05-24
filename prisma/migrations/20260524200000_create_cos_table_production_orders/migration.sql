-- CreateTable
CREATE TABLE "cos_table_production_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "factoryProductId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "totalWeight" DECIMAL(12,3) NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "productionNotes" TEXT NOT NULL DEFAULT '',
    "qualityNotes" TEXT NOT NULL DEFAULT '',
    "packagingNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_table_production_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productionCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "percentage" DECIMAL(8,4) NOT NULL,
    "requiredWeight" DECIMAL(12,3) NOT NULL,
    "actualWeight" DECIMAL(12,3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_production_orders_code_key" ON "cos_table_production_orders"("code");

-- CreateIndex
CREATE INDEX "cos_table_production_orders_factoryProductId_idx" ON "cos_table_production_orders"("factoryProductId");

-- CreateIndex
CREATE INDEX "cos_table_production_orders_createdAt_idx" ON "cos_table_production_orders"("createdAt");

-- CreateIndex
CREATE INDEX "cos_table_production_order_items_orderId_sortOrder_idx" ON "cos_table_production_order_items"("orderId", "sortOrder");

-- AddForeignKey
ALTER TABLE "cos_table_production_orders" ADD CONSTRAINT "cos_table_production_orders_factoryProductId_fkey" FOREIGN KEY ("factoryProductId") REFERENCES "cos_table_factory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_production_orders" ADD CONSTRAINT "cos_table_production_orders_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "cos_table_recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_production_order_items" ADD CONSTRAINT "cos_table_production_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "cos_table_production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_production_order_items" ADD CONSTRAINT "cos_table_production_order_items_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "cos_table_raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
