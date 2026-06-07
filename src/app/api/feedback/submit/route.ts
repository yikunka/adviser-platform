import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth, prisma } from '@/lib/feedback/adapter'

// ─────────────────────────────────────────────
// Feedback Plugin — Save Confirmed Requirement
// POST /api/feedback/submit
// ─────────────────────────────────────────────

const attachmentSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  name: z.string().max(200),
  type: z.string().max(100),
  key: z.string().max(500).optional(),
  storage: z.enum(['oss', 'local']).optional(),
})

const submitSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(5000),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  pageUrl: z.string().trim().max(500),
  pageTitle: z.string().trim().max(200).default(''),
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
  attachments: z.array(attachmentSchema).default([]),
})

function validationErrorMessage(details: z.ZodFlattenedError<z.input<typeof submitSchema>>) {
  const first = details.fieldErrors.title?.[0]
    ?? details.fieldErrors.summary?.[0]
    ?? details.fieldErrors.priority?.[0]
    ?? details.fieldErrors.attachments?.[0]
  return first ?? '请求数据无效，请重试'
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2021' || error.code === 'P2022')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.flatten()
    return NextResponse.json(
      { error: validationErrorMessage(details), details },
      { status: 400 },
    )
  }

  try {
    const record = await prisma.featureRequest.create({
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
    })

    return NextResponse.json(
      { success: true, id: record.id, message: 'Requirement saved.' },
      { status: 201 },
    )
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        {
          error: '需求表不存在或结构未更新，请先运行数据库迁移',
          migration: '20260601040000_add_feature_request_attachments',
        },
        { status: 503 },
      )
    }
    console.error('[feedback/submit]', err)
    return NextResponse.json({ error: '保存需求失败，请稍后重试' }, { status: 500 })
  }
}
