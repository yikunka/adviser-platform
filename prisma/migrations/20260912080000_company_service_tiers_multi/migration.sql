-- Replace single ServiceTier enum with multi-select serviceTiers text array
ALTER TABLE "companies" ADD COLUMN "serviceTiers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "companies" SET "serviceTiers" = CASE "serviceTier"::text
  WHEN 'COMP_SET_UP' THEN ARRAY['COMP_SET_UP']::TEXT[]
  WHEN 'CS' THEN ARRAY['COMP_SECRETARY']::TEXT[]
  WHEN 'CS_VO' THEN ARRAY['COMP_SECRETARY', 'VIRTUAL_OFFICE']::TEXT[]
  WHEN 'CS_BK' THEN ARRAY['COMP_SECRETARY', 'ACCT_SERVICE']::TEXT[]
  WHEN 'CS_VO_BK' THEN ARRAY['COMP_SECRETARY', 'VIRTUAL_OFFICE', 'ACCT_SERVICE']::TEXT[]
  ELSE ARRAY[]::TEXT[]
END;

ALTER TABLE "companies" DROP COLUMN "serviceTier";
DROP TYPE "ServiceTier";
