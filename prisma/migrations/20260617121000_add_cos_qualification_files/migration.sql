-- CreateTable
CREATE TABLE "cos_qualification_files" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "notes" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cos_qualification_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cos_qualification_files_documentType_idx" ON "cos_qualification_files"("documentType");

-- CreateIndex
CREATE INDEX "cos_qualification_files_title_idx" ON "cos_qualification_files"("title");

-- CreateIndex
CREATE INDEX "cos_qualification_files_createdAt_idx" ON "cos_qualification_files"("createdAt");

-- AddForeignKey
ALTER TABLE "cos_qualification_files"
ADD CONSTRAINT "cos_qualification_files_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
