import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const createSchema = z.object({
  changeType: z.enum(['TRANSFER', 'NEW_ALLOTMENT', 'REDEMPTION', 'NAME_CHANGE']),
  effectiveDate: z.string().datetime(),
  transferorId: z.string().cuid().optional(),
  transfereeId: z.string().cuid().optional(),
  numberOfShares: z.number().int().positive().optional(),
  shareClass: z.string().optional(),
  consideration: z.number().positive().optional(),
  notes: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId } = await params
  const changes = await prisma.shareholderChange.findMany({
    where: { companyId },
    orderBy: { effectiveDate: 'desc' },
    include: { processedBy: { select: { nameEn: true } } },
  })
  return NextResponse.json(changes)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId } = await params
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const change = await prisma.shareholderChange.create({
    data: {
      companyId,
      ...parsed.data,
      effectiveDate: new Date(parsed.data.effectiveDate),
      consideration: parsed.data.consideration != null ? parsed.data.consideration : undefined,
      processedById: session.user.id,
    },
  })

  await logAudit(session.user.id, 'CREATE_SHAREHOLDER_CHANGE', 'ShareholderChange', change.id, null, change)
  return NextResponse.json(change, { status: 201 })
}
