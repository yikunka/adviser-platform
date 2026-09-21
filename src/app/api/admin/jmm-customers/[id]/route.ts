import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().default(''),
  phone: z.string().trim().max(50).optional().default(''),
  email: z.union([z.string().trim().email().max(320), z.literal('')]).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  deliveryAddress: z.string().trim().max(500).optional().default(''),
  vatNumber: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
})

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmCustomers' })
  if (error) return error

  const { id } = await ctx.params
  const customer = await prisma.jmmCustomer.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: customer.id,
    name: customer.name,
    company: customer.company,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    deliveryAddress: customer.deliveryAddress,
    vatNumber: customer.vatNumber,
    notes: customer.notes,
    orderCount: customer._count.orders,
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmCustomers.edit')
  if (error || !session) return error

  const { id } = await ctx.params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })
  }

  const before = await prisma.jmmCustomer.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const customer = await prisma.jmmCustomer.update({ where: { id }, data: parsed.data })
  await logAudit(session.user.id, 'JMM_CUSTOMER_UPDATE', 'JmmCustomer', id, {
    name: before.name,
    company: before.company,
  }, {
    name: customer.name,
    company: customer.company,
  })

  return NextResponse.json({ id: customer.id })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmCustomers.delete')
  if (error || !session) return error

  const { id } = await ctx.params
  const customer = await prisma.jmmCustomer.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (customer._count.orders > 0) {
    return NextResponse.json({ error: 'This customer still has orders' }, { status: 409 })
  }

  await prisma.jmmCustomer.delete({ where: { id } })
  await logAudit(session.user.id, 'JMM_CUSTOMER_DELETE', 'JmmCustomer', id, {
    name: customer.name,
    company: customer.company,
  }, null)

  return NextResponse.json({ ok: true })
}
