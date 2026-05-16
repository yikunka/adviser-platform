CREATE TABLE "cos_table_products" (
  "id" TEXT NOT NULL,
  "pid" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "teaser" TEXT NOT NULL DEFAULT '',
  "detail" TEXT NOT NULL,
  "imagePath" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cos_table_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cos_table_products_pid_key" ON "cos_table_products"("pid");
CREATE INDEX "cos_table_products_type_sortOrder_idx" ON "cos_table_products"("type", "sortOrder");
CREATE INDEX "cos_table_products_isFeatured_sortOrder_idx" ON "cos_table_products"("isFeatured", "sortOrder");
CREATE INDEX "cos_table_products_isVisible_sortOrder_idx" ON "cos_table_products"("isVisible", "sortOrder");
