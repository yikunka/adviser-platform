import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getSignedDownloadUrl } from '@/lib/storage/r2'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const { id } = await params
  const file = await prisma.historicalInvoiceFile.findUnique({
    where: { id },
    select: { fileKey: true, fileName: true },
  })
  if (!file) return apiError('历史发票不存在。', 404)

  const url = await getSignedDownloadUrl(
    file.fileKey,
    900,
    { responseContentDisposition: `attachment; filename="${file.fileName}"` },
  )

  return NextResponse.json({ url })
}
