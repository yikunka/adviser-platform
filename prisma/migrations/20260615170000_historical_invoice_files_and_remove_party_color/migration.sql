CREATE TABLE "historical_invoice_files" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "uploadedById" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "historical_invoice_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historical_invoice_files_createdAt_idx"
  ON "historical_invoice_files"("createdAt");

CREATE INDEX "historical_invoice_files_uploadedById_idx"
  ON "historical_invoice_files"("uploadedById");

ALTER TABLE "historical_invoice_files"
  ADD CONSTRAINT "historical_invoice_files_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "adv_parties" DROP COLUMN "color";
