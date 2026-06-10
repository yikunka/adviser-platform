import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { reportFingerprint, renderSfsOrderReportPdf, reportFilename } from '@/lib/sfs/sfs-order-report-pdf'
import {
  getSignedDownloadUrl,
  headObjectMeta,
  uploadToR2,
} from '@/lib/storage/r2'

const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

const REPORT_META_FP = 'report-fp'

function reportObjectKey(orderId: string): string {
  return `sfs-order-reports/${orderId}.pdf`
}

/** Safe Content-Disposition for ASCII filenames (pdf-lib `safe()` output). */
function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
  return `attachment; filename="${ascii}"`
}

function fingerprintFromHead(metadata: Record<string, string>): string | undefined {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(metadata)) {
    lower[k.toLowerCase()] = v
  }
  return lower[REPORT_META_FP.toLowerCase()]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const isAdmin = ADMIN_ROLES.has(session.user.role)

  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }],
        include: { attachments: { orderBy: { createdAt: 'asc' } } },
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Report is only available for completed orders' }, { status: 403 })
  }

  const fp = reportFingerprint(order)
  const key = reportObjectKey(order.id)
  const disposition = attachmentDisposition(reportFilename(order))

  const existing = await headObjectMeta(key)
  if (existing && fingerprintFromHead(existing.metadata) === fp) {
    const url = await getSignedDownloadUrl(key, 900, {
      responseContentDisposition: disposition,
    })
    return NextResponse.redirect(url)
  }

  const { bytes } = await renderSfsOrderReportPdf(order)

  await uploadToR2(key, bytes, 'application/pdf', {
    metadata: { [REPORT_META_FP]: fp },
    contentDisposition: disposition,
    cacheControl: 'private, max-age=86400',
  })

  const url = await getSignedDownloadUrl(key, 900, {
    responseContentDisposition: disposition,
  })
  return NextResponse.redirect(url)
}
