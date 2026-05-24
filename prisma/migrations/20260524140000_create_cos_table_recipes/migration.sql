-- CreateTable
CREATE TABLE "cos_table_recipe_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_recipe_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_table_recipes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batchQuantity" DECIMAL(12,3) NOT NULL DEFAULT 100,
    "unitCost" DECIMAL(12,4),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_table_recipe_items" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,4),
    "amount" DECIMAL(14,4),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_recipe_categories_code_key" ON "cos_table_recipe_categories"("code");

-- CreateIndex
CREATE INDEX "cos_table_recipe_categories_sortOrder_idx" ON "cos_table_recipe_categories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_recipes_code_key" ON "cos_table_recipes"("code");

-- CreateIndex
CREATE INDEX "cos_table_recipes_categoryId_name_idx" ON "cos_table_recipes"("categoryId", "name");

-- CreateIndex
CREATE INDEX "cos_table_recipe_items_recipeId_sortOrder_idx" ON "cos_table_recipe_items"("recipeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "cos_table_recipes" ADD CONSTRAINT "cos_table_recipes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cos_table_recipe_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "cos_table_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_recipe_items" ADD CONSTRAINT "cos_table_recipe_items_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "cos_table_raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
