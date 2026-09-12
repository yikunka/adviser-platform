-- Remap CompanyStatus to Active / Inactive / Deregistered

CREATE TYPE "CompanyStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'DEREGISTERED');

ALTER TABLE "companies" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "companies"
  ALTER COLUMN "status" TYPE "CompanyStatus_new"
  USING (
    CASE "status"::text
      WHEN 'ACTIVE' THEN 'ACTIVE'
      WHEN 'DORMANT' THEN 'INACTIVE'
      WHEN 'STRUCK_OFF' THEN 'DEREGISTERED'
      WHEN 'DEREGISTERED' THEN 'DEREGISTERED'
      WHEN 'INACTIVE' THEN 'INACTIVE'
      ELSE 'ACTIVE'
    END::"CompanyStatus_new"
  );

ALTER TABLE "companies" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"CompanyStatus_new";

DROP TYPE "CompanyStatus";

ALTER TYPE "CompanyStatus_new" RENAME TO "CompanyStatus";
