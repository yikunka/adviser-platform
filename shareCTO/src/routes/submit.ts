import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { FeedbackAdapter } from '../types'

const attachmentSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  name: z.string().max(200),
  type: z.string().max(100),
})

const submitSchema = z.object({
  title:        z.string().trim().min(1).max(200),
  summary:      z.string().trim().min(1).max(5000),
  priority:     z.enum(['low', 'medium', 'high']).default('medium'),
  pageUrl:      z.string().trim().max(500),
  pageTitle:    z.string().trim().max(200).default(''),
  conversation: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
  attachments:  z.array(attachmentSchema).default([]),
})

function isMissingTable(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'code' in error &&
    ((error as { code: string }).code === 'P2021' || (error as { code: string }).code === 'P2022')
  )
}

export function createSubmitRoute(adapter: FeedbackAdapter) {
  return {
    async POST(req: NextRequest) {
      const session = await adapter.getSession()
      if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const body = await req.json().catch(() => null)
      const parsed = submitSchema.safeParse(body)
      if (!parsed.success) {
        const details = parsed.error.flatten()
        const first = details.fieldErrors.title?.[0] ?? details.fieldErrors.summary?.[0] ?? '请求数据无效，请重试'
        return NextResponse.json({ error: first, details }, { status: 400 })
      }

      try {
        const record = await adapter.db.featureRequest.create({
          data: {
            title: parsed.data.title,
            summary: parsed.data.summary,
            priority: parsed.data.priority,
            pageUrl: parsed.data.pageUrl,
            pageTitle: parsed.data.pageTitle,
            conversation: parsed.data.conversation,
            attachments: parsed.data.attachments,
            userId: session.user.id,
            userEmail: session.user.email ?? '',
            userName: session.user.name ?? '',
          },
        }) as { id: string }
        return NextResponse.json({ success: true, id: record.id, message: 'Requirement saved.' }, { status: 201 })
      } catch (err) {
        if (isMissingTable(err)) {
          return NextResponse.json({ error: '需求表不存在，请先运行数据库迁移: npx prisma migrate dev --name add_sharecto' }, { status: 503 })
        }
        console.error('[sharecto/submit]', err)
        return NextResponse.json({ error: '保存需求失败，请稍后重试' }, { status: 500 })
      }
    },
  }
}
