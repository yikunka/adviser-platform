CREATE TABLE "sfs_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mailingAddress" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfs_customers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sfs_orders" ADD COLUMN "customerId" TEXT;

CREATE UNIQUE INDEX "sfs_customers_userId_key" ON "sfs_customers"("userId");

CREATE INDEX "sfs_customers_email_idx" ON "sfs_customers"("email");

CREATE INDEX "sfs_customers_createdAt_idx" ON "sfs_customers"("createdAt");

CREATE INDEX "sfs_orders_customerId_idx" ON "sfs_orders"("customerId");

ALTER TABLE "sfs_customers" ADD CONSTRAINT "sfs_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sfs_customers" ADD CONSTRAINT "sfs_customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sfs_orders" ADD CONSTRAINT "sfs_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sfs_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
