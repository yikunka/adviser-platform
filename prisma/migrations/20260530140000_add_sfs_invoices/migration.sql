-- CreateTable
CREATE TABLE "sfs_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "billToName" TEXT NOT NULL,
    "billToAddress" TEXT,
    "billToEmail" TEXT,
    "billToPhone" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfs_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfs_invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "sfs_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sfs_invoices_invoiceNumber_key" ON "sfs_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "sfs_invoices_orderId_idx" ON "sfs_invoices"("orderId");

-- CreateIndex
CREATE INDEX "sfs_invoices_status_idx" ON "sfs_invoices"("status");

-- CreateIndex
CREATE INDEX "sfs_invoices_issueDate_idx" ON "sfs_invoices"("issueDate");

-- CreateIndex
CREATE INDEX "sfs_invoice_line_items_invoiceId_sortOrder_idx" ON "sfs_invoice_line_items"("invoiceId", "sortOrder");

-- AddForeignKey
ALTER TABLE "sfs_invoices" ADD CONSTRAINT "sfs_invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sfs_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sfs_invoices" ADD CONSTRAINT "sfs_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sfs_invoice_line_items" ADD CONSTRAINT "sfs_invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sfs_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
