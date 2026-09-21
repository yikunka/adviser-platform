import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().default(''),
  phone: z.string().trim().max(50).optional().default(''),
  email: z.union([z.string().trim().email().max(320), z.literal('')]).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  deliveryAddress: z.string().trim().max(500).optional().default(''),
  vatNumber: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
})

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmCustomers' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20))

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { company: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { vatNumber: { contains: q, mode: 'insensitive' as const } },
          { deliveryAddress: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, rows] = await Promise.all([
    prisma.jmmCustomer.count({ where }),
    prisma.jmmCustomer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { orders: true } } },
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize,
    customers: rows.map(row => ({
      id: row.id,
      name: row.name,
      company: row.company,
      phone: row.phone,
      email: row.email,
      address: row.address,
      deliveryAddress: row.deliveryAddress,
      vatNumber: row.vatNumber,
      notes: row.notes,
      orderCount: row._count.orders,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('jmmCustomers.create')
  if (error || !session) return error

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })
  }

  const customer = await prisma.jmmCustomer.create({ data: parsed.data })
  await logAudit(session.user.id, 'JMM_CUSTOMER_CREATE', 'JmmCustomer', customer.id, null, {
    name: customer.name,
    company: customer.company,
  })

  return NextResponse.json({ id: customer.id }, { status: 201 })
}
