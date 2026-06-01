-- Add API key columns to feedback config table
ALTER TABLE "adv_feedback_config"
  ADD COLUMN IF NOT EXISTS "anthropicKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "deepseekKey"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "alibabaKey"   TEXT NOT NULL DEFAULT '';
