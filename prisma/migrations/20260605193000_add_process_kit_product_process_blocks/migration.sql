ALTER TABLE "cos_process_kit_products"
ADD COLUMN IF NOT EXISTS "processBlocks" JSONB NOT NULL DEFAULT '[]';
