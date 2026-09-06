-- CreateTable
CREATE TABLE "sfs_pending_design_uploads" (
    "id" TEXT NOT NULL,
    "draftTokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfs_pending_design_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sfs_pending_design_uploads_storageKey_key" ON "sfs_pending_design_uploads"("storageKey");
CREATE INDEX "sfs_pending_design_uploads_draftTokenHash_expiresAt_idx" ON "sfs_pending_design_uploads"("draftTokenHash", "expiresAt");
CREATE INDEX "sfs_pending_design_uploads_userId_expiresAt_idx" ON "sfs_pending_design_uploads"("userId", "expiresAt");
CREATE INDEX "sfs_pending_design_uploads_claimedAt_expiresAt_idx" ON "sfs_pending_design_uploads"("claimedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "sfs_pending_design_uploads" ADD CONSTRAINT "sfs_pending_design_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
