-- CreateEnum
CREATE TYPE "InvoiceCustomerType" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "invoices"
  ADD COLUMN "customerType" "InvoiceCustomerType" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "keyPersonId" TEXT,
  ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "invoices_keyPersonId_idx" ON "invoices"("keyPersonId");

-- CreateIndex
CREATE INDEX "invoices_customerType_idx" ON "invoices"("customerType");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
