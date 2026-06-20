import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const notes = String(body?.notes ?? '').trim()
  if (notes.length > 1000) return apiError('备注不能超过 1000 个字符。')

  const existing = await prisma.historicalInvoiceFile.findUnique({ where: { id } })
  if (!existing) return apiError('历史发票不存在。', 404)

  const record = await prisma.historicalInvoiceFile.update({
    where: { id },
    data: { notes },
    include: { uploadedBy: { select: { nameEn: true, email: true } } },
  })

  await logAudit(session!.user.id, 'UPDATE', 'HistoricalInvoiceFile', record.id, existing, record)

  return NextResponse.json({
    file: serializeFile(record),
    toast: '历史发票备注已更新。',
  })
}
