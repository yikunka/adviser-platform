-- AlterTable
ALTER TABLE "sfs_orders" ADD COLUMN     "quoteNotes" TEXT,
ADD COLUMN     "quotedAmount" DECIMAL(18,2),
ADD COLUMN     "quotedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sfs_order_design_attachments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "diamondIndex" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfs_order_design_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sfs_order_design_attachments_orderId_diamondIndex_idx" ON "sfs_order_design_attachments"("orderId", "diamondIndex");

-- AddForeignKey
ALTER TABLE "sfs_order_design_attachments" ADD CONSTRAINT "sfs_order_design_attachments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sfs_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
