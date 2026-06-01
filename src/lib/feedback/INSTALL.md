# Feedback Plugin — Install Guide

AI-assisted requirements widget. Users submit feature requests via a floating chat dialog; LLM clarifies and confirms before saving. Admin reviews at `/admin/feedback`.

---

## Quick Install (new system)

```bash
bash scripts/install-feedback-plugin.sh ~/coding/MyOtherApp/my-app
```

This copies all plugin files and prints the 3 manual steps.

---

## Manual Steps (after running the script)

### ① Edit `src/lib/feedback/adapter.ts`

This is the **only system-specific file**. Point the 3 imports at your system's auth/db:

```typescript
// adapter.ts — edit these 3 lines for your system
import { auth }         from '@/lib/auth/auth'      // ← your session function
import { prisma }       from '@/lib/db/prisma'       // ← your Prisma client
import { requireRole }  from '@/lib/auth/rbac'       // ← your role guard

// Then adapt requireFeedbackAccess() if your role system differs
```

### ② Add Prisma models

Add to `prisma/schema.prisma`:

```prisma
enum FeatureRequestStatus { PENDING IN_PROGRESS DONE REJECTED }

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
```

Also add to your `User` model:
```prisma
featureRequests FeatureRequest[] @relation("FeatureRequestSubmitter")
```

Run migration:
```bash
npx prisma migrate dev --name add_feedback_plugin
```

### ③ Add widget to your layout

```tsx
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'

// In your layout JSX:
<FeedbackWidget />
```

### ④ Install SDK + set env vars

```bash
npm install @anthropic-ai/sdk
```

```env
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
ALIBABA_API_KEY=sk-...
```

### ⑤ Write your system knowledge file

Edit `src/lib/feedback/system-knowledge.md` — describe your app's features so the LLM has context.

### ⑥ Add admin page (optional)

Copy `src/app/[locale]/(admin)/admin/feedback/page.tsx` from the source project and adapt the route to your system's admin routing pattern. Add a link to it in your navigation.

---

## File Structure

```
src/lib/feedback/
  adapter.ts          ← ONLY file to edit per system
  llm.ts              ← streaming LLM client (Anthropic/DeepSeek/Alibaba)
  options.ts          ← provider + model catalogue
  system-knowledge.md ← describe YOUR system here
  INSTALL.md

src/components/feedback/
  FeedbackWidget.tsx  ← floating button + chat dialog

src/app/api/feedback/
  chat/route.ts       ← streaming LLM endpoint
  submit/route.ts     ← save confirmed requirement

src/app/api/admin/feedback/
  route.ts            ← list requirements
  [id]/route.ts       ← get detail + update status
  config/route.ts     ← LLM config (provider, model, keys)
```

---

## How it works

```
User clicks "提交需求" button (all pages)
  → Chat dialog opens (captures current URL)
  → LLM reads system-knowledge.md + page context
  → Multi-turn clarification
  → LLM calls confirm_requirement tool
  → User clicks "确认并保存"
  → Saved to adv_feature_requests table
  → Admin reviews at /admin/feedback
```

---

## Supported LLM Providers

| Provider | Env var | Models |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | claude-opus/sonnet/haiku |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |
| 阿里百炼 | `ALIBABA_API_KEY` | qwen3.5-plus, qwen3.5-flash |

Configure active model at `/admin/feedback` → 模型配置.
