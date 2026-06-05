-- CreateTable: CosmoCoat 客户管理
CREATE TABLE IF NOT EXISTS "cos_customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cos_customers_code_key" ON "cos_customers"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "cos_customers_userId_key" ON "cos_customers"("userId");
CREATE INDEX IF NOT EXISTS "cos_customers_name_idx" ON "cos_customers"("name");
CREATE INDEX IF NOT EXISTS "cos_customers_code_idx" ON "cos_customers"("code");
CREATE INDEX IF NOT EXISTS "cos_customers_createdAt_idx" ON "cos_customers"("createdAt");

ALTER TABLE "cos_customers" DROP CONSTRAINT IF EXISTS "cos_customers_userId_fkey";
ALTER TABLE "cos_customers" ADD CONSTRAINT "cos_customers_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cos_customers" DROP CONSTRAINT IF EXISTS "cos_customers_createdById_fkey";
ALTER TABLE "cos_customers" ADD CONSTRAINT "cos_customers_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
