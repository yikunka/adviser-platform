import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { JMM_CURRENCIES, JMM_ORDER_STATUSES, decimalToNumber, lineAmount, nextJmmOrderNumber } from '@/lib/jmm/orders'

const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().max(40).optional().default(''),
  unitPrice: z.number().min(0).max(1_000_000_000),
})

const createSchema = z.object({
  customerId: z.string().trim().min(1),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(JMM_ORDER_STATUSES).default('DRAFT'),
  currency: z.enum(JMM_CURRENCIES).default('USD'),
  notes: z.string().trim().max(2000).optional().default(''),
  lines: z.array(lineSchema).min(1).max(100),
})

function serializeOrder(order: {
  id: string
  orderNumber: string
  orderDate: Date
  status: string
  currency: string
  notes: string
  createdAt: Date
  updatedAt: Date
  customer: { id: string; name: string; company: string }
  createdBy: { nameEn: string } | null
  lines: { amount: Prisma.Decimal }[]
}) {
  const total = order.lines.reduce((sum, line) => sum + decimalToNumber(line.amount), 0)
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate.toISOString().slice(0, 10),
    status: order.status,
    currency: order.currency,
    notes: order.notes,
    customer: order.customer,
    createdByName: order.createdBy?.nameEn ?? null,
    lineCount: order.lines.length,
    total: Math.round(total * 100) / 100,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const status = searchParams.get('status')?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20))

  const where: Prisma.JmmOrderWhereInput = {}
  if ((JMM_ORDER_STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof JMM_ORDER_STATUSES)[number]
  }
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { customer: { company: { contains: q, mode: 'insensitive' } } },
      { lines: { some: { description: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.jmmOrder.count({ where }),
    prisma.jmmOrder.findMany({
      where,
      orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, company: true } },
        createdBy: { select: { nameEn: true } },
        lines: { select: { amount: true } },
      },
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize,
    orders: rows.map(serializeOrder),
  })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('jmmOrders.create')
  if (error || !session) return error

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  }

  const customer = await prisma.jmmCustomer.findUnique({ where: { id: parsed.data.customerId } })
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 400 })

  const orderDate = new Date(`${parsed.data.orderDate}T00:00:00.000Z`)
  const lines = parsed.data.lines.map((line, index) => ({
    sortOrder: index,
    description: line.description,
    quantity: new Prisma.Decimal(line.quantity),
    unit: line.unit,
    unitPrice: new Prisma.Decimal(line.unitPrice),
    amount: lineAmount(line.quantity, line.unitPrice),
  }))

  let createdId = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const orderNumber = await nextJmmOrderNumber(orderDate)
    try {
      const created = await prisma.jmmOrder.create({
        data: {
          orderNumber,
          customerId: parsed.data.customerId,
          orderDate,
          status: parsed.data.status,
          currency: parsed.data.currency,
          notes: parsed.data.notes,
          createdById: session.user.id,
          lines: { create: lines },
        },
        select: { id: true, orderNumber: true },
      })
      createdId = created.id
      await logAudit(session.user.id, 'JMM_ORDER_CREATE', 'JmmOrder', created.id, null, {
        orderNumber: created.orderNumber,
        status: parsed.data.status,
      })
      break
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 2) {
        continue
      }
      throw err
    }
  }

  return NextResponse.json({ id: createdId }, { status: 201 })
}
