import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth, prisma } from '@/lib/feedback/adapter'

// ─────────────────────────────────────────────
// Feedback Plugin — Save Confirmed Requirement
// POST /api/feedback/submit
// ─────────────────────────────────────────────

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
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const record = await prisma.featureRequest.create({
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary,
      priority: parsed.data.priority,
      pageUrl: parsed.data.pageUrl,
      pageTitle: parsed.data.pageTitle,
      conversation: parsed.data.conversation,
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      userName: session.user.name ?? '',
    },
  })

  return NextResponse.json(
    { success: true, id: record.id, message: 'Requirement saved.' },
    { status: 201 },
  )
}
