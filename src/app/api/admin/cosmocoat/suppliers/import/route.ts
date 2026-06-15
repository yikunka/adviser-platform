import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { generateSupplierCodeForTx } from '@/lib/cosmocoat/suppliers'

const MAX_ROWS = 2000
const NAME_HEADERS = new Set([
  '供应商名称',
  '供應商名稱',
  '供应商名',
  '供應商名',
  '供应商',
  '供應商',
  '名称',
  '名稱',
  'name',
  'suppliername',
  'supplier',
])

const CODE_HEADERS = new Set([
  '供应商编码',
  '供應商編碼',
  '供应商代码',
  '供應商代碼',
  '编码',
  '編碼',
  '代码',
  '代碼',
  'code',
  'suppliercode',
])

const CONTACT_HEADERS = new Set([
  '联系方式',
  '聯繫方式',
  '联系人',
  '聯繫人',
  '联系信息',
  '聯繫信息',
  '电话',
  '電話',
  'phone',
  'mobile',
  'contact',
  'contactinfo',
])

const ADDRESS_HEADERS = new Set([
  '地址',
  'address',
])

type ParsedSupplierRow = {
  code: string
  name: string
  contactInfo: string | null
  address: string | null
}

function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function nullableText(value: unknown) {
  const trimmed = text(value)
  return trimmed ? trimmed : null
}

function normalizeHeader(value: unknown): string {
  return text(value).replace(/\s+/g, '').toLowerCase()
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeCode(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

function rowHasValue(row: unknown[]) {
  return row.some(cell => text(cell))
}

function findColumn(headerRow: unknown[], headers: Set<string>) {
  return headerRow.findIndex(cell => headers.has(normalizeHeader(cell)))
}

function parseSuppliers(rows: unknown[][]) {
  const nonEmptyRows = rows.filter(rowHasValue)
  if (nonEmptyRows.length === 0) return { suppliers: [] as ParsedSupplierRow[], skipped: 0 }

  const headerRow = nonEmptyRows[0]
  const nameColumn = findColumn(headerRow, NAME_HEADERS)
  const hasHeader = nameColumn >= 0
  const codeColumn = hasHeader ? findColumn(headerRow, CODE_HEADERS) : -1
  const contactColumn = hasHeader ? findColumn(headerRow, CONTACT_HEADERS) : -1
  const addressColumn = hasHeader ? findColumn(headerRow, ADDRESS_HEADERS) : -1

  const seenNames = new Set<string>()
  const seenCodes = new Set<string>()
  const suppliers: ParsedSupplierRow[] = []
  let skipped = hasHeader ? 1 : 0

  for (const row of nonEmptyRows.slice(hasHeader ? 1 : 0)) {
    const rawName = hasHeader ? row[nameColumn] : row.find(cell => text(cell))
    const name = text(rawName)
    if (!name) {
      skipped += 1
      continue
    }

    const normalizedName = normalizeName(name)
    const code = codeColumn >= 0 ? text(row[codeColumn]) : ''
    const normalizedCode = code ? normalizeCode(code) : ''

    if (seenNames.has(normalizedName) || (normalizedCode && seenCodes.has(normalizedCode))) {
      skipped += 1
      continue
    }

    seenNames.add(normalizedName)
    if (normalizedCode) seenCodes.add(normalizedCode)

    suppliers.push({
      code: normalizedCode,
      name,
      contactInfo: contactColumn >= 0 ? nullableText(row[contactColumn]) : null,
      address: addressColumn >= 0 ? nullableText(row[addressColumn]) : null,
    })
  }

  return { suppliers, skipped }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
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
  if (rows.length > MAX_ROWS + 1) return apiError(`单次最多导入 ${MAX_ROWS} 行供应商`)

  const parsed = parseSuppliers(rows)
  if (parsed.suppliers.length === 0) {
    return apiError('未找到有效供应商名称，请至少提供“供应商名称”列或仅包含名称的单列表格')
  }

  try {
    const created = await prisma.$transaction(async tx => {
      const existingCodes = new Set(
        (await tx.cosSupplier.findMany({ select: { code: true } })).map(item => item.code.toUpperCase()),
      )
      const existingNames = new Set(
        (await tx.cosSupplier.findMany({ select: { name: true } })).map(item => normalizeName(item.name)),
      )

      const createdRecords = []
      let skippedExisting = 0

      for (const row of parsed.suppliers) {
        if (existingNames.has(normalizeName(row.name)) || (row.code && existingCodes.has(row.code))) {
          skippedExisting += 1
          continue
        }

        const code = row.code || await generateSupplierCodeForTx(tx, existingCodes)
        existingCodes.add(code)
        existingNames.add(normalizeName(row.name))

        const supplier = await tx.cosSupplier.create({
          data: {
            code,
            name: row.name,
            contactInfo: row.contactInfo,
            address: row.address,
            createdById: session!.user.id,
          },
        })
        createdRecords.push(supplier)
      }

      return { createdRecords, skippedExisting }
    })

    for (const supplier of created.createdRecords) {
      await logAudit(session!.user.id, 'CREATE', 'CosSupplier', supplier.id, null, supplier)
    }

    return NextResponse.json({
      imported: created.createdRecords.length,
      skipped: parsed.skipped + created.skippedExisting,
      total: parsed.suppliers.length + parsed.skipped,
    }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '供应商表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: '供应商编码冲突，请重试导入' }, { status: 409 })
    }
    throw err
  }
}
