-- CreateEnum
CREATE TYPE "JmmOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'JMM_TRADING';

-- CreateTable
CREATE TABLE "jmm_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jmm_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jmm_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "JmmOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jmm_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jmm_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "jmm_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jmm_customers_name_idx" ON "jmm_customers"("name");

-- CreateIndex
CREATE INDEX "jmm_customers_company_idx" ON "jmm_customers"("company");

-- CreateIndex
CREATE UNIQUE INDEX "jmm_orders_orderNumber_key" ON "jmm_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "jmm_orders_customerId_idx" ON "jmm_orders"("customerId");

-- CreateIndex
CREATE INDEX "jmm_orders_status_idx" ON "jmm_orders"("status");

-- CreateIndex
CREATE INDEX "jmm_orders_orderDate_idx" ON "jmm_orders"("orderDate");

-- CreateIndex
CREATE INDEX "jmm_order_lines_orderId_idx" ON "jmm_order_lines"("orderId");

-- AddForeignKey
ALTER TABLE "jmm_orders" ADD CONSTRAINT "jmm_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "jmm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_orders" ADD CONSTRAINT "jmm_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jmm_order_lines" ADD CONSTRAINT "jmm_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "jmm_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
