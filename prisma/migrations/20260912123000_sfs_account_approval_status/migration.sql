-- CreateEnum
CREATE TYPE "AccountApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "accountApprovalStatus" "AccountApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "users" ADD COLUMN "accountApprovedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "accountApprovedById" TEXT;
