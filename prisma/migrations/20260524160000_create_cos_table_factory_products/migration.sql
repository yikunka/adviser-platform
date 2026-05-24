-- CreateTable
CREATE TABLE "cos_table_factory_products" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "unitPrice" DECIMAL(12,4),
    "notes" TEXT NOT NULL DEFAULT '',
    "currentRecipeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_factory_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_table_product_recipes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cos_table_product_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_factory_products_productCode_key" ON "cos_table_factory_products"("productCode");

-- CreateIndex
CREATE INDEX "cos_table_factory_products_name_idx" ON "cos_table_factory_products"("name");

-- CreateIndex
CREATE INDEX "cos_table_factory_products_sortOrder_idx" ON "cos_table_factory_products"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_product_recipes_productId_recipeId_key" ON "cos_table_product_recipes"("productId", "recipeId");

-- CreateIndex
CREATE INDEX "cos_table_product_recipes_recipeId_idx" ON "cos_table_product_recipes"("recipeId");

-- AddForeignKey
ALTER TABLE "cos_table_factory_products" ADD CONSTRAINT "cos_table_factory_products_currentRecipeId_fkey" FOREIGN KEY ("currentRecipeId") REFERENCES "cos_table_recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_product_recipes" ADD CONSTRAINT "cos_table_product_recipes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "cos_table_factory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_product_recipes" ADD CONSTRAINT "cos_table_product_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "cos_table_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
