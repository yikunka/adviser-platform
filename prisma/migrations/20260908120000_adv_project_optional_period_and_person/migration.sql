-- AlterTable
ALTER TABLE "adv_projects" ADD COLUMN     "customerType" "InvoiceCustomerType" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "keyPersonId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL,
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "endDate" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "adv_projects_keyPersonId_status_idx" ON "adv_projects"("keyPersonId", "status");

-- CreateIndex
CREATE INDEX "adv_projects_customerType_idx" ON "adv_projects"("customerType");

-- AddForeignKey
ALTER TABLE "adv_projects" ADD CONSTRAINT "adv_projects_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
