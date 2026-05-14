-- SFS Diamond orders (schema added after baseline init migration)
CREATE TYPE "SfsOrderStatus" AS ENUM ('PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "sfs_orders" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "SfsOrderStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "date" TEXT NOT NULL,
    "sampleCode" TEXT,
    "memorialName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mailingAddress" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceOther" TEXT,
    "remarks" TEXT,
    "mailingPackage" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "diamonds" JSONB NOT NULL,
    "sampleReceivedAt" TIMESTAMP(3),
    "chemTransformStartAt" TIMESTAMP(3),
    "chemTransformEndAt" TIMESTAMP(3),
    "cvdStartAt" TIMESTAMP(3),
    "cvdExpectedEndAt" TIMESTAMP(3),
    "cvdEndAt" TIMESTAMP(3),
    "craftingStartAt" TIMESTAMP(3),
    "craftingEndAt" TIMESTAMP(3),
    "igiCertificationAt" TIMESTAMP(3),
    "jewelrySettingStartAt" TIMESTAMP(3),
    "jewelrySettingEndAt" TIMESTAMP(3),
    "packagingAt" TIMESTAMP(3),
    "deliveryAt" TIMESTAMP(3),
    "deliveryDetails" TEXT,
    "adminNotes" TEXT,
    "customerRemark" TEXT,

    CONSTRAINT "sfs_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sfs_order_steps" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "particular" TEXT NOT NULL,
    "notes" TEXT,
    "fileKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfs_order_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sfs_orders_userId_idx" ON "sfs_orders"("userId");

CREATE INDEX "sfs_orders_email_idx" ON "sfs_orders"("email");

CREATE INDEX "sfs_orders_status_createdAt_idx" ON "sfs_orders"("status", "createdAt");

CREATE INDEX "sfs_order_steps_orderId_phase_idx" ON "sfs_order_steps"("orderId", "phase");

ALTER TABLE "sfs_orders" ADD CONSTRAINT "sfs_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sfs_order_steps" ADD CONSTRAINT "sfs_order_steps_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sfs_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
