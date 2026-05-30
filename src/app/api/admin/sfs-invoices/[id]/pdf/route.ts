import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { renderSfsInvoicePdf, sfsInvoicePdfFilename } from '@/lib/sfs-invoice/sfs-invoice-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const { id } = await params
  const invoice = await prisma.sfsInvoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      order: { select: { memorialName: true, sampleCode: true, clientName: true } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bytes = await renderSfsInvoicePdf(invoice)
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const filename = sfsInvoicePdfFilename(invoice)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
