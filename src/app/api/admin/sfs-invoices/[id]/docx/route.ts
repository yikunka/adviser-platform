import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { renderSfsInvoiceDocx, sfsInvoiceDocxFilename } from '@/lib/sfs-invoice/sfs-invoice-docx'

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

  const buffer = await renderSfsInvoiceDocx(invoice)
  const fileName = sfsInvoiceDocxFilename(invoice)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': contentDispositionHeader('attachment', fileName),
      'Cache-Control': 'private, no-store',
    },
  })
}
