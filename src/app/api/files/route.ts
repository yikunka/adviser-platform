/**
 * GET /api/files?key=<storageKey>
 *
 * Serves a file from local disk.  This route replaces the R2 signed-URL
 * redirect during the local-storage phase.  When storage is migrated to R2,
 * this route becomes redundant — downloads will redirect to signed R2 URLs
 * instead.
 *
 * Access control: the caller must be authenticated.  Staff may fetch any
 * file; clients may only fetch files whose storageKey belongs to a document
 * they own (via Document or KYCDocument).
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { auth } from '@/lib/auth/auth'
import { readLocalFile } from '@/lib/storage/r2'
import { prisma } from '@/lib/db/prisma'

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

const STAFF_ROLES = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  // Access control for non-staff users
  if (!STAFF_ROLES.includes(session.user.role)) {
    const [doc, kycDoc] = await Promise.all([
      prisma.document.findFirst({ where: { storageKey: key, uploadedById: session.user.id } }),
      prisma.kYCDocument.findFirst({
        where: { storageKey: key, keyPerson: { submittedByUserId: session.user.id } },
      }),
    ])
    if (!doc && !kycDoc) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const { buffer } = await readLocalFile(key)
    const ext = path.extname(key).slice(1).toLowerCase()
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream'
    const fileName = path.basename(key)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
