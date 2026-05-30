-- CreateEnum
CREATE TYPE "CosColorFormulaCategory" AS ENUM ('PU', 'BAKING_PAINT', 'HT_BAKING_PAINT', 'LT_BAKING_PAINT');

-- CreateTable
CREATE TABLE "cos_table_color_formulas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CosColorFormulaCategory" NOT NULL,
    "factoryProductId" TEXT,
    "sourceRecipeId" TEXT,
    "colorCode" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "targetColor" TEXT NOT NULL DEFAULT '',
    "batchQuantity" DECIMAL(12,3) NOT NULL DEFAULT 100,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_color_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_table_color_formula_items" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,4),
    "amount" DECIMAL(14,4),
    "percentage" DECIMAL(8,4),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_color_formula_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_color_formulas_code_key" ON "cos_table_color_formulas"("code");

-- CreateIndex
CREATE INDEX "cos_table_color_formulas_category_updatedAt_idx" ON "cos_table_color_formulas"("category", "updatedAt");

-- CreateIndex
CREATE INDEX "cos_table_color_formulas_factoryProductId_idx" ON "cos_table_color_formulas"("factoryProductId");

-- CreateIndex
CREATE INDEX "cos_table_color_formula_items_formulaId_sortOrder_idx" ON "cos_table_color_formula_items"("formulaId", "sortOrder");

-- CreateIndex
CREATE INDEX "cos_table_color_formula_items_rawMaterialId_idx" ON "cos_table_color_formula_items"("rawMaterialId");

-- AddForeignKey
ALTER TABLE "cos_table_color_formulas" ADD CONSTRAINT "cos_table_color_formulas_factoryProductId_fkey" FOREIGN KEY ("factoryProductId") REFERENCES "cos_table_factory_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_color_formulas" ADD CONSTRAINT "cos_table_color_formulas_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "cos_table_recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_color_formula_items" ADD CONSTRAINT "cos_table_color_formula_items_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "cos_table_color_formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_color_formula_items" ADD CONSTRAINT "cos_table_color_formula_items_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "cos_table_raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
