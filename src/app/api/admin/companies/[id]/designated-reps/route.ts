import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  entryDate: z.string().datetime(),
  becomingDate: z.string().datetime(),
  address: z.string().max(500).optional(),
  capacity: z.string().max(100).optional(),
  telFax: z.string().max(50).optional(),
  cessationDate: z.string().datetime().optional(),
  remarks: z.string().max(1000).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await params
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { entryDate, becomingDate, cessationDate, ...rest } = parsed.data

  const rep = await prisma.designatedRepresentative.create({
    data: {
      ...rest,
      companyId,
      entryDate: new Date(entryDate),
      becomingDate: new Date(becomingDate),
      ...(cessationDate && { cessationDate: new Date(cessationDate) }),
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'DesignatedRepresentative', rep.id, null, rep)
  return NextResponse.json(rep, { status: 201 })
}
