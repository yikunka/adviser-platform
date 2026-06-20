import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import { contentDispositionHeader } from '@/lib/http/content-disposition'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 8 * 1024 * 1024

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function resolveContentType(file: File): string | null {
  if (ALLOWED_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }
  return byExt[ext] ?? null
}

function fileUrl(storageKey: string) {
  return `/api/files?key=${encodeURIComponent(storageKey)}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params

  try {
    const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId }, select: { id: true } })
    if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const contentType = resolveContentType(file)
  if (!contentType || !ALLOWED_TYPES[contentType]) {
    return NextResponse.json({ error: 'Only JPG, PNG, and WEBP images are allowed.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 8MB.' }, { status: 400 })
  }

  const ext = ALLOWED_TYPES[contentType]
  const key = `cosmocoat/process-kits/${kitId}/test-reports/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(key, buffer, contentType, {
    contentDisposition: contentDispositionHeader('inline', file.name),
    cacheControl: 'private, max-age=0, no-cache',
  })

  return NextResponse.json({
    reportLink: key,
    imageUrl: fileUrl(key),
    key,
  }, { status: 201 })
}
