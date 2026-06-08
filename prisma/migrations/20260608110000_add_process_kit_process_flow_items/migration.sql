ALTER TABLE "cos_process_kits"
ADD COLUMN IF NOT EXISTS "processFlowItems" JSONB NOT NULL DEFAULT '[]';
