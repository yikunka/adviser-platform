-- CreateTable
CREATE TABLE "adv_feedback_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-opus-4-5',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adv_feedback_config_pkey" PRIMARY KEY ("id")
);

-- Seed default config row
INSERT INTO "adv_feedback_config" ("id", "provider", "model", "updatedAt")
VALUES ('singleton', 'anthropic', 'claude-opus-4-5', NOW())
ON CONFLICT ("id") DO NOTHING;
