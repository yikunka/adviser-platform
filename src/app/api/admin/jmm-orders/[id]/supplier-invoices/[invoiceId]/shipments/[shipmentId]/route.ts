import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteFromR2 } from '@/lib/storage/r2'

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

type Ctx = { params: Promise<{ id: string; invoiceId: string; shipmentId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId, shipmentId } = await ctx.params
  const shipment = await prisma.jmmShipment.findFirst({ where: { id: shipmentId, invoiceId, invoice: { orderId: id } } })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid shipment' }, { status: 400 })
  await prisma.jmmShipment.update({
    where: { id: shipmentId },
    data: {
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
  })
  return NextResponse.json({ id: shipmentId })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId, shipmentId } = await ctx.params
  const shipment = await prisma.jmmShipment.findFirst({
    where: { id: shipmentId, invoiceId, invoice: { orderId: id } },
    include: { files: true },
  })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.jmmShipment.delete({ where: { id: shipmentId } })
  await Promise.all(shipment.files.map(file => deleteFromR2(file.storageKey).catch(() => undefined)))
  await logAudit(session.user.id, 'JMM_SHIPMENT_DELETE', 'JmmShipment', shipmentId, { reference: shipment.reference }, null)
  return NextResponse.json({ ok: true })
}
