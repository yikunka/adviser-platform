import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const createSchema = z.object({
  previousAddress: z.string().min(1).max(500),
  newAddress: z.string().min(1).max(500),
  effectiveDate: z.string().datetime(),
  notes: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId } = await params
  const changes = await prisma.addressChange.findMany({
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

  // Create change record and update company address in a transaction
  const [change] = await prisma.$transaction([
    prisma.addressChange.create({
      data: {
        companyId,
        previousAddress: parsed.data.previousAddress,
        newAddress: parsed.data.newAddress,
        effectiveDate: new Date(parsed.data.effectiveDate),
        notes: parsed.data.notes,
        processedById: session.user.id,
      },
    }),
    prisma.company.update({
      where: { id: companyId },
      data: { registeredAddress: parsed.data.newAddress },
    }),
  ])

  await logAudit(session.user.id, 'ADDRESS_CHANGE', 'Company', companyId,
    { registeredAddress: parsed.data.previousAddress },
    { registeredAddress: parsed.data.newAddress },
  )

  return NextResponse.json(change, { status: 201 })
}
