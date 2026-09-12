-- AlterTable
ALTER TABLE "significant_controllers" ADD COLUMN "linkedCompanyId" TEXT;

-- CreateIndex
CREATE INDEX "significant_controllers_linkedCompanyId_idx" ON "significant_controllers"("linkedCompanyId");

-- AddForeignKey
ALTER TABLE "significant_controllers" ADD CONSTRAINT "significant_controllers_linkedCompanyId_fkey" FOREIGN KEY ("linkedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
