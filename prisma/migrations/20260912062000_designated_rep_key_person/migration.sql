-- AlterTable
ALTER TABLE "designated_representatives" ADD COLUMN "keyPersonId" TEXT;

-- CreateIndex
CREATE INDEX "designated_representatives_keyPersonId_idx" ON "designated_representatives"("keyPersonId");

-- AddForeignKey
ALTER TABLE "designated_representatives" ADD CONSTRAINT "designated_representatives_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
