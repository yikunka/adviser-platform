ALTER TABLE "cos_process_kits"
  ADD COLUMN IF NOT EXISTS "processFlowNote" TEXT;

ALTER TABLE "cos_process_kit_products"
  ADD COLUMN IF NOT EXISTS "hardenerProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "hardenerProductName" TEXT,
  ADD COLUMN IF NOT EXISTS "hardenerRatio" TEXT,
  ADD COLUMN IF NOT EXISTS "thinnerProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "thinnerProductName" TEXT,
  ADD COLUMN IF NOT EXISTS "thinnerRatio" TEXT;
