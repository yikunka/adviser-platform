/**
 * GET /api/files?key=<storageKey>
 *
 * Local dev: streams the file from LOCAL_UPLOADS_DIR (default ./uploads).
 * Production: redirects to a short-lived OSS presigned URL.
 * Falls back to the other backend when the primary miss (mixed migration).
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { auth } from '@/lib/auth/auth'
import {
  getOssPresignedDownloadUrl,
  headObjectMeta,
  isLocalStorageEnabled,
  isOssConfigured,
  readLocalFile,
} from '@/lib/storage/r2'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader, sanitizeDownloadFileName } from '@/lib/http/content-disposition'

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const STAFF_ROLES = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']

async function authorizeKey(
  key: string,
  userId: string,
  role: string,
  email: string,
): Promise<boolean> {
  if (STAFF_ROLES.includes(role)) return true

  const emailNorm = email.toLowerCase()
  const [doc, kycDoc, sfsAttachment, sfsDesign] = await Promise.all([
    prisma.document.findFirst({
      where: {
        storageKey: key,
        OR: [
          { uploadedById: userId },
          { company: { clientUserId: userId } },
          { company: { pendingClientEmail: emailNorm } },
        ],
      },
    }),
    prisma.kYCDocument.findFirst({
      where: { storageKey: key, keyPerson: { submittedByUserId: userId } },
    }),
    prisma.sfsOrderStepAttachment.findFirst({
      where: { fileKey: key, step: { order: { userId } } },
      select: { reviewStatus: true },
    }),
    prisma.sfsOrderDesignAttachment.findFirst({
      where: {
        storageKey: key,
        OR: [
          { order: { userId } },
          { order: { email: { equals: emailNorm, mode: 'insensitive' } } },
        ],
      },
      select: { id: true },
    }),
  ])

  if (sfsAttachment) return sfsAttachment.reviewStatus === 'APPROVED'
  if (sfsDesign) return true

  const sfsStep = await prisma.sfsOrderStep.findFirst({
    where: { fileKeys: { has: key }, order: { userId } },
  })

  return Boolean(doc || kycDoc || sfsStep)
}

function localFileResponse(
  key: string,
  buffer: Buffer,
  download: boolean,
  filename: string | undefined,
) {
  const ext = path.extname(key).slice(1).toLowerCase()
  const contentType = MIME_MAP[ext] ?? 'application/octet-stream'
  const fileName = filename || path.basename(key)
  const disposition = download ? 'attachment' : 'inline'

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDispositionHeader(disposition, fileName),
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, no-store',
    },
  })
}

async function redirectToOss(
  key: string,
  download: boolean,
  filename: string | undefined,
) {
  const url = await getOssPresignedDownloadUrl(
    key,
    900,
    download
      ? { responseContentDisposition: contentDispositionHeader('attachment', filename) }
      : { responseContentDisposition: contentDispositionHeader('inline', filename || path.basename(key)) },
  )
  return NextResponse.redirect(url, { status: 302 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const allowed = await authorizeKey(key, session.user.id, session.user.role, session.user.email)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const download = req.nextUrl.searchParams.get('download') === '1'
  const filename = sanitizeDownloadFileName(req.nextUrl.searchParams.get('filename'))

  const tryLocal = async () => {
    const { buffer } = await readLocalFile(key)
    return localFileResponse(key, buffer, download, filename)
  }

  const tryOss = async () => {
    if (!isOssConfigured()) return null
    const meta = await headObjectMeta(key)
    if (!meta) return null
    return redirectToOss(key, download, filename)
  }

  try {
    if (isLocalStorageEnabled()) {
      try {
        return await tryLocal()
      } catch {
        const ossRes = await tryOss()
        if (ossRes) return ossRes
      }
    } else {
      const ossRes = await tryOss()
      if (ossRes) return ossRes
      try {
        return await tryLocal()
      } catch {
        // fall through
      }
    }
  } catch (error) {
    console.error('[api/files] fetch failed:', key, error)
  }

  return NextResponse.json({ error: 'File not found' }, { status: 404 })
}
