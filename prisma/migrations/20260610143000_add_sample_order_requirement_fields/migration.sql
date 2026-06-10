-- AlterTable: add sample-order basic requirement fields
ALTER TABLE "cos_sample_orders"
  ADD COLUMN IF NOT EXISTS "substrateType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "samplePanelRequirement" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "sampleOilRequirement" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "specialProcessRequirement" TEXT NOT NULL DEFAULT '';
