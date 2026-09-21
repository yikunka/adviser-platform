import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const schema = z.object({
  reference: z.string().trim().max(80).optional().default(''),
  shipper: z.string().trim().max(200).optional().default(''),
  consignee: z.string().trim().max(200).optional().default(''),
  carrier: z.string().trim().max(120).optional().default(''),
  incoterm: z.string().trim().max(40).optional().default(''),
  portOfLoading: z.string().trim().max(120).optional().default(''),
  portOfDischarge: z.string().trim().max(120).optional().default(''),
  etd: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().default(''),
  eta: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
})

function dateOrNull(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

type Ctx = { params: Promise<{ id: string; invoiceId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId } = await ctx.params
  const invoice = await prisma.jmmSupplierInvoice.findFirst({ where: { id: invoiceId, orderId: id }, select: { id: true, invoiceNumber: true } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid shipment' }, { status: 400 })
  const shipment = await prisma.jmmShipment.create({
    data: {
      invoiceId,
      reference: parsed.data.reference,
      shipper: parsed.data.shipper,
      consignee: parsed.data.consignee,
      carrier: parsed.data.carrier,
      incoterm: parsed.data.incoterm,
      portOfLoading: parsed.data.portOfLoading,
      portOfDischarge: parsed.data.portOfDischarge,
      etd: dateOrNull(parsed.data.etd),
      eta: dateOrNull(parsed.data.eta),
      notes: parsed.data.notes,
    },
    select: { id: true },
  })
  await logAudit(session.user.id, 'JMM_SHIPMENT_CREATE', 'JmmShipment', shipment.id, null, { invoiceNumber: invoice.invoiceNumber })
  return NextResponse.json(shipment, { status: 201 })
}
