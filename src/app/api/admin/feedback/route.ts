import { NextRequest, NextResponse } from 'next/server'
import { requireFeedbackAccess, prisma } from '@/lib/feedback/adapter'

// ─────────────────────────────────────────────
// Feedback Plugin — Admin: List Requirements
// GET /api/admin/feedback
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error } = await requireFeedbackAccess()
  if (error) return error

  const status = req.nextUrl.searchParams.get('status') || undefined
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
  const cursor = req.nextUrl.searchParams.get('cursor') || undefined

  const records = await prisma.featureRequest.findMany({
    where: status ? { status: status as 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      number: true,
      title: true,
      summary: true,
      priority: true,
      pageUrl: true,
      pageTitle: true,
      status: true,
      userEmail: true,
      userName: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const hasMore = records.length > limit
  const items = hasMore ? records.slice(0, limit) : records
  const nextCursor = hasMore ? items[items.length - 1]?.id : null

  return NextResponse.json({ items, nextCursor, hasMore })
}
