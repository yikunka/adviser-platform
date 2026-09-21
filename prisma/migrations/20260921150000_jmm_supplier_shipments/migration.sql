-- CreateEnum
CREATE TYPE "JmmSupplierInvoiceStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'CHECKED', 'PAID');

-- CreateEnum
CREATE TYPE "JmmShipmentDocKind" AS ENUM ('BILL_OF_LADING', 'AIRWAY_BILL', 'PACKING_LIST', 'SUPPLIER_INVOICE', 'CERTIFICATE_OF_ORIGIN', 'INSURANCE', 'INSPECTION', 'OTHER');

-- CreateTable
CREATE TABLE "jmm_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "vatNumber" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jmm_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jmm_supplier_invoices" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "JmmSupplierInvoiceStatus" NOT NULL DEFAULT 'EXPECTED',
    "notes" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jmm_supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jmm_shipments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "shipper" TEXT NOT NULL DEFAULT '',
    "consignee" TEXT NOT NULL DEFAULT '',
    "carrier" TEXT NOT NULL DEFAULT '',
    "incoterm" TEXT NOT NULL DEFAULT '',
    "portOfLoading" TEXT NOT NULL DEFAULT '',
    "portOfDischarge" TEXT NOT NULL DEFAULT '',
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jmm_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jmm_shipment_files" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "kind" "JmmShipmentDocKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jmm_shipment_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jmm_suppliers_name_idx" ON "jmm_suppliers"("name");

-- CreateIndex
CREATE INDEX "jmm_suppliers_company_idx" ON "jmm_suppliers"("company");

-- CreateIndex
CREATE INDEX "jmm_supplier_invoices_orderId_idx" ON "jmm_supplier_invoices"("orderId");

-- CreateIndex
CREATE INDEX "jmm_supplier_invoices_supplierId_idx" ON "jmm_supplier_invoices"("supplierId");

-- CreateIndex
CREATE INDEX "jmm_supplier_invoices_status_idx" ON "jmm_supplier_invoices"("status");

-- CreateIndex
CREATE INDEX "jmm_shipments_invoiceId_idx" ON "jmm_shipments"("invoiceId");

-- CreateIndex
CREATE INDEX "jmm_shipment_files_shipmentId_idx" ON "jmm_shipment_files"("shipmentId");

-- AddForeignKey
ALTER TABLE "jmm_supplier_invoices" ADD CONSTRAINT "jmm_supplier_invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "jmm_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_supplier_invoices" ADD CONSTRAINT "jmm_supplier_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "jmm_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_shipments" ADD CONSTRAINT "jmm_shipments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "jmm_supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_shipment_files" ADD CONSTRAINT "jmm_shipment_files_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "jmm_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

