-- Add auto-incrementing display number to feature requests.
-- This column was added to the Prisma schema via db push and was missing from migrations.
ALTER TABLE "adv_feature_requests" ADD COLUMN IF NOT EXISTS "number" SERIAL NOT NULL;
