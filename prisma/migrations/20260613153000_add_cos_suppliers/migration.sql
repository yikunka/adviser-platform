-- CreateTable: CosmoCoat supplier management
CREATE TABLE IF NOT EXISTS "cos_suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" TEXT,
    "address" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CosmoCoat supplier attachment files
CREATE TABLE IF NOT EXISTS "cos_supplier_files" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cos_supplier_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cos_suppliers_code_key" ON "cos_suppliers"("code");
CREATE INDEX IF NOT EXISTS "cos_suppliers_name_idx" ON "cos_suppliers"("name");
CREATE INDEX IF NOT EXISTS "cos_suppliers_code_idx" ON "cos_suppliers"("code");
CREATE INDEX IF NOT EXISTS "cos_suppliers_createdAt_idx" ON "cos_suppliers"("createdAt");
CREATE INDEX IF NOT EXISTS "cos_supplier_files_supplierId_idx" ON "cos_supplier_files"("supplierId");

-- AddForeignKey
ALTER TABLE "cos_suppliers" DROP CONSTRAINT IF EXISTS "cos_suppliers_createdById_fkey";
ALTER TABLE "cos_suppliers" ADD CONSTRAINT "cos_suppliers_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_supplier_files" DROP CONSTRAINT IF EXISTS "cos_supplier_files_supplierId_fkey";
ALTER TABLE "cos_supplier_files" ADD CONSTRAINT "cos_supplier_files_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "cos_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cos_supplier_files" DROP CONSTRAINT IF EXISTS "cos_supplier_files_uploadedById_fkey";
ALTER TABLE "cos_supplier_files" ADD CONSTRAINT "cos_supplier_files_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
