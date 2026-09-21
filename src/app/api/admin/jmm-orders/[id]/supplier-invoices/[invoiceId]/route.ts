import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteFromR2 } from '@/lib/storage/r2'
import { JMM_CURRENCIES } from '@/lib/jmm/orders'
import { JMM_SUPPLIER_INVOICE_STATUSES } from '@/lib/jmm/purchase'

const updateSchema = z.object({
  supplierId: z.string().trim().min(1),
  invoiceNumber: z.string().trim().min(1).max(80),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(JMM_CURRENCIES),
  amount: z.number().min(0).max(1_000_000_000),
  status: z.enum(JMM_SUPPLIER_INVOICE_STATUSES),
  notes: z.string().trim().max(2000).optional().default(''),
})

type Ctx = { params: Promise<{ id: string; invoiceId: string }> }

async function loadInvoice(orderId: string, invoiceId: string) {
  return prisma.jmmSupplierInvoice.findFirst({
    where: { id: invoiceId, orderId },
    include: { shipments: { include: { files: true } } },
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId } = await ctx.params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid supplier invoice' }, { status: 400 })
  const invoice = await loadInvoice(id, invoiceId)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supplier = await prisma.jmmSupplier.findUnique({ where: { id: parsed.data.supplierId }, select: { id: true } })
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 400 })

  await prisma.jmmSupplierInvoice.update({
    where: { id: invoiceId },
    data: {
      supplierId: parsed.data.supplierId,
      invoiceNumber: parsed.data.invoiceNumber,
      invoiceDate: new Date(`${parsed.data.invoiceDate}T00:00:00.000Z`),
      currency: parsed.data.currency,
      amount: new Prisma.Decimal(parsed.data.amount),
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
  })
  await logAudit(session.user.id, 'JMM_SUPPLIER_INVOICE_UPDATE', 'JmmSupplierInvoice', invoiceId, {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
  }, {
    invoiceNumber: parsed.data.invoiceNumber,
    status: parsed.data.status,
  })
  return NextResponse.json({ id: invoiceId })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId } = await ctx.params
  const invoice = await loadInvoice(id, invoiceId)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const keys = [
    invoice.storageKey,
    ...invoice.shipments.flatMap(shipment => shipment.files.map(file => file.storageKey)),
  ].filter(Boolean)
  await prisma.jmmSupplierInvoice.delete({ where: { id: invoiceId } })
  await Promise.all(keys.map(key => deleteFromR2(key).catch(() => undefined)))
  await logAudit(session.user.id, 'JMM_SUPPLIER_INVOICE_DELETE', 'JmmSupplierInvoice', invoiceId, {
    invoiceNumber: invoice.invoiceNumber,
  }, null)
  return NextResponse.json({ ok: true })
}
