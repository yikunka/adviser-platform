import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getSignedDownloadUrl, isLocalStorageEnabled } from '@/lib/storage/r2'
import { contentDispositionHeader } from '@/lib/http/content-disposition'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatEmployees' })
  if (error) return error

  const { id, fileId } = await params
  const file = await prisma.cosEmployeeFile.findFirst({
    where: { id: fileId, employeeId: id },
    select: { storageKey: true, fileName: true },
  })
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const url = await getSignedDownloadUrl(file.storageKey, 900, {
    responseContentDisposition: contentDispositionHeader('inline', file.fileName),
  })

  return NextResponse.json({
    url,
    isPublicPreviewUrl: !isLocalStorageEnabled(),
  })
}
