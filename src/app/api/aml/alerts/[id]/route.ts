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
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
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

  // Resolve subject name without schema relations
  let subjectName: string | null = null
  if (alert.keyPersonId) {
    const p = await prisma.keyPerson.findUnique({ where: { id: alert.keyPersonId }, select: { nameEn: true } })
    subjectName = p?.nameEn ?? null
  } else if (alert.companyId) {
    const c = await prisma.company.findUnique({ where: { id: alert.companyId }, select: { nameEn: true } })
    subjectName = c?.nameEn ?? null
  }

  return NextResponse.json({ ...alert, subjectName })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole('COMPLIANCE', { adminMenu: 'aml' })
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
