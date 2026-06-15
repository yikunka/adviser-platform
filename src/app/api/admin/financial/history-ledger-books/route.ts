import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { guardFinancialCompany, guardFinancialMutationCompany } from '@/lib/financial/api-guard'
import { getStoredObjectUrl, uploadToR2 } from '@/lib/storage/r2'

type SheetPreview = {
  name: string
  rowCount: number
  columnCount: number
  headers: string[]
  previewRows: string[][]
}

type HistoryLedgerBookRecord = {
  id: string
  title: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  sheets: unknown
  notes: string
  createdAt: Date
  uploadedBy?: { nameEn: string; email: string } | null
}

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'history-ledger-book.xlsx'
}

function workbookPreview(buffer: Buffer): SheetPreview[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  return workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const rows = sheet
      ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false })
      : []
    const stringRows = rows.map(row => row.map(cell => String(cell ?? '').trim()))
    const columnCount = stringRows.reduce((max, row) => Math.max(max, row.length), 0)
    return {
      name: sheetName,
      rowCount: stringRows.length,
      columnCount,
      headers: (stringRows[0] ?? []).slice(0, 12),
      previewRows: stringRows.slice(1, 6).map(row => row.slice(0, 12)),
    }
  })
}

function serializeBook(book: HistoryLedgerBookRecord) {
  return {
    id: book.id,
    title: book.title,
    fileName: book.fileName,
    fileUrl: book.fileUrl,
    fileSize: book.fileSize,
    mimeType: book.mimeType,
    sheets: book.sheets,
    notes: book.notes,
    createdAt: book.createdAt.toISOString(),
    uploadedBy: book.uploadedBy?.nameEn ?? book.uploadedBy?.email ?? '系统',
  }
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const books = await prisma.financialHistoryLedgerBook.findMany({
    where: { companyId: companyId! },
    include: { uploadedBy: { select: { nameEn: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ books: books.map(serializeBook) })
}

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  const companyId = String(formData?.get('companyId') ?? '').trim()
  const guard = await guardFinancialMutationCompany(companyId, { requireManager: true })
  if (guard.error) return guard.error

  const file = formData?.get('file')
  if (!(file instanceof File)) return apiError('请上传历史账套 Excel 文件。')
  if (!/\.(xlsx|xls)$/i.test(file.name)) return apiError('仅支持 .xlsx 或 .xls 文件。')

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) return apiError('上传文件为空。')

  let sheets: SheetPreview[]
  try {
    sheets = workbookPreview(buffer)
  } catch {
    return apiError('Excel 文件无法读取，请检查文件格式。')
  }
  if (sheets.length === 0) return apiError('Excel 文件没有可读取的工作表。')

  const fileName = safeFileName(file.name)
  const key = `financial/history-ledger-books/${companyId}/${randomUUID()}-${fileName}`
  const contentType = file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  await uploadToR2(key, buffer, contentType, {
    contentDisposition: `attachment; filename="${fileName}"`,
  })

  const title = String(formData?.get('title') ?? '').trim() || fileName.replace(/\.(xlsx|xls)$/i, '')
  const notes = String(formData?.get('notes') ?? '').trim()
  const book = await prisma.financialHistoryLedgerBook.create({
    data: {
      companyId,
      title,
      fileName,
      fileKey: key,
      fileUrl: getStoredObjectUrl(key),
      mimeType: contentType,
      fileSize: buffer.length,
      sheets,
      notes,
      uploadedById: guard.session.user.id,
    },
    include: { uploadedBy: { select: { nameEn: true, email: true } } },
  })

  return NextResponse.json({
    book: serializeBook(book),
    toast: '历史账套已上传，仅保存为查看与下载档案。',
  }, { status: 201 })
}
