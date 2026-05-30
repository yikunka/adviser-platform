-- CreateTable
CREATE TABLE "cos_table_color_formula_subcategories" (
    "id" TEXT NOT NULL,
    "parentCategory" "CosColorFormulaCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_color_formula_subcategories_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "cos_table_color_formulas" ADD COLUMN "subcategoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_color_formula_subcategories_parentCategory_code_key" ON "cos_table_color_formula_subcategories"("parentCategory", "code");

-- CreateIndex
CREATE INDEX "cos_table_color_formula_subcategories_parentCategory_sortOrder_idx" ON "cos_table_color_formula_subcategories"("parentCategory", "sortOrder");

-- CreateIndex
CREATE INDEX "cos_table_color_formulas_subcategoryId_idx" ON "cos_table_color_formulas"("subcategoryId");

-- AddForeignKey
ALTER TABLE "cos_table_color_formulas" ADD CONSTRAINT "cos_table_color_formulas_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "cos_table_color_formula_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
