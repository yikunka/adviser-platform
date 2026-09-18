-- CreateTable
CREATE TABLE "adv_forms" (
    "id" TEXT NOT NULL,
    "formName" TEXT NOT NULL,
    "notes" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adv_forms_formName_idx" ON "adv_forms"("formName");

-- AddForeignKey
ALTER TABLE "adv_forms" ADD CONSTRAINT "adv_forms_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
