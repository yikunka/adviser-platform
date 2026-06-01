#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Feedback Plugin Installer
# Usage: bash scripts/install-feedback-plugin.sh <target-project-path>
#
# Example:
#   bash scripts/install-feedback-plugin.sh ~/coding/MyOtherApp/my-app
# ─────────────────────────────────────────────────────────────────────────────

set -e

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1}"

if [ -z "$TARGET_DIR" ]; then
  echo "Usage: $0 <target-project-path>"
  echo "Example: $0 ~/coding/MyOtherApp/my-app"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: target directory does not exist: $TARGET_DIR"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Feedback Plugin Installer"
echo "  Source : $SOURCE_DIR"
echo "  Target : $TARGET_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Copy plugin files ───────────────────────────────────────────────────
echo "▶  Copying plugin files..."

# Lib
mkdir -p "$TARGET_DIR/src/lib/feedback"
cp "$SOURCE_DIR/src/lib/feedback/adapter.ts"         "$TARGET_DIR/src/lib/feedback/"
cp "$SOURCE_DIR/src/lib/feedback/llm.ts"             "$TARGET_DIR/src/lib/feedback/"
cp "$SOURCE_DIR/src/lib/feedback/options.ts"         "$TARGET_DIR/src/lib/feedback/"
cp "$SOURCE_DIR/src/lib/feedback/system-knowledge.md" "$TARGET_DIR/src/lib/feedback/"
cp "$SOURCE_DIR/src/lib/feedback/INSTALL.md"         "$TARGET_DIR/src/lib/feedback/"

# Widget component
mkdir -p "$TARGET_DIR/src/components/feedback"
cp "$SOURCE_DIR/src/components/feedback/FeedbackWidget.tsx" "$TARGET_DIR/src/components/feedback/"

# API routes
mkdir -p "$TARGET_DIR/src/app/api/feedback/chat"
mkdir -p "$TARGET_DIR/src/app/api/feedback/submit"
mkdir -p "$TARGET_DIR/src/app/api/admin/feedback/config"
mkdir -p "$TARGET_DIR/src/app/api/admin/feedback/[id]"
cp "$SOURCE_DIR/src/app/api/feedback/chat/route.ts"        "$TARGET_DIR/src/app/api/feedback/chat/"
cp "$SOURCE_DIR/src/app/api/feedback/submit/route.ts"      "$TARGET_DIR/src/app/api/feedback/submit/"
cp "$SOURCE_DIR/src/app/api/admin/feedback/route.ts"       "$TARGET_DIR/src/app/api/admin/feedback/"
cp "$SOURCE_DIR/src/app/api/admin/feedback/config/route.ts" "$TARGET_DIR/src/app/api/admin/feedback/config/"
cp "$SOURCE_DIR/src/app/api/admin/feedback/[id]/route.ts"  "$TARGET_DIR/src/app/api/admin/feedback/[id]/"

echo "   ✓ Plugin files copied"

# ── 2. Copy DB migration SQL ───────────────────────────────────────────────
echo "▶  Copying migration SQL..."
mkdir -p "$TARGET_DIR/prisma/migrations/20260601000000_add_feature_requests"
mkdir -p "$TARGET_DIR/prisma/migrations/20260601010000_add_feedback_config"
mkdir -p "$TARGET_DIR/prisma/migrations/20260601020000_add_feedback_config_keys"
cp "$SOURCE_DIR/prisma/migrations/20260601000000_add_feature_requests/migration.sql" \
   "$TARGET_DIR/prisma/migrations/20260601000000_add_feature_requests/"
cp "$SOURCE_DIR/prisma/migrations/20260601010000_add_feedback_config/migration.sql" \
   "$TARGET_DIR/prisma/migrations/20260601010000_add_feedback_config/"
echo "   ✓ Migration SQL copied"

# ── 3. Print Prisma schema snippet ────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MANUAL STEPS (3 things to do)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "① Add to prisma/schema.prisma (before the last closing brace):"
echo ""
cat << 'SCHEMA'
enum FeatureRequestStatus {
  PENDING
  IN_PROGRESS
  DONE
  REJECTED
}

model FeedbackConfig {
  id           String   @id @default("singleton")
  provider     String   @default("anthropic")
  model        String   @default("claude-opus-4-5")
  anthropicKey String   @default("")
  deepseekKey  String   @default("")
  alibabaKey   String   @default("")
  updatedAt    DateTime @updatedAt
  @@map("adv_feedback_config")
}

model FeatureRequest {
  id           String               @id @default(cuid())
  pageUrl      String
  pageTitle    String               @default("")
  title        String               @default("")
  summary      String
  priority     String               @default("medium")
  conversation Json
  status       FeatureRequestStatus @default(PENDING)
  userId       String?
  userEmail    String?
  userName     String?
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
  @@index([status, createdAt])
  @@map("adv_feature_requests")
}
SCHEMA

echo ""
echo "  Also add to your User model:"
echo "    featureRequests FeatureRequest[] @relation(\"FeatureRequestSubmitter\")"
echo ""
echo "② Edit src/lib/feedback/adapter.ts"
echo "   Replace the 3 imports with your system's auth / prisma / role check."
echo ""
echo "③ Add <FeedbackWidget /> to your layout:"
echo "   import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'"
echo "   // inside your layout JSX, before closing </body>:"
echo "   <FeedbackWidget />"
echo ""
echo "  Then add the admin page at your preferred route,"
echo "  e.g. copy the admin page from the source or create a simple one."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  After the above, run:"
echo "    npm install @anthropic-ai/sdk"
echo "    npx prisma migrate dev --name add_feedback_plugin"
echo ""
echo "  Add env vars:"
echo "    ANTHROPIC_API_KEY=..."
echo "    DEEPSEEK_API_KEY=..."
echo "    ALIBABA_API_KEY=..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅  Done! Files copied to $TARGET_DIR"
echo ""
