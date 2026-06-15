import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { guardFinancialCompany } from '@/lib/financial/api-guard'
import { getSignedDownloadUrl } from '@/lib/storage/r2'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const book = await prisma.financialHistoryLedgerBook.findUnique({
    where: { id },
    select: { companyId: true, fileKey: true, fileName: true },
  })
  if (!book) return apiError('历史账套不存在。', 404)

  const guard = await guardFinancialCompany(book.companyId)
  if (guard.error) return guard.error

  const url = await getSignedDownloadUrl(
    book.fileKey,
    900,
    { responseContentDisposition: `attachment; filename="${book.fileName}"` },
  )

  return NextResponse.json({ url })
}
