-- User.platform + Platform enum (schema had drifted from baseline init migration)
CREATE TYPE "Platform" AS ENUM ('ADVISER', 'SFS_DIAMOND');

ALTER TABLE "users" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'ADVISER';
