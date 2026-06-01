ALTER TABLE "adv_feedback_config"
  ADD COLUMN IF NOT EXISTS "devtoolKeyHash" TEXT NOT NULL DEFAULT '';
