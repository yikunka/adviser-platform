import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const createSchema = z.object({
  assetType: z.enum(['COMPANY_BOX', 'COMPANY_SQUARE_SEAL', 'COMPANY_ROUND_SEAL']),
  movementType: z.enum(['IN', 'OUT']),
  movementDate: z.string(),
  handler: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await params
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const record = await prisma.companyFileManagementRecord.create({
    data: {
      companyId,
      assetType: parsed.data.assetType,
      movementType: parsed.data.movementType,
      movementDate: new Date(parsed.data.movementDate),
      handler: parsed.data.handler,
      notes: parsed.data.notes || null,
      createdById: session!.user.id,
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'CompanyFileManagementRecord', record.id, null, record)
  return NextResponse.json({ record }, { status: 201 })
}
