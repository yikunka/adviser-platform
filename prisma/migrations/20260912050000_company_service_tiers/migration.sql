-- Remap company ServiceTier from Basic/Professional/Premium to engagement packages

CREATE TYPE "ServiceTier_new" AS ENUM ('COMP_SET_UP', 'CS', 'CS_VO', 'CS_BK', 'CS_VO_BK');

ALTER TABLE "companies" ALTER COLUMN "serviceTier" DROP DEFAULT;

ALTER TABLE "companies"
  ALTER COLUMN "serviceTier" TYPE "ServiceTier_new"
  USING (
    CASE "serviceTier"::text
      WHEN 'BASIC' THEN 'COMP_SET_UP'
      WHEN 'PROFESSIONAL' THEN 'CS'
      WHEN 'PREMIUM' THEN 'CS_VO_BK'
      WHEN 'COMP_SET_UP' THEN 'COMP_SET_UP'
      WHEN 'CS' THEN 'CS'
      WHEN 'CS_VO' THEN 'CS_VO'
      WHEN 'CS_BK' THEN 'CS_BK'
      WHEN 'CS_VO_BK' THEN 'CS_VO_BK'
      ELSE 'COMP_SET_UP'
    END::"ServiceTier_new"
  );

ALTER TABLE "companies" ALTER COLUMN "serviceTier" SET DEFAULT 'COMP_SET_UP'::"ServiceTier_new";

DROP TYPE "ServiceTier";

ALTER TYPE "ServiceTier_new" RENAME TO "ServiceTier";
