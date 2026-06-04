import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveApiKey, maskApiKey, testLlmConnection } from '../lib/llm'
import { generateRawKey, hashKey } from '../lib/devtool-auth'
import type { FeedbackAdapter } from '../types'
import type { Provider } from '../lib/options'

const updateSchema = z.object({
  provider:     z.enum(['anthropic', 'deepseek', 'alibaba']),
  model:        z.string().trim().min(1).max(100),
  anthropicKey: z.string().max(200).optional(),
  deepseekKey:  z.string().max(200).optional(),
  alibabaKey:   z.string().max(200).optional(),
})

type ConfigRow = {
  provider: string; model: string
  anthropicKey: string; deepseekKey: string; alibabaKey: string
  devtoolKeyHash: string
}

function buildResponse(config: ConfigRow) {
  const p = config.provider as Provider
  const dbKey = p === 'anthropic' ? config.anthropicKey : p === 'deepseek' ? config.deepseekKey : config.alibabaKey
  const effectiveKey = resolveApiKey(p, dbKey)
  return {
    provider: config.provider, model: config.model,
    hasApiKey: !!effectiveKey,
    hasDevtoolKey: !!config.devtoolKeyHash,
    keys: {
      anthropic: maskApiKey(resolveApiKey('anthropic', config.anthropicKey)),
      deepseek:  maskApiKey(resolveApiKey('deepseek',  config.deepseekKey)),
      alibaba:   maskApiKey(resolveApiKey('alibaba',   config.alibabaKey)),
    },
  }
}

export function createAdminConfigRoute(adapter: FeedbackAdapter) {
  return {
    async GET() {
      const { error } = await adapter.requireAccess()
      if (error) return error
      try {
        const config = await adapter.db.feedbackConfig.upsert({
          where: { id: 'singleton' }, update: {},
          create: { id: 'singleton', provider: 'anthropic', model: 'claude-opus-4-5' },
        }) as ConfigRow
        return NextResponse.json(buildResponse(config))
      } catch (err) {
        console.error('[sharecto/config GET]', err)
        return NextResponse.json({ provider: 'anthropic', model: 'claude-opus-4-5', hasApiKey: false, keys: { anthropic: '', deepseek: '', alibaba: '' } })
      }
    },

    async PATCH(req: NextRequest) {
      const { error } = await adapter.requireAccess()
      if (error) return error
      const body = await req.json().catch(() => null)
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
      try {
        const updateData = {
          provider: parsed.data.provider, model: parsed.data.model,
          ...(parsed.data.anthropicKey ? { anthropicKey: parsed.data.anthropicKey } : {}),
          ...(parsed.data.deepseekKey  ? { deepseekKey:  parsed.data.deepseekKey  } : {}),
          ...(parsed.data.alibabaKey   ? { alibabaKey:   parsed.data.alibabaKey   } : {}),
        }
        const existing = await adapter.db.feedbackConfig.findUnique({ where: { id: 'singleton' } })
        const config = existing
          ? await adapter.db.feedbackConfig.update({ where: { id: 'singleton' }, data: updateData })
          : await adapter.db.feedbackConfig.create({ data: { id: 'singleton', anthropicKey: '', deepseekKey: '', alibabaKey: '', ...updateData } })
        return NextResponse.json({ ...buildResponse(config as ConfigRow), toast: '配置已保存' })
      } catch (err) {
        return NextResponse.json({ error: `保存失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
      }
    },

    async POST(req: NextRequest) {
      const { error } = await adapter.requireAccess()
      if (error) return error
      const body = await req.json().catch(() => ({})) as { action?: string }

      if (body?.action === 'generate-devtool-key') {
        const rawKey = generateRawKey()
        await adapter.db.feedbackConfig.upsert({
          where: { id: 'singleton' }, update: { devtoolKeyHash: hashKey(rawKey) },
          create: { id: 'singleton', provider: 'anthropic', model: 'claude-opus-4-5', devtoolKeyHash: hashKey(rawKey) },
        })
        return NextResponse.json({ action: 'generate-devtool-key', rawKey })
      }

      if (body?.action === 'revoke-devtool-key') {
        await adapter.db.feedbackConfig.upsert({
          where: { id: 'singleton' }, update: { devtoolKeyHash: '' },
          create: { id: 'singleton', provider: 'anthropic', model: 'claude-opus-4-5', devtoolKeyHash: '' },
        })
        return NextResponse.json({ action: 'revoke-devtool-key', success: true })
      }

      if (body?.action !== 'test') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

      try {
        const config = await adapter.db.feedbackConfig.findUnique({ where: { id: 'singleton' } }) as ConfigRow | null
        if (!config) return NextResponse.json({ success: false, error: '未找到配置，请先保存' }, { status: 404 })
        const p = config.provider as Provider
        const dbKey = p === 'anthropic' ? config.anthropicKey : p === 'deepseek' ? config.deepseekKey : config.alibabaKey
        const apiKey = resolveApiKey(p, dbKey)
        const reply = await testLlmConnection(p, config.model, apiKey)
        return NextResponse.json({ success: true, reply: reply.slice(0, 100) })
      } catch (err) {
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '连接失败' }, { status: 502 })
      }
    },
  }
}
