import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db/prisma'

async function buildRecipeKnowledge(): Promise<string> {
  const recipes = await prisma.cosTableRecipe.findMany({
    include: {
      category: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          notes: true,
          sortOrder: true,
          rawMaterial: { select: { name: true, productionCode: true } },
          componentRecipe: { select: { code: true, name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: [{ categoryId: 'asc' }, { code: 'asc' }],
  })

  if (recipes.length === 0) return '（暂无工艺书数据）'

  const lines: string[] = ['## CosmoCoat 产品工艺书数据库\n']

  for (const r of recipes) {
    lines.push(`### ${r.code} — ${r.name}`)
    lines.push(`- **类别**: ${r.category.name}`)
    lines.push(`- **批量**: ${r.batchQuantity} kg`)
    if (r.viscosity) lines.push(`- **粘度**: ${r.viscosity}${r.viscosityUnit ?? ''}`)
    if (r.shelfLifeDays) lines.push(`- **保质期**: ${r.shelfLifeDays} 天`)

    if (r.items.length > 0) {
      lines.push('- **配方物料**:')
      for (const item of r.items) {
        const matName = item.rawMaterial?.name ?? item.componentRecipe?.name ?? '—'
        const matCode = item.rawMaterial?.productionCode ?? item.componentRecipe?.code ?? ''
        lines.push(`  - ${matName}${matCode ? ` (${matCode})` : ''}: ${item.quantity} kg`)
      }
    }

    if (r.packagingRequirements) lines.push(`- **包装要求**: ${r.packagingRequirements}`)
    if (r.productionSpeedRequirements) lines.push(`- **生产速度**: ${r.productionSpeedRequirements}`)
    if (r.productionTimeRequirements) lines.push(`- **生产时间**: ${r.productionTimeRequirements}`)
    if (r.productionNotes) lines.push(`- **生产备注**: ${r.productionNotes}`)
    if (r.qcTestStandard) lines.push(`- **QC标准**: ${r.qcTestStandard}`)
    if (r.qcTestItems.length > 0) lines.push(`- **QC检测项**: ${r.qcTestItems.join('、')}`)
    if (r.qcResult) lines.push(`- **QC结果**: ${r.qcResult}`)
    if (r.notes) lines.push(`- **备注**: ${r.notes}`)
    lines.push('')
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT_PREFIX = `你是 CosmoCoat 的专业产品顾问 AI。你的职责是帮助客户了解 CosmoCoat 的涂料产品和工艺配方信息。

## 关于 CosmoCoat
CosmoCoat 是专注于工业涂料的专业品牌，产品涵盖手感漆、色漆/烤漆、环保UV漆、特殊效果漆等系列。

## 回答规则
- 根据下方工艺书数据库准确回答关于产品配方、工艺参数的问题
- 回复简洁专业（3–5句），数据精准
- 涉及报价、定制方案等商务问题，请建议联系 CosmoCoat 业务团队
- 如问题超出数据库范围，如实告知并建议联系技术支持
- 使用中文回复

`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 503 })
  }

  const messages = (body.messages as { role: string; content: string }[]).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let recipeKnowledge = ''
  try {
    recipeKnowledge = await buildRecipeKnowledge()
  } catch {
    recipeKnowledge = '（工艺书数据暂时无法获取，请联系技术支持）'
  }

  const systemPrompt = SYSTEM_PROMPT_PREFIX + recipeKnowledge

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }
      try {
        const anthropic = new Anthropic({ apiKey })
        const sdkStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: systemPrompt,
          messages,
        })
        for await (const chunk of sdkStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            send({ type: 'text', text: chunk.delta.text })
          }
        }
        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' })
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
