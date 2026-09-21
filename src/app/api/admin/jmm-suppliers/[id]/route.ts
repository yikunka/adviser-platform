import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().default(''),
  phone: z.string().trim().max(50).optional().default(''),
  email: z.union([z.string().trim().email().max(320), z.literal('')]).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  vatNumber: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
})

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmSuppliers.edit')
  if (error || !session) return error
  const { id } = await ctx.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
  const before = await prisma.jmmSupplier.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.jmmSupplier.update({ where: { id }, data: parsed.data })
  await logAudit(session.user.id, 'JMM_SUPPLIER_UPDATE', 'JmmSupplier', id, { name: before.name }, { name: parsed.data.name })
  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmSuppliers.delete')
  if (error || !session) return error
  const { id } = await ctx.params
  const supplier = await prisma.jmmSupplier.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (supplier._count.invoices > 0) {
    return NextResponse.json({ error: 'This supplier still has invoices' }, { status: 409 })
  }
  await prisma.jmmSupplier.delete({ where: { id } })
  await logAudit(session.user.id, 'JMM_SUPPLIER_DELETE', 'JmmSupplier', id, { name: supplier.name }, null)
  return NextResponse.json({ ok: true })
}
