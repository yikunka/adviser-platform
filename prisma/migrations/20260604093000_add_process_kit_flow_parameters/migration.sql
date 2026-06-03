ALTER TABLE "cos_process_kit_products"
  ADD COLUMN IF NOT EXISTS "irMinutes" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "irTemperature" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "uvEnergy" DECIMAL(10,3);
