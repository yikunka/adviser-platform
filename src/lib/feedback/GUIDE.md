# 需求反馈系统 — 完整指南

> **文件定位**：这份文档覆盖从安装到日常运营的全部内容。安装细节另见 `INSTALL.md`；这里侧重"为什么这样做"和"长期怎么维护"。

---

## 一、系统是什么

每个管理后台页面右下角有一个「提交需求」浮动按钮。点击后弹出一个对话框，用户用自然语言描述想要的功能，LLM 会：

1. 读取 `system-knowledge.md`，了解系统现有功能
2. 多轮追问，澄清不清楚的地方
3. 整理成结构化摘要（标题 / 详细描述 / 优先级）
4. 等用户点「确认并保存」，才写入数据库

管理员在 `/admin/feedback` 查看所有提交，标记处理状态，管理 LLM 配置。

---

## 二、安装到新系统

### 第一步：运行安装脚本

```bash
bash scripts/install-feedback-plugin.sh ~/coding/MyOtherApp/my-app
```

脚本自动复制所有文件，并打印接下来需要手动做的事。

---

### 第二步：适配 `adapter.ts`（唯一需要改的文件）

打开新系统的 `src/lib/feedback/adapter.ts`，把 3 行 import 改成指向新系统自己的 auth、prisma、权限检查：

```typescript
import { auth }        from '@/lib/auth/auth'    // ← 改成你系统的 session 函数
import { prisma }      from '@/lib/db/prisma'    // ← 改成你系统的 Prisma 客户端
import { requireRole } from '@/lib/auth/rbac'    // ← 改成你系统的权限检查
```

**这是唯一的耦合点**。插件的其他所有文件都只从 `adapter.ts` import，不直接依赖任何系统内部路径。

`adapter.ts` 对三个依赖的要求：

| 依赖 | 要求 |
|---|---|
| `auth()` | 返回 `null` 或 `{ user: { id, name?, email?, role? } }` |
| `prisma` | 标准 PrismaClient 实例 |
| `requireFeedbackAccess()` | 返回 `{ error: NextResponse \| null }`；无权限时 error 非 null |

如果目标系统的角色模型不同（比如用 `isAdmin` 替代 role），直接改 `adapter.ts` 里的 `requireFeedbackAccess` 函数体即可。

---

### 第三步：Prisma Schema

在 `prisma/schema.prisma` 添加以下内容：

```prisma
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
```

在 User model 里加关系字段：
```prisma
featureRequests FeatureRequest[] @relation("FeatureRequestSubmitter")
```

然后跑迁移：
```bash
npx prisma migrate dev --name add_feedback_plugin
```

---

### 第四步：挂载 Widget

在 layout 文件里加一行（在 `</body>` 前）：

```tsx
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'

// layout JSX 里：
<FeedbackWidget />
```

---

### 第五步：安装 SDK 和配置环境变量

```bash
npm install @anthropic-ai/sdk
```

在 `.env.local` 加（至少配一个）：

```env
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
ALIBABA_API_KEY=sk-...
```

API Key 也可以在后台 `/admin/feedback` → 模型配置 里填写。DB 里存的 Key 优先级高于环境变量。

---

### 第六步：写 `system-knowledge.md`（最重要的一步，详见第四章）

把新系统的功能描述写进 `src/lib/feedback/system-knowledge.md`，替换掉复制过来的 Adviser 版本。

---

### 可选：添加管理页面

把 `src/app/[locale]/(admin)/admin/feedback/page.tsx` 复制到目标系统并适配路由，再在导航栏加一个入口。

---

## 三、日常使用

### 用户侧：提交需求

1. 点击页面右下角「提交需求」按钮
2. 用自然语言描述需求，无需按格式（例：「想在公司列表加一个按状态筛选的下拉框」）
3. LLM 根据 `system-knowledge.md` 判断这是新功能还是对现有功能的改进，并追问细节
4. 确认 LLM 的摘要无误后，点「确认并保存」
5. 需求保存到数据库，等待管理员处理

**提示**：LLM 会主动问清楚影响范围、优先级、背景，不需要用户自己想全。如果 LLM 理解错了，直接在对话里纠正即可。

---

### 管理员侧：处理需求（`/admin/feedback`）

**查看需求列表**：按提交时间倒序，显示 LLM 生成的标题、优先级（low / medium / high）、状态、提交人。

**查看详情**：点开任意一条，可以看到：
- LLM 整理的结构化摘要
- 完整的对话历史（原始上下文）
- 提交页面的 URL（知道用户在哪个页面提的）

**更新状态**：
- `PENDING` → 刚提交，待评估
- `IN_PROGRESS` → 已排入开发计划
- `DONE` → 已上线
- `REJECTED` → 不做，可在对话里看原因

**最佳实践**：
- 定期（如每周）过一遍 PENDING 状态的需求，打上 `IN_PROGRESS` 或 `REJECTED`，避免积压
- 高优先级需求优先处理，但优先级是 LLM 估的，管理员可以覆盖
- 重复需求不需要合并，多条相同需求本身就是优先级信号

---

### 管理员侧：配置 LLM

入口：`/admin/feedback` → 「模型配置」标签页

| 设置项 | 说明 |
|---|---|
| Provider | Anthropic / DeepSeek / 阿里百炼 |
| Model | 每个 provider 下的可选模型列表 |
| API Key | 填入后保存到 DB，优先于环境变量 |
| 连接测试 | 填完后点「测试连接」验证 Key 是否有效 |

**如何选 Provider**：
- **Anthropic**：效果最好，对话质量高，适合主力使用
- **DeepSeek**：中文场景效果好，成本低，适合以中文用户为主的系统
- **阿里百炼**（Qwen）：适合内网或需要国内合规的场景

---

## 四、维护 `system-knowledge.md`

这是整个系统能否正常工作的核心。LLM **每次**回答用户都会读这个文件。文件准确，LLM 就能区分「这个已经有了」和「这是新需求」；文件过时，LLM 会给出误导性的建议，用户体验变差。

---

### 什么时候必须更新

任何一名开发者（无论用 Claude Code、Cursor 还是 Codex）完成以下类型的变更后，都必须同步更新：

| 变更类型 | 需要更新 |
|---|---|
| 新增后台页面 / 路由 | ✅ 加一个章节或子条目 |
| 新增工作流或状态 | ✅ 在对应模块里补充说明 |
| 现有功能改了用途或行为 | ✅ 修改对应描述 |
| 删除了某个功能 | ✅ 删掉对应内容 |
| 新增平台（如新的子系统） | ✅ 加一节 |
| Bug 修复、样式调整 | ❌ 不需要 |
| 纯重构（行为不变） | ❌ 不需要 |

**这条规则已写入三个 AI 工具的配置文件**（`CLAUDE.md`、`AGENTS.md`、`.cursor/rules/system-knowledge.mdc`），每次做功能时工具会自动提示。

---

### 如何写好一个条目

`system-knowledge.md` 本质是 LLM 的系统提示词，不是给人读的文档，写法和普通文档不同：

**写**：功能边界、关键状态、操作结果
```markdown
### 发票 (`/admin/invoices`)
- 状态流：`DRAFT` → `SENT` → `PAID` / `CANCELLED`
- 创建时支持多行项目（描述、数量、单价、税）
- DRAFT 状态可编辑；其他状态只读
- 可生成并下载 PDF
```

**不要写**：实现细节、组件名、数据库字段名
```markdown
<!-- 避免这样写 -->
- 使用 InvoiceForm.tsx 组件，调用 /api/admin/invoices POST 接口
- invoice 表有 status 字段，用 Prisma 查询
```

**一条好的描述应该让 LLM 能判断**：
- 用户说「想在发票加备注字段」→ LLM 知道这是现有发票功能的扩展请求
- 用户说「想要出纳审批发票」→ LLM 知道这是新功能（现有流程没有审批环节）

---

### 检查文件是否过时

如果发现 LLM 经常说「这个功能还不存在」但实际上已经上线了，或者对现有功能描述不准确，就需要更新 `system-knowledge.md`。

快速检查方法：打开「提交需求」，测试几个已知功能，看 LLM 能否正确识别。如果不能，对照当前代码更新对应章节。

---

### 文件结构约定

```markdown
# 系统名称 — System Knowledge

## Overview          ← 一段话概括，说清楚是什么系统、谁用
## 平台 A
### 模块 1 (`/路由`)
- 功能点（用中文或英文均可，保持一致）
### 模块 2
...
## 平台 B
...
## 共享基础设施      ← 认证、文件存储、权限等
```

---

## 五、故障排查

| 症状 | 原因 | 解决方法 |
|---|---|---|
| 点「提交需求」无反应 | `FeedbackWidget` 未挂载 | 检查 layout 文件是否加了 `<FeedbackWidget />` |
| 对话框打开但发送消息无响应 | API Key 未配置或无效 | 后台 → 模型配置 → 测试连接 |
| LLM 回复说"不了解这个系统" | `system-knowledge.md` 为空或仍是模板 | 更新 `system-knowledge.md` |
| LLM 把已有功能当新需求 | `system-knowledge.md` 未包含该功能 | 在对应章节补充该功能描述 |
| 管理员看不到 `/admin/feedback` | 管理页面未创建 | 按第二章第七步添加管理页面 |
| 管理员看不到配置标签页 | 账号不是 `SUPER_ADMIN` | 该页面仅 SUPER_ADMIN 可访问 |
| 迁移报错 "table already exists" | 手动建表或 db push 残留 | `prisma migrate resolve --applied <name>` 标记为已应用 |

---

## 六、文件结构速查

```
src/lib/feedback/
  adapter.ts            ← 安装新系统时唯一需要改的文件
  llm.ts                ← LLM 流式客户端（Anthropic / DeepSeek / 阿里百炼）
  options.ts            ← Provider 和 Model 选项列表
  system-knowledge.md   ← 系统功能描述，随迭代持续维护
  INSTALL.md            ← 安装步骤速查
  GUIDE.md              ← 本文件：完整运营指南

src/components/feedback/
  FeedbackWidget.tsx    ← 浮动按钮 + 对话框

src/app/api/feedback/
  chat/route.ts         ← 流式 LLM 对话接口
  submit/route.ts       ← 保存已确认需求

src/app/api/admin/feedback/
  route.ts              ← 需求列表（GET）
  [id]/route.ts         ← 需求详情 + 状态更新
  config/route.ts       ← LLM 配置（GET / POST）
```
