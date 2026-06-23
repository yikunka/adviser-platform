-- SFS Diamond specs: add Source as a customer-facing option category.
ALTER TYPE "SfsDiamondSpecCategory" ADD VALUE IF NOT EXISTS 'SOURCE' BEFORE 'COLOR';

-- TCSP pricing: merge service category + service item into one free-text service content field.
ALTER TABLE "adv_tcsp_service_prices"
ADD COLUMN IF NOT EXISTS "serviceContent" TEXT;

UPDATE "adv_tcsp_service_prices"
SET "serviceContent" = CASE
  WHEN "serviceContent" IS NOT NULL AND btrim("serviceContent") <> '' THEN btrim("serviceContent")
  WHEN "serviceCategory" IS NOT NULL
    AND btrim("serviceCategory") <> ''
    AND "serviceName" IS NOT NULL
    AND btrim("serviceName") <> ''
    THEN btrim("serviceCategory") || ' - ' || btrim("serviceName")
  WHEN "serviceName" IS NOT NULL AND btrim("serviceName") <> '' THEN btrim("serviceName")
  WHEN "serviceCategory" IS NOT NULL AND btrim("serviceCategory") <> '' THEN btrim("serviceCategory")
  ELSE '未命名服务'
END;

DROP INDEX IF EXISTS "adv_tcsp_service_prices_jurisdiction_customerLevel_serviceCategory_serviceName_key";

ALTER TABLE "adv_tcsp_service_prices"
ALTER COLUMN "serviceContent" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "adv_tcsp_service_prices_jurisdiction_customerLevel_serviceContent_key"
ON "adv_tcsp_service_prices"("jurisdiction", "customerLevel", "serviceContent");

ALTER TABLE "adv_tcsp_service_prices"
DROP COLUMN IF EXISTS "serviceCategory",
DROP COLUMN IF EXISTS "serviceName";

-- CosmoCoat customers: optional contact person details.
ALTER TABLE "cos_customers"
ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
