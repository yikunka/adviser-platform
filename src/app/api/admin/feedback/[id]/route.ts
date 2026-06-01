import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireFeedbackAccess, prisma } from '@/lib/feedback/adapter'

// ─────────────────────────────────────────────
// Feedback Plugin — Admin: Update Status / Get Detail
// GET  /api/admin/feedback/[id]
// PATCH /api/admin/feedback/[id]
// ─────────────────────────────────────────────

const updateSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED']).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireFeedbackAccess()
  if (error) return error

  const { id } = await params
  const record = await prisma.featureRequest.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ item: record })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireFeedbackAccess()
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const record = await prisma.featureRequest.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.featureRequest.update({
    where: { id },
    data: { ...(parsed.data.status ? { status: parsed.data.status } : {}) },
  })

  return NextResponse.json({ item: updated })
}
