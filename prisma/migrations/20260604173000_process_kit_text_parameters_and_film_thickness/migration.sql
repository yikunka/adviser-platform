ALTER TABLE "cos_process_kit_products"
  ALTER COLUMN "irMinutes" TYPE TEXT USING "irMinutes"::TEXT,
  ALTER COLUMN "irTemperature" TYPE TEXT USING "irTemperature"::TEXT,
  ALTER COLUMN "uvEnergy" TYPE TEXT USING "uvEnergy"::TEXT,
  ADD COLUMN IF NOT EXISTS "filmThickness" TEXT;
