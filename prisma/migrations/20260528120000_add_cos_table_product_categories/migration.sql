-- Factory product categories (max 3 levels), linked to cos_table_factory_products.
CREATE TABLE "cos_table_product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "parentCategoryId" TEXT,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_product_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cos_table_factory_products" ADD COLUMN "categoryId" TEXT;

CREATE UNIQUE INDEX "cos_table_product_categories_slug_key" ON "cos_table_product_categories"("slug");

CREATE INDEX "cos_table_product_categories_parentCategoryId_idx" ON "cos_table_product_categories"("parentCategoryId");

CREATE INDEX "cos_table_product_categories_isActive_idx" ON "cos_table_product_categories"("isActive");

CREATE INDEX "cos_table_factory_products_categoryId_idx" ON "cos_table_factory_products"("categoryId");

ALTER TABLE "cos_table_product_categories" ADD CONSTRAINT "cos_table_product_categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "cos_table_product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_table_factory_products" ADD CONSTRAINT "cos_table_factory_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cos_table_product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
