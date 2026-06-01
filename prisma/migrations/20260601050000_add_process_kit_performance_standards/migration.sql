ALTER TABLE "cos_process_kits"
ADD COLUMN IF NOT EXISTS "performanceStandards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
