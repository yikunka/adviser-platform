import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireFeedbackAccess, prisma } from '@/lib/feedback/adapter'
import { resolveApiKey, maskApiKey, testLlmConnection } from '@/lib/feedback/llm'
import { type Provider } from '@/lib/feedback/options'

// ─────────────────────────────────────────────
// Feedback Plugin — LLM Config (singleton row)
// GET   /api/admin/feedback/config
// PATCH /api/admin/feedback/config
// POST  /api/admin/feedback/config  { action: 'test' }
// ─────────────────────────────────────────────

const updateSchema = z.object({
  provider:     z.enum(['anthropic', 'deepseek', 'alibaba']),
  model:        z.string().trim().min(1).max(100),
  anthropicKey: z.string().max(200).optional(),
  deepseekKey:  z.string().max(200).optional(),
  alibabaKey:   z.string().max(200).optional(),
})

function buildResponse(config: {
  provider: string
  model: string
  anthropicKey: string
  deepseekKey: string
  alibabaKey: string
}) {
  const p = config.provider as Provider
  const dbKey =
    p === 'anthropic' ? config.anthropicKey :
    p === 'deepseek'  ? config.deepseekKey  : config.alibabaKey
  const effectiveKey = resolveApiKey(p, dbKey)

  return {
    provider:  config.provider,
    model:     config.model,
    hasApiKey: !!effectiveKey,
    // Masked hints so UI can show "already configured" per provider
    keys: {
      anthropic: maskApiKey(resolveApiKey('anthropic', config.anthropicKey)),
      deepseek:  maskApiKey(resolveApiKey('deepseek',  config.deepseekKey)),
      alibaba:   maskApiKey(resolveApiKey('alibaba',   config.alibabaKey)),
    },
  }
}

export async function GET() {
  const { error } = await requireFeedbackAccess()
  if (error) return error

  try {
    const config = await prisma.feedbackConfig.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton', provider: 'anthropic', model: 'claude-opus-4-5' },
    })
    return NextResponse.json(buildResponse(config))
  } catch (err) {
    console.error('[feedback/config GET]', err)
    // Return a safe default so the UI still renders
    return NextResponse.json({
      provider: 'anthropic', model: 'claude-opus-4-5',
      hasApiKey: false, keys: { anthropic: '', deepseek: '', alibaba: '' },
    })
  }
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireFeedbackAccess()
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const updateData = {
      provider: parsed.data.provider,
      model:    parsed.data.model,
      ...(parsed.data.anthropicKey ? { anthropicKey: parsed.data.anthropicKey } : {}),
      ...(parsed.data.deepseekKey  ? { deepseekKey:  parsed.data.deepseekKey  } : {}),
      ...(parsed.data.alibabaKey   ? { alibabaKey:   parsed.data.alibabaKey   } : {}),
    }
    // Upsert the singleton config row
    const existing = await prisma.feedbackConfig.findUnique({ where: { id: 'singleton' } })
    let config
    if (existing) {
      config = await prisma.feedbackConfig.update({ where: { id: 'singleton' }, data: updateData })
    } else {
      config = await prisma.feedbackConfig.create({
        data: {
          id:           'singleton',
          provider:     parsed.data.provider,
          model:        parsed.data.model,
          anthropicKey: parsed.data.anthropicKey ?? '',
          deepseekKey:  parsed.data.deepseekKey  ?? '',
          alibabaKey:   parsed.data.alibabaKey   ?? '',
        },
      })
    }
    return NextResponse.json({ ...buildResponse(config), toast: '配置已保存' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[feedback/config PATCH]', msg)
    return NextResponse.json({ error: `保存失败：${msg}` }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireFeedbackAccess()
  if (error) return error

  const body = await req.json().catch(() => ({}))
  if (body?.action !== 'test') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  try {
    const config = await prisma.feedbackConfig.findUnique({ where: { id: 'singleton' } })
    if (!config) return NextResponse.json({ success: false, error: '未找到配置，请先保存' }, { status: 404 })

    const provider = config.provider as Provider
    const dbKey =
      provider === 'anthropic' ? config.anthropicKey :
      provider === 'deepseek'  ? config.deepseekKey  : config.alibabaKey
    const apiKey = resolveApiKey(provider, dbKey)

    const reply = await testLlmConnection(provider, config.model, apiKey)
    return NextResponse.json({ success: true, reply: reply.slice(0, 100) })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '连接失败' },
      { status: 502 },
    )
  }
}
