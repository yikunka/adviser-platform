-- CreateTable
CREATE TABLE "adverse_media_findings" (
    "id" TEXT NOT NULL,
    "subjectType" "AMLSubjectType" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "keyPersonId" TEXT,
    "companyId" TEXT,
    "query" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "publisher" TEXT,
    "source" TEXT NOT NULL DEFAULT 'GOOGLE',
    "categories" TEXT[],
    "relevanceScore" DOUBLE PRECISION,
    "resolution" "AMLAlertResolution" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adverse_media_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adverse_media_findings_keyPersonId_idx" ON "adverse_media_findings"("keyPersonId");

-- CreateIndex
CREATE INDEX "adverse_media_findings_companyId_idx" ON "adverse_media_findings"("companyId");

-- CreateIndex
CREATE INDEX "adverse_media_findings_resolution_idx" ON "adverse_media_findings"("resolution");

-- CreateIndex
CREATE UNIQUE INDEX "adverse_media_findings_subjectKey_urlHash_key" ON "adverse_media_findings"("subjectKey", "urlHash");

-- AddForeignKey
ALTER TABLE "adverse_media_findings" ADD CONSTRAINT "adverse_media_findings_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_findings" ADD CONSTRAINT "adverse_media_findings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_findings" ADD CONSTRAINT "adverse_media_findings_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
