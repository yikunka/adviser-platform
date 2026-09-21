import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
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

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenus: ['jmmSuppliers', 'jmmOrders'] })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize') ?? '20') || 20))
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { company: { contains: q, mode: 'insensitive' as const } },
          { vatNumber: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, rows] = await Promise.all([
    prisma.jmmSupplier.count({ where }),
    prisma.jmmSupplier.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { invoices: true } } },
    }),
  ])

  return NextResponse.json({
    total,
    suppliers: rows.map(row => ({
      id: row.id,
      name: row.name,
      company: row.company,
      phone: row.phone,
      email: row.email,
      address: row.address,
      vatNumber: row.vatNumber,
      notes: row.notes,
      invoiceCount: row._count.invoices,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('jmmSuppliers.create')
  if (error || !session) return error
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
  const supplier = await prisma.jmmSupplier.create({ data: parsed.data })
  await logAudit(session.user.id, 'JMM_SUPPLIER_CREATE', 'JmmSupplier', supplier.id, null, { name: supplier.name })
  return NextResponse.json({ id: supplier.id }, { status: 201 })
}
