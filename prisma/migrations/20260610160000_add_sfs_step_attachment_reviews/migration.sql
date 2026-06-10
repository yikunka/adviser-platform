CREATE TYPE "SfsOrderStepAttachmentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "sfs_order_step_attachments" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "reviewStatus" "SfsOrderStepAttachmentReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfs_order_step_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sfs_order_step_attachments_fileKey_key" ON "sfs_order_step_attachments"("fileKey");

INSERT INTO "sfs_order_step_attachments" (
    "id",
    "stepId",
    "fileKey",
    "fileName",
    "mimeType",
    "fileSize",
    "reviewStatus",
    "reviewedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'sfsa_' || md5(s."id" || ':' || f."fileKey") AS "id",
    s."id" AS "stepId",
    f."fileKey",
    regexp_replace(f."fileKey", '^.*/', '') AS "fileName",
    CASE lower(regexp_replace(f."fileKey", '^.*\.', ''))
        WHEN 'jpg' THEN 'image/jpeg'
        WHEN 'jpeg' THEN 'image/jpeg'
        WHEN 'png' THEN 'image/png'
        WHEN 'webp' THEN 'image/webp'
        WHEN 'pdf' THEN 'application/pdf'
        ELSE 'application/octet-stream'
    END AS "mimeType",
    0 AS "fileSize",
    'APPROVED'::"SfsOrderStepAttachmentReviewStatus" AS "reviewStatus",
    CURRENT_TIMESTAMP AS "reviewedAt",
    s."createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "sfs_order_steps" s
CROSS JOIN LATERAL unnest(s."fileKeys") AS f("fileKey")
ON CONFLICT DO NOTHING;

CREATE INDEX "sfs_order_step_attachments_stepId_reviewStatus_idx" ON "sfs_order_step_attachments"("stepId", "reviewStatus");

ALTER TABLE "sfs_order_step_attachments" ADD CONSTRAINT "sfs_order_step_attachments_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "sfs_order_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sfs_order_step_attachments" ADD CONSTRAINT "sfs_order_step_attachments_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
