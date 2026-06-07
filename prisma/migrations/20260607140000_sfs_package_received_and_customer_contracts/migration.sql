-- Shift existing CHEM_TRANSFORM steps to make room for new step 1 (Package Received)
UPDATE "sfs_order_steps"
SET "stepNumber" = "stepNumber" + 1
WHERE "phase" = 'CHEM_TRANSFORM';

-- SFS customer cooperation contracts
CREATE TABLE "sfs_customer_contracts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfs_customer_contracts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sfs_customer_contracts_customerId_idx" ON "sfs_customer_contracts"("customerId");

ALTER TABLE "sfs_customer_contracts" ADD CONSTRAINT "sfs_customer_contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sfs_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sfs_customer_contracts" ADD CONSTRAINT "sfs_customer_contracts_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
