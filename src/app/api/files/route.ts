/**
 * GET /api/files?key=<storageKey>
 *
 * Auth-gated proxy to OSS: verifies the caller owns the file, then redirects
 * to a short-lived OSS presigned URL.  The redirect approach avoids streaming
 * large files through Next.js and lets OSS serve bytes directly to the client.
 *
 * Access control:
 *   - Staff (STAFF / COMPLIANCE / SUPER_ADMIN) may fetch any key.
 *   - Clients may only fetch keys belonging to their own documents or orders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { getSignedDownloadUrl } from '@/lib/storage/r2'
import { prisma } from '@/lib/db/prisma'

const STAFF_ROLES = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  const download = req.nextUrl.searchParams.get('download') === '1'
  const filename = req.nextUrl.searchParams.get('filename')?.replace(/["\r\n]/g, '')

  if (!STAFF_ROLES.includes(session.user.role)) {
    const [doc, kycDoc, sfsStep] = await Promise.all([
      prisma.document.findFirst({ where: { storageKey: key, uploadedById: session.user.id } }),
      prisma.kYCDocument.findFirst({
        where: { storageKey: key, keyPerson: { submittedByUserId: session.user.id } },
      }),
      prisma.sfsOrderStep.findFirst({
        where: { fileKeys: { has: key }, order: { userId: session.user.id } },
      }),
    ])
    if (!doc && !kycDoc && !sfsStep) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const url = await getSignedDownloadUrl(
      key,
      900,
      download
        ? { responseContentDisposition: `attachment${filename ? `; filename="${filename}"` : ''}` }
        : undefined,
    )
    return NextResponse.redirect(url, { status: 302 })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
