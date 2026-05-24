-- CreateTable
CREATE TABLE "cos_table_raw_materials" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "attributeCode" TEXT NOT NULL,
    "productionCode" TEXT NOT NULL,
    "huaxingCode" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "primarySupplierCode" TEXT NOT NULL DEFAULT '',
    "primarySupplierName" TEXT NOT NULL DEFAULT '',
    "primaryPackageKg" DECIMAL(12,2),
    "primaryPricePerKg" DECIMAL(12,4),
    "primaryTaxIncluded" TEXT NOT NULL DEFAULT '',
    "primaryFreightIncluded" TEXT NOT NULL DEFAULT '',
    "primaryNotes" TEXT NOT NULL DEFAULT '',
    "secondarySupplierCode" TEXT NOT NULL DEFAULT '',
    "secondarySupplierName" TEXT NOT NULL DEFAULT '',
    "secondaryPackageKg" DECIMAL(12,2),
    "secondaryPricePerKg" DECIMAL(12,4),
    "secondaryTaxIncluded" TEXT NOT NULL DEFAULT '',
    "secondaryFreightIncluded" TEXT NOT NULL DEFAULT '',
    "secondaryNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cos_table_raw_materials_productionCode_key" ON "cos_table_raw_materials"("productionCode");

-- CreateIndex
CREATE INDEX "cos_table_raw_materials_category_idx" ON "cos_table_raw_materials"("category");

-- CreateIndex
CREATE INDEX "cos_table_raw_materials_attributeCode_idx" ON "cos_table_raw_materials"("attributeCode");

-- CreateIndex
CREATE INDEX "cos_table_raw_materials_name_idx" ON "cos_table_raw_materials"("name");
