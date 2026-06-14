-- CreateEnum
CREATE TYPE "CosProcessKitChangeAction" AS ENUM ('UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "CosProcessKitChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "cos_process_kit_change_requests" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "action" "CosProcessKitChangeAction" NOT NULL,
    "payload" JSONB,
    "status" "CosProcessKitChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestNote" TEXT NOT NULL DEFAULT '',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_process_kit_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cos_process_kit_change_requests_status_createdAt_idx" ON "cos_process_kit_change_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "cos_process_kit_change_requests_kitId_status_idx" ON "cos_process_kit_change_requests"("kitId", "status");

-- AddForeignKey
ALTER TABLE "cos_process_kit_change_requests" ADD CONSTRAINT "cos_process_kit_change_requests_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "cos_process_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_process_kit_change_requests" ADD CONSTRAINT "cos_process_kit_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_process_kit_change_requests" ADD CONSTRAINT "cos_process_kit_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
