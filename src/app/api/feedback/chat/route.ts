import { NextRequest, NextResponse } from 'next/server'
import { auth, prisma } from '@/lib/feedback/adapter'
import { streamLlmResponse, resolveApiKey, type Provider } from '@/lib/feedback/llm'
import { readFileSync } from 'fs'
import { join } from 'path'

// ─────────────────────────────────────────────
// Feedback Plugin — Streaming LLM Chat Endpoint
// POST /api/feedback/chat
// Response: newline-delimited JSON (NDJSON)
// ─────────────────────────────────────────────

function getSystemKnowledge(): string {
  try {
    return readFileSync(join(process.cwd(), 'src/lib/feedback/system-knowledge.md'), 'utf-8')
  } catch {
    return '(System knowledge file not found — add src/lib/feedback/system-knowledge.md)'
  }
}

function buildSystemPrompt(pageUrl: string, pageTitle: string, language: 'auto' | 'en'): string {
  const confirmInstruction = language === 'en'
    ? `2. Once you understand the request, summarize it clearly in English and ask: "Is this what you want? If it looks good, I will save this request."`
    : `2. 理解清楚后，用与用户相同的语言整理一个清晰的需求摘要，然后询问："这是你想要的吗？如果没问题，我就保存这条需求。"（如果用户用英文，就用英文问；用中文就用中文问）`
  const languageRule = language === 'en'
    ? `【语言规则 - 严格执行】
- You must reply in English only.
- Ask clarification questions, summarize requirements, and confirmation prompts in English.
- Do not use Chinese in this conversation.`
    : `【语言规则 - 严格执行】
- 检测用户最新一条消息使用的语言，整条回复必须用同一语言
- 绝对禁止在同一条回复中混用中英文
- 如果用户用中文，回复全程中文；用英文，回复全程英文`

  return `你是一个内嵌在 Web 平台中的需求分析助手。用户通过反馈入口描述他们想要的功能改进或新增需求。

【对话流程】
1. 理解用户的诉求，如有不清楚的地方，一次最多问 1-2 个问题
${confirmInstruction}
3. 用户明确确认后（说"是"、"对"、"yes"、"correct"、"没问题" 等），立即调用 confirm_requirement 工具
4. 用户未明确确认前，不得调用 confirm_requirement

${languageRule}

【风格要求】
- 回复简短（2-4 句话）
- 语气亲切专业
- 不讨论实现细节或时间安排

【当前页面上下文】
URL: ${pageUrl}
标题: ${pageTitle}

---
【系统功能说明】
${getSystemKnowledge()}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Load active LLM config from DB (falls back to defaults if no row)
  const config = await prisma.feedbackConfig.findUnique({ where: { id: 'singleton' } })
  const provider = (config?.provider ?? 'anthropic') as Provider
  const model = config?.model ?? 'claude-opus-4-5'
  // DB-stored key takes priority over env var
  const dbKey = provider === 'anthropic' ? (config?.anthropicKey ?? '') :
                provider === 'deepseek'  ? (config?.deepseekKey ?? '')  :
                                           (config?.alibabaKey ?? '')
  const apiKey = resolveApiKey(provider, dbKey)

  const messages = (body.messages as { role: string; content: string }[]).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  const pageUrl: string = body.pageContext?.url ?? '/'
  const pageTitle: string = body.pageContext?.title ?? ''
  const language = body.language === 'en' ? 'en' : 'auto'
  const systemPrompt = buildSystemPrompt(pageUrl, pageTitle, language)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      try {
        await streamLlmResponse({
          provider,
          model,
          apiKey,
          systemPrompt,
          messages,
          onEvent: event => send(event as Record<string, unknown>),
        })
        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'LLM request failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
