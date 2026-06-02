import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/lib/feedback/adapter'
import { uploadToR2, getSignedDownloadUrl, isLocalStorageEnabled } from '@/lib/storage/r2'

// ─────────────────────────────────────────────
// Feedback Plugin — Attachment Upload
// POST /api/feedback/upload
// ─────────────────────────────────────────────

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
// 30 days — long enough for an agent to be assigned and work the ticket
const SIGNED_URL_EXPIRY = 30 * 24 * 3600

function resolveContentType(file: File): string | null {
  if (ALLOWED_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  }
  const resolved = byExt[ext]
  return resolved && ALLOWED_TYPES[resolved] ? resolved : null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: '未提供文件' }, { status: 400 })
  }

  const contentType = resolveContentType(file)
  if (!contentType) {
    return NextResponse.json(
      { error: '不支持的文件格式。支持图片 (JPG/PNG/GIF/WEBP)、PDF、Word、TXT' },
      { status: 400 },
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件过大，最大支持 10MB' }, { status: 400 })
  }

  const ext = ALLOWED_TYPES[contentType]
  const key = `feedback/attachments/${session.user.id}/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `inline; filename="${file.name}"`,
    cacheControl: 'public, max-age=2592000', // 30 days
  })

  // Local storage: permanent URL via /api/files; OSS: long-lived signed URL
  const url = isLocalStorageEnabled()
    ? `${getAppBaseUrl()}/api/files?key=${encodeURIComponent(key)}`
    : await getSignedDownloadUrl(key, SIGNED_URL_EXPIRY)

  return NextResponse.json({
    url,
    name: file.name,
    type: contentType,
    key,
  })
}

function getAppBaseUrl(): string {
  return (
    process.env['NEXT_PUBLIC_APP_URL'] ??
    process.env['AUTH_URL'] ??
    process.env['NEXTAUTH_URL'] ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
}
