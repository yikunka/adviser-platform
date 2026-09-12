-- AlterTable
ALTER TABLE "members" ADD COLUMN "linkedCompanyId" TEXT;

-- CreateIndex
CREATE INDEX "members_linkedCompanyId_idx" ON "members"("linkedCompanyId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_linkedCompanyId_fkey" FOREIGN KEY ("linkedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
