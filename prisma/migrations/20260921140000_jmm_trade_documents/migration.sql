-- CreateEnum
CREATE TYPE "JmmDocumentKind" AS ENUM ('QUOTATION', 'PROFORMA', 'COMMERCIAL_INVOICE');

-- CreateEnum
CREATE TYPE "JmmDocumentStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "jmm_documents" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "JmmDocumentKind" NOT NULL,
    "status" "JmmDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "documentNumber" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "documentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "vatNumber" TEXT NOT NULL DEFAULT '',
    "deliveryAddress" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jmm_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jmm_document_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "jmm_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jmm_documents_documentNumber_key" ON "jmm_documents"("documentNumber");

-- CreateIndex
CREATE INDEX "jmm_documents_orderId_kind_status_idx" ON "jmm_documents"("orderId", "kind", "status");

-- CreateIndex
CREATE INDEX "jmm_documents_sourceDocumentId_idx" ON "jmm_documents"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "jmm_document_lines_documentId_idx" ON "jmm_document_lines"("documentId");

-- AddForeignKey
ALTER TABLE "jmm_documents" ADD CONSTRAINT "jmm_documents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "jmm_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_documents" ADD CONSTRAINT "jmm_documents_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "jmm_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_document_lines" ADD CONSTRAINT "jmm_document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "jmm_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
