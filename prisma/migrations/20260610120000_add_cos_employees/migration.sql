-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CosEmployeeType" AS ENUM ('INTERNAL', 'SALES', 'PRODUCTION', 'TECHNICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CosEmployeeFileType" AS ENUM ('LABOR_CONTRACT', 'RESUME');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: CosmoCoat 员工管理
CREATE TABLE IF NOT EXISTS "cos_employees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeType" "CosEmployeeType" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "position" TEXT,
    "department" TEXT,
    "hireDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cos_employee_files" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fileType" "CosEmployeeFileType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cos_employee_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cos_employees_code_key" ON "cos_employees"("code");
CREATE INDEX IF NOT EXISTS "cos_employees_employeeType_idx" ON "cos_employees"("employeeType");
CREATE INDEX IF NOT EXISTS "cos_employees_name_idx" ON "cos_employees"("name");
CREATE INDEX IF NOT EXISTS "cos_employees_code_idx" ON "cos_employees"("code");
CREATE INDEX IF NOT EXISTS "cos_employee_files_employeeId_fileType_idx" ON "cos_employee_files"("employeeId", "fileType");

ALTER TABLE "cos_employees" DROP CONSTRAINT IF EXISTS "cos_employees_createdById_fkey";
ALTER TABLE "cos_employees" ADD CONSTRAINT "cos_employees_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_employee_files" DROP CONSTRAINT IF EXISTS "cos_employee_files_employeeId_fkey";
ALTER TABLE "cos_employee_files" ADD CONSTRAINT "cos_employee_files_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "cos_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cos_employee_files" DROP CONSTRAINT IF EXISTS "cos_employee_files_uploadedById_fkey";
ALTER TABLE "cos_employee_files" ADD CONSTRAINT "cos_employee_files_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: production order production employee
ALTER TABLE "cos_table_production_orders" ADD COLUMN IF NOT EXISTS "productionEmployeeId" TEXT;

CREATE INDEX IF NOT EXISTS "cos_table_production_orders_productionEmployeeId_idx"
    ON "cos_table_production_orders"("productionEmployeeId");

ALTER TABLE "cos_table_production_orders" DROP CONSTRAINT IF EXISTS "cos_table_production_orders_productionEmployeeId_fkey";
ALTER TABLE "cos_table_production_orders" ADD CONSTRAINT "cos_table_production_orders_productionEmployeeId_fkey"
    FOREIGN KEY ("productionEmployeeId") REFERENCES "cos_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
