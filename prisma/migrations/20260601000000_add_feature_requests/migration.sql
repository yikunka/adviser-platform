-- CreateEnum
CREATE TYPE "FeatureRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "adv_feature_requests" (
    "id" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "conversation" JSONB NOT NULL,
    "status" "FeatureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_feature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adv_feature_requests_status_createdAt_idx" ON "adv_feature_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "adv_feature_requests_userId_idx" ON "adv_feature_requests"("userId");

-- AddForeignKey
ALTER TABLE "adv_feature_requests" ADD CONSTRAINT "adv_feature_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
