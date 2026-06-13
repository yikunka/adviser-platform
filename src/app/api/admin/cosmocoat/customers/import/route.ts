import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const MAX_ROWS = 2000
const NAME_HEADERS = new Set([
  '客户名称',
  '客戶名稱',
  '客户名',
  '客戶名',
  '客户',
  '客戶',
  '名称',
  '名稱',
  'name',
  'customername',
  'customer',
])

function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeHeader(value: unknown): string {
  return text(value).replace(/\s+/g, '').toLowerCase()
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function rowHasValue(row: unknown[]) {
  return row.some(cell => text(cell))
}

function findNameColumn(headerRow: unknown[]) {
  return headerRow.findIndex(cell => NAME_HEADERS.has(normalizeHeader(cell)))
}

function parseNames(rows: unknown[][]) {
  const nonEmptyRows = rows.filter(rowHasValue)
  if (nonEmptyRows.length === 0) return { names: [] as string[], skipped: 0 }

  const headerNameColumn = findNameColumn(nonEmptyRows[0])
  const hasHeader = headerNameColumn >= 0
  const seen = new Set<string>()
  const names: string[] = []
  let skipped = hasHeader ? 1 : 0

  for (const row of nonEmptyRows.slice(hasHeader ? 1 : 0)) {
    const rawName = hasHeader
      ? row[headerNameColumn]
      : row.find(cell => text(cell))
    const name = text(rawName)
    if (!name) {
      skipped += 1
      continue
    }

    const normalized = normalizeName(name)
    if (seen.has(normalized)) {
      skipped += 1
      continue
    }

    seen.add(normalized)
    names.push(name)
  }

  return { names, skipped }
}

async function nextCustomerCodeStart(tx: Prisma.TransactionClient) {
  const rows = await tx.cosCustomer.findMany({
    where: { code: { startsWith: 'KH' } },
    select: { code: true },
  })
  let max = 0
  for (const row of rows) {
    const match = row.code.match(/^KH(\d+)$/)
    if (!match) continue
    max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

function formatCustomerCode(n: number) {
  return `KH${String(n).padStart(4, '0')}`
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatCustomers' })
  if (error) return error

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) return apiError('请上传 Excel 或 CSV 文件')
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return apiError('仅支持 .xlsx、.xls 或 .csv 文件')

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return apiError('文件没有工作表')

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return apiError('无法读取工作表')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
  if (rows.length > MAX_ROWS + 1) return apiError(`单次最多导入 ${MAX_ROWS} 行客户`)

  const parsed = parseNames(rows)
  if (parsed.names.length === 0) {
    return apiError('未找到有效客户名称，请上传仅包含客户名称的表格')
  }

  try {
    let codeNumber = 1
    const created = await prisma.$transaction(async tx => {
      codeNumber = await nextCustomerCodeStart(tx)

      const records = []
      for (const name of parsed.names) {
        const customer = await tx.cosCustomer.create({
          data: {
            code: formatCustomerCode(codeNumber),
            name,
            createdById: session!.user.id,
          },
        })
        records.push(customer)
        codeNumber += 1
      }
      return records
    })

    for (const customer of created) {
      await logAudit(session!.user.id, 'CREATE', 'CosCustomer', customer.id, null, customer)
    }

    return NextResponse.json({
      imported: created.length,
      skipped: parsed.skipped,
      total: parsed.names.length + parsed.skipped,
    }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '客户表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: '客户编码冲突，请重试导入' }, { status: 409 })
    }
    throw err
  }
}
