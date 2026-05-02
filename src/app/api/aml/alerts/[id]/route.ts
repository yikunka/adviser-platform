import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/logger'

const resolveSchema = z.object({
  resolution: z.enum(['FALSE_POSITIVE', 'CONFIRMED', 'ESCALATED']),
  reviewNotes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id } = await params
  const alert = await prisma.aMLAlert.findUnique({
    where: { id },
    include: {
      amlRecord: {
        include: { source: true },
      },
    },
  })

  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(alert)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole('COMPLIANCE')
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const alert = await prisma.aMLAlert.findUnique({ where: { id } })
  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.aMLAlert.update({
    where: { id },
    data: {
      resolution: parsed.data.resolution,
      reviewNotes: parsed.data.reviewNotes,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      isActive: parsed.data.resolution === 'ESCALATED',
    },
  })

  await logAudit(session.user.id, 'RESOLVE_AML_ALERT', 'AMLAlert', id, alert, updated)
  return NextResponse.json(updated)
}
