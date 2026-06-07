import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireRole } from '@/lib/auth/rbac'
import { ossImg } from '@/lib/oss-img'
import { getSignedDownloadUrl, isLocalStorageEnabled, uploadToR2 } from '@/lib/storage/r2'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}
const MAX_SIZE = 8 * 1024 * 1024
const SIGNED_URL_EXPIRY = 30 * 24 * 3600

function resolveContentType(file: File): string | null {
  if (ALLOWED_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
  }
  return byExt[ext] ?? null
}

function permanentImageUrl(key: string) {
  if (isLocalStorageEnabled()) {
    const base = (
      process.env['NEXT_PUBLIC_APP_URL']
      ?? process.env['AUTH_URL']
      ?? process.env['NEXTAUTH_URL']
      ?? 'http://localhost:3000'
    ).replace(/\/$/, '')
    return `${base}/api/files?key=${encodeURIComponent(key)}`
  }

  const cdn = (
    process.env['NEXT_PUBLIC_OSS_CDN_URL']
    ?? process.env['OSS_CDN_URL']
    ?? ''
  ).trim().replace(/\/$/, '')
  if (cdn) return `${cdn}/${key}`
  return null
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const contentType = resolveContentType(file)
  if (!contentType || !ALLOWED_TYPES[contentType]) {
    return NextResponse.json({ error: 'Only JPG, PNG, WEBP, GIF, HEIC, and HEIF images are allowed.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 8MB.' }, { status: 400 })
  }

  const ext = ALLOWED_TYPES[contentType]
  const key = `cosmocoat/sample-orders/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `inline; filename="${file.name.replace(/"/g, '')}"`,
    cacheControl: 'public, max-age=31536000, immutable',
  })

  const imagePath = `/${key}`
  const permanentUrl = permanentImageUrl(key)
  const imageUrl = permanentUrl ?? await getSignedDownloadUrl(key, SIGNED_URL_EXPIRY)

  return NextResponse.json({
    imageUrl,
    imagePath,
    thumbnailUrl: ossImg(imagePath, { w: 120, h: 120, mode: 'fill' }),
    key,
  }, { status: 201 })
}
