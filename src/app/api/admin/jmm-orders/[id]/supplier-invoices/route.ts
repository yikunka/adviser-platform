import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { JMM_CURRENCIES } from '@/lib/jmm/orders'
import { JMM_SUPPLIER_INVOICE_STATUSES, serializeSupplierInvoice } from '@/lib/jmm/purchase'

const createSchema = z.object({
  supplierId: z.string().trim().min(1),
  invoiceNumber: z.string().trim().min(1).max(80),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(JMM_CURRENCIES).default('USD'),
  amount: z.number().min(0).max(1_000_000_000),
  status: z.enum(JMM_SUPPLIER_INVOICE_STATUSES).default('EXPECTED'),
  notes: z.string().trim().max(2000).optional().default(''),
})

const include = {
  supplier: { select: { id: true, name: true, company: true } },
  shipments: {
    orderBy: { createdAt: 'asc' as const },
    include: { files: { orderBy: { createdAt: 'asc' as const }, select: { id: true, kind: true, fileName: true } } },
  },
}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error
  const { id } = await ctx.params
  const order = await prisma.jmmOrder.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const invoices = await prisma.jmmSupplierInvoice.findMany({
    where: { orderId: id },
    orderBy: { invoiceDate: 'desc' },
    include,
  })
  return NextResponse.json({ invoices: invoices.map(serializeSupplierInvoice) })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id } = await ctx.params
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid supplier invoice' }, { status: 400 })
  const order = await prisma.jmmOrder.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supplier = await prisma.jmmSupplier.findUnique({ where: { id: parsed.data.supplierId }, select: { id: true } })
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 400 })

  const created = await prisma.jmmSupplierInvoice.create({
    data: {
      orderId: id,
      supplierId: parsed.data.supplierId,
      invoiceNumber: parsed.data.invoiceNumber,
      invoiceDate: new Date(`${parsed.data.invoiceDate}T00:00:00.000Z`),
      currency: parsed.data.currency,
      amount: new Prisma.Decimal(parsed.data.amount),
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
    select: { id: true, invoiceNumber: true },
  })
  await logAudit(session.user.id, 'JMM_SUPPLIER_INVOICE_CREATE', 'JmmSupplierInvoice', created.id, null, {
    invoiceNumber: created.invoiceNumber,
  })
  return NextResponse.json(created, { status: 201 })
}
