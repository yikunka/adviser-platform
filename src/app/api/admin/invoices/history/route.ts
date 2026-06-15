import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { getStoredObjectUrl, uploadToR2 } from '@/lib/storage/r2'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'historical-invoice.pdf'
}

function serializeFile(file: {
  id: string
  title: string
  fileName: string
  fileSize: number
  mimeType: string
  notes: string
  createdAt: Date
  uploadedBy?: { nameEn: string; email: string } | null
}) {
  return {
    id: file.id,
    title: file.title,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    notes: file.notes,
    createdAt: file.createdAt.toISOString(),
    uploadedBy: file.uploadedBy?.nameEn ?? file.uploadedBy?.email ?? '系统',
  }
}

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const files = await prisma.historicalInvoiceFile.findMany({
    include: { uploadedBy: { select: { nameEn: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ files: files.map(serializeFile) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return apiError('请上传历史发票 PDF 文件。')
  if (!/\.pdf$/i.test(file.name)) return apiError('仅支持 PDF 文件。')

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) return apiError('上传文件为空。')
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return apiError('文件内容不是有效 PDF。')
  }

  const fileName = safeFileName(file.name)
  const key = `invoices/history/${randomUUID()}-${fileName}`
  const contentType = file.type || 'application/pdf'
  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `inline; filename="${fileName}"`,
  })

  const title = String(formData?.get('title') ?? '').trim() || fileName.replace(/\.pdf$/i, '')
  const notes = String(formData?.get('notes') ?? '').trim()
  const record = await prisma.historicalInvoiceFile.create({
    data: {
      title,
      fileName,
      fileKey: key,
      fileUrl: getStoredObjectUrl(key),
      mimeType: contentType,
      fileSize: buffer.length,
      notes,
      uploadedById: session!.user.id,
    },
    include: { uploadedBy: { select: { nameEn: true, email: true } } },
  })

  await logAudit(session!.user.id, 'CREATE', 'HistoricalInvoiceFile', record.id, null, record)
  return NextResponse.json({
    file: serializeFile(record),
    toast: '历史发票已上传。',
  }, { status: 201 })
}
