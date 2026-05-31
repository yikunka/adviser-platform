-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProcessKitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProcessTestType" AS ENUM ('PERFORMANCE', 'DURABILITY', 'ADHESION', 'COLOR_STABILITY', 'BOND_STRENGTH', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProcessTestResult" AS ENUM ('PASSED', 'FAILED', 'PENDING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "cos_process_kits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProcessKitStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_process_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_process_kit_products" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "quantityRatio" TEXT,
    "usageMethod" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_process_kit_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cos_process_tests" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "testType" "ProcessTestType" NOT NULL,
    "testResult" "ProcessTestResult" NOT NULL DEFAULT 'PENDING',
    "testDate" TIMESTAMP(3) NOT NULL,
    "testerName" TEXT NOT NULL,
    "testerId" TEXT,
    "reportLink" TEXT,
    "testNotes" TEXT,
    "passedAt" TIMESTAMP(3),

    CONSTRAINT "cos_process_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cos_process_kits_code_key" ON "cos_process_kits"("code");

-- CreateIndex
CREATE INDEX "cos_process_kits_status_idx" ON "cos_process_kits"("status");

-- CreateIndex
CREATE INDEX "cos_process_kit_products_kitId_idx" ON "cos_process_kit_products"("kitId");

-- CreateIndex
CREATE INDEX "cos_process_kit_products_productId_idx" ON "cos_process_kit_products"("productId");

-- CreateIndex
CREATE INDEX "cos_process_tests_kitId_idx" ON "cos_process_tests"("kitId");

-- CreateIndex
CREATE INDEX "cos_process_tests_testType_idx" ON "cos_process_tests"("testType");

-- CreateIndex
CREATE INDEX "cos_process_tests_testResult_idx" ON "cos_process_tests"("testResult");

-- CreateIndex
CREATE INDEX "cos_process_tests_testDate_idx" ON "cos_process_tests"("testDate");

-- AddForeignKey
ALTER TABLE "cos_process_kits" ADD CONSTRAINT "cos_process_kits_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_process_kit_products" ADD CONSTRAINT "cos_process_kit_products_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "cos_process_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_process_tests" ADD CONSTRAINT "cos_process_tests_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "cos_process_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_process_tests" ADD CONSTRAINT "cos_process_tests_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
