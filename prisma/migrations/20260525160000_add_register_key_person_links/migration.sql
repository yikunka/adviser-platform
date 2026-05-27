-- AlterTable
ALTER TABLE "directors" ADD COLUMN "keyPersonId" TEXT;

-- AlterTable
ALTER TABLE "members" ADD COLUMN "keyPersonId" TEXT;

-- AlterTable
ALTER TABLE "significant_controllers" ADD COLUMN "keyPersonId" TEXT;

-- CreateIndex
CREATE INDEX "directors_keyPersonId_idx" ON "directors"("keyPersonId");

-- CreateIndex
CREATE INDEX "members_keyPersonId_idx" ON "members"("keyPersonId");

-- CreateIndex
CREATE INDEX "significant_controllers_keyPersonId_idx" ON "significant_controllers"("keyPersonId");

-- AddForeignKey
ALTER TABLE "directors" ADD CONSTRAINT "directors_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "significant_controllers" ADD CONSTRAINT "significant_controllers_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
