import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import { JMM_SHIPMENT_DOC_KINDS, readJmmUpload } from '@/lib/jmm/purchase'

type Ctx = { params: Promise<{ id: string; invoiceId: string; shipmentId: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId, shipmentId } = await ctx.params
  const shipment = await prisma.jmmShipment.findFirst({
    where: { id: shipmentId, invoiceId, invoice: { orderId: id } },
    select: { id: true },
  })
  if (!shipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = z.enum(JMM_SHIPMENT_DOC_KINDS).safeParse(form?.get('kind'))
  if (!(file instanceof File) || !kind.success) {
    return NextResponse.json({ error: 'Choose a file and a document type' }, { status: 400 })
  }

  try {
    const upload = await readJmmUpload(file)
    const key = `jmm/shipments/${shipmentId}/${crypto.randomUUID()}.${upload.extension}`
    await uploadToR2(key, upload.buffer, upload.contentType)
    const saved = await prisma.jmmShipmentFile.create({
      data: {
        shipmentId,
        kind: kind.data,
        fileName: upload.fileName,
        storageKey: key,
        contentType: upload.contentType,
      },
      select: { id: true },
    })
    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not upload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
