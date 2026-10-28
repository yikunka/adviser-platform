import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getSfsAccountAccess, sfsApprovalForbiddenResponse } from '@/lib/sfs/account-approval'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { renderSfsInvoicePdf, sfsInvoicePdfFilename } from '@/lib/sfs-invoice/sfs-invoice-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return sfsApprovalForbiddenResponse(access.status)

  const { id } = await params
  const invoice = await prisma.sfsInvoice.findFirst({
    where: {
      id,
      status: { in: ['SENT', 'PAID'] },
      order: { userId: session.user.id },
    },
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
    console.error('[sfsdiamond/invoices/pdf]', err)
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
