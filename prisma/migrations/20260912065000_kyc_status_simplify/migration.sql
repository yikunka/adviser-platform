-- Map removed statuses, then replace KYCStatus enum with Draft / Approved / Rejected / Inactive
UPDATE "key_persons" SET "kycStatus" = 'DRAFT' WHERE "kycStatus"::text IN ('SUBMITTED', 'PENDING_INFO');

CREATE TYPE "KYCStatus_new" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'INACTIVE');

ALTER TABLE "key_persons" ALTER COLUMN "kycStatus" DROP DEFAULT;

ALTER TABLE "key_persons" ALTER COLUMN "kycStatus" TYPE "KYCStatus_new" USING (
  CASE
    WHEN "kycStatus"::text = 'APPROVED' THEN 'APPROVED'::"KYCStatus_new"
    WHEN "kycStatus"::text = 'REJECTED' THEN 'REJECTED'::"KYCStatus_new"
    WHEN "kycStatus"::text = 'INACTIVE' THEN 'INACTIVE'::"KYCStatus_new"
    ELSE 'DRAFT'::"KYCStatus_new"
  END
);

DROP TYPE "KYCStatus";
ALTER TYPE "KYCStatus_new" RENAME TO "KYCStatus";

ALTER TABLE "key_persons" ALTER COLUMN "kycStatus" SET DEFAULT 'DRAFT'::"KYCStatus";
