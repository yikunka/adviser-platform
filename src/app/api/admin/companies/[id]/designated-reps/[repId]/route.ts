import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  entryDate: z.string().datetime().optional(),
  becomingDate: z.string().datetime().optional(),
  address: z.string().max(500).optional(),
  capacity: z.string().max(100).optional(),
  telFax: z.string().max(50).optional(),
  cessationDate: z.string().datetime().nullable().optional(),
  remarks: z.string().max(1000).optional(),
})

type Params = { params: Promise<{ id: string; repId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId, repId } = await params
  const before = await prisma.designatedRepresentative.findFirst({ where: { id: repId, companyId } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { entryDate, becomingDate, cessationDate, ...rest } = parsed.data
  const data: Prisma.DesignatedRepresentativeUpdateInput = { ...rest }
  if (entryDate !== undefined) data.entryDate = new Date(entryDate)
  if (becomingDate !== undefined) data.becomingDate = new Date(becomingDate)
  if (cessationDate !== undefined) data.cessationDate = cessationDate ? new Date(cessationDate) : null

  const rep = await prisma.designatedRepresentative.update({ where: { id: repId }, data })
  await logAudit(session!.user.id, 'UPDATE', 'DesignatedRepresentative', repId, before, rep)
  return NextResponse.json(rep)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const { id: companyId, repId } = await params
  const rep = await prisma.designatedRepresentative.findFirst({ where: { id: repId, companyId } })
  if (!rep) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.designatedRepresentative.delete({ where: { id: repId } })
  await logAudit(session!.user.id, 'DELETE', 'DesignatedRepresentative', repId, rep, null)
  return NextResponse.json({ message: 'Deleted' })
}
