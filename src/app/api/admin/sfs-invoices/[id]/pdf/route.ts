import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
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

  try {
    const bytes = await renderSfsInvoicePdf(invoice)
    const filename = sfsInvoicePdfFilename(invoice)
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionHeader('attachment', filename),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[sfs-invoices/pdf]', err)
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
