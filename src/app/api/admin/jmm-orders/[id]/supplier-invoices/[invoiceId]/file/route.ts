import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteFromR2, getSignedDownloadUrl, uploadToR2 } from '@/lib/storage/r2'
import { readJmmUpload } from '@/lib/jmm/purchase'

type Ctx = { params: Promise<{ id: string; invoiceId: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error
  const { id, invoiceId } = await ctx.params
  const invoice = await prisma.jmmSupplierInvoice.findFirst({
    where: { id: invoiceId, orderId: id },
    select: { storageKey: true, fileName: true },
  })
  if (!invoice?.storageKey) return NextResponse.json({ error: 'No file' }, { status: 404 })
  const url = await getSignedDownloadUrl(invoice.storageKey, 900, {
    responseContentDisposition: `attachment; filename="${invoice.fileName || 'supplier-invoice'}"`,
  })
  return NextResponse.json({ url })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error
  const { id, invoiceId } = await ctx.params
  const invoice = await prisma.jmmSupplierInvoice.findFirst({
    where: { id: invoiceId, orderId: id },
    select: { id: true, storageKey: true, invoiceNumber: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file' }, { status: 400 })

  try {
    const upload = await readJmmUpload(file)
    const key = `jmm/supplier-invoices/${invoiceId}/${crypto.randomUUID()}.${upload.extension}`
    await uploadToR2(key, upload.buffer, upload.contentType)
    await prisma.jmmSupplierInvoice.update({
      where: { id: invoiceId },
      data: { storageKey: key, fileName: upload.fileName, contentType: upload.contentType },
    })
    if (invoice.storageKey) await deleteFromR2(invoice.storageKey).catch(() => undefined)
    await logAudit(session.user.id, 'JMM_SUPPLIER_INVOICE_FILE', 'JmmSupplierInvoice', invoiceId, null, {
      invoiceNumber: invoice.invoiceNumber,
      fileName: upload.fileName,
    })
    return NextResponse.json({ fileName: upload.fileName })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not upload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
