import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/feedback/adapter'
import { requireDevtoolKey } from '@/lib/feedback/devtool-auth'

type Params = { params: Promise<{ id: string }> }

// GET /api/devtool/requirements/:id  — full detail including conversation
export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requireDevtoolKey(req)
  if (error) return error

  const { id } = await params
  const requirement = await prisma.featureRequest.findUnique({ where: { id } })
  if (!requirement) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ requirement })
}

// PENDING is internal-only — external systems may only set ACCEPTED and beyond
const VALID_STATUSES = ['ACCEPTED', 'IN_PROGRESS', 'DONE', 'REJECTED']

// PATCH /api/devtool/requirements/:id  — update status
// Body: { "status": "IN_PROGRESS" }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireDevtoolKey(req)
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const existing = await prisma.featureRequest.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.featureRequest.update({
    where: { id },
    data: { status: status as 'ACCEPTED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' },
  })
  return NextResponse.json({ requirement: updated })
}
