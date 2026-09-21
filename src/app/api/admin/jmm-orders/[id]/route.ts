import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { JMM_CURRENCIES, JMM_ORDER_STATUSES, decimalToNumber, lineAmount } from '@/lib/jmm/orders'

const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().max(40).optional().default(''),
  unitPrice: z.number().min(0).max(1_000_000_000),
})

const updateSchema = z.object({
  customerId: z.string().trim().min(1),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(JMM_ORDER_STATUSES),
  currency: z.enum(JMM_CURRENCIES),
  notes: z.string().trim().max(2000).optional().default(''),
  lines: z.array(lineSchema).min(1).max(100),
})

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error

  const { id } = await ctx.params
  const order = await prisma.jmmOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      createdBy: { select: { nameEn: true } },
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customer: order.customer,
    orderDate: order.orderDate.toISOString().slice(0, 10),
    status: order.status,
    currency: order.currency,
    notes: order.notes,
    createdByName: order.createdBy?.nameEn ?? null,
    lines: order.lines.map(line => ({
      id: line.id,
      description: line.description,
      quantity: decimalToNumber(line.quantity),
      unit: line.unit,
      unitPrice: decimalToNumber(line.unitPrice),
      amount: decimalToNumber(line.amount),
    })),
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error

  const { id } = await ctx.params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  }

  const before = await prisma.jmmOrder.findUnique({ where: { id }, select: { id: true, orderNumber: true, status: true } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const customer = await prisma.jmmCustomer.findUnique({ where: { id: parsed.data.customerId } })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 400 })

  const lines = parsed.data.lines.map((line, index) => ({
    sortOrder: index,
    description: line.description,
    quantity: new Prisma.Decimal(line.quantity),
    unit: line.unit,
    unitPrice: new Prisma.Decimal(line.unitPrice),
    amount: lineAmount(line.quantity, line.unitPrice),
  }))

  await prisma.$transaction([
    prisma.jmmOrderLine.deleteMany({ where: { orderId: id } }),
    prisma.jmmOrder.update({
      where: { id },
      data: {
        customerId: parsed.data.customerId,
        orderDate: new Date(`${parsed.data.orderDate}T00:00:00.000Z`),
        status: parsed.data.status,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
        lines: { create: lines },
      },
    }),
  ])

  await logAudit(session.user.id, 'JMM_ORDER_UPDATE', 'JmmOrder', id, {
    orderNumber: before.orderNumber,
    status: before.status,
  }, {
    orderNumber: before.orderNumber,
    status: parsed.data.status,
  })

  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.delete')
  if (error || !session) return error

  const { id } = await ctx.params
  const order = await prisma.jmmOrder.findUnique({ where: { id }, select: { id: true, orderNumber: true, status: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.jmmOrder.delete({ where: { id } })
  await logAudit(session.user.id, 'JMM_ORDER_DELETE', 'JmmOrder', id, {
    orderNumber: order.orderNumber,
    status: order.status,
  }, null)

  return NextResponse.json({ ok: true })
}
