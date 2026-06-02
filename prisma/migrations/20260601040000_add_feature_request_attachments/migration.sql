-- Feature request attachments (uploaded files referenced in the feedback widget)
ALTER TABLE "adv_feature_requests"
  ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]';
