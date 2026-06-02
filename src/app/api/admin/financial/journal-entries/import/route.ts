import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { generateVoucherNo, parseYmdDate, periodFromDate, validateBalance } from '@/lib/financial/utils'

type ParsedLine = {
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
  rowNumber: number
}

type ImportFormat = 'codeLine' | 'nameLine' | 'pair'

type AccountRecord = { id: string; code: string; name: string }

type AccountNameLookup = Map<string, AccountRecord | 'ambiguous'>

type ParsedEntry = {
  sourceVoucherNo: string
  entryDate: string
  description: string
  lines: ParsedLine[]
  rowNumbers: number[]
}

type ImportError = {
  row: number
  message: string
}

type AccountLookup = Map<string, { id: string; code: string }>

const MAX_ROWS = 2000

const HEADER_ALIASES: Record<string, string[]> = {
  voucherNo: ['voucher no', 'voucher number', 'voucherno', 'entry no', 'entry number', 'journal no', 'journal number', 'reference', 'ref', '凭证号', '憑證號', '分录号', '分錄號'],
  entryDate: ['date', 'entry date', 'journal date', 'posting date', '日期', '凭证日期', '憑證日期', '记账日期', '記賬日期'],
  description: ['description', 'entry description', 'memo', 'narration', '摘要', '描述', '说明', '說明'],
  accountCode: ['account code', 'account no', 'account number', '科目编码', '科目編碼', '科目代码', '科目代碼'],
  accountName: ['account name', 'account', '会计科目名称', '會計科目名稱', '科目名称', '科目名稱', '科目'],
  particular: ['particular', '凭证描述', '憑證描述'],
  lineDescription: ['line description', 'line memo', 'line narration', '明细摘要', '明細摘要', '分录摘要', '分錄摘要'],
  debit: ['debit', 'debit amount', 'dr', '借方', '借方金额', '借方金額'],
  credit: ['credit', 'credit amount', 'cr', '贷方', '貸方', '贷方金额', '貸方金額'],
  debitAccountCode: ['debit account code', 'debit account', 'dr account', '借方科目编码', '借方科目編碼', '借方科目'],
  creditAccountCode: ['credit account code', 'credit account', 'cr account', '贷方科目编码', '貸方科目編碼', '贷方科目', '貸方科目'],
  amount: ['amount', '金额', '金額'],
}

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[：:]/g, '')
    .replace(/\s+/g, ' ')
}

function headerHasField(normalized: string[], aliases: string[]) {
  const candidates = aliases.map(normalizeHeader)
  return normalized.some(header => candidates.includes(header))
}

function buildHeaderMap(headers: unknown[]) {
  const normalized = headers.map(normalizeHeader)
  const map = new Map<string, number>()
  const useNameLineFormat = headerHasField(normalized, HEADER_ALIASES.particular)

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (field === 'accountCode' && useNameLineFormat) continue
    if (field === 'accountName' && !useNameLineFormat) continue
    if (field === 'particular' && !useNameLineFormat) continue
    const fieldAliases = field === 'accountCode' && !useNameLineFormat
      ? [...aliases, 'account']
      : aliases
    const candidates = fieldAliases.map(normalizeHeader)
    const index = normalized.findIndex(header => candidates.includes(header))
    if (index >= 0) map.set(field, index)
  }

  return map
}

function detectImportFormat(headerMap: Map<string, number>): ImportFormat | null {
  const hasPairFormat = headerMap.has('debitAccountCode')
    && headerMap.has('creditAccountCode')
    && headerMap.has('amount')
  const hasNameLineFormat = headerMap.has('entryDate')
    && headerMap.has('particular')
    && headerMap.has('accountName')
    && headerMap.has('debit')
    && headerMap.has('credit')
  const hasCodeLineFormat = headerMap.has('entryDate')
    && headerMap.has('description')
    && headerMap.has('accountCode')
    && headerMap.has('debit')
    && headerMap.has('credit')

  if (hasPairFormat) return 'pair'
  if (hasNameLineFormat) return 'nameLine'
  if (hasCodeLineFormat) return 'codeLine'
  return null
}

function buildAccountNameLookup(accounts: AccountRecord[]): AccountNameLookup {
  const lookup: AccountNameLookup = new Map()
  for (const account of accounts) {
    const key = account.name.trim()
    const existing = lookup.get(key)
    if (existing === 'ambiguous') continue
    if (existing) lookup.set(key, 'ambiguous')
    else lookup.set(key, account)
  }
  return lookup
}

function resolveAccountId(
  line: ParsedLine,
  accountsByCode: AccountLookup,
  accountsByName: AccountNameLookup,
) {
  if (line.accountName) {
    const match = accountsByName.get(line.accountName.trim())
    return match && match !== 'ambiguous' ? match.id : null
  }
  return accountsByCode.get(line.accountCode)?.id ?? null
}

function cell(row: unknown[], headerMap: Map<string, number>, field: string) {
  const index = headerMap.get(field)
  return index === undefined ? '' : row[index]
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function amount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '')
    .replace(/^\((.*)\)$/, '-$1')
  if (!normalized) return 0
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

function dateToYmd(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return [
      parsed.y,
      String(parsed.m).padStart(2, '0'),
      String(parsed.d).padStart(2, '0'),
    ].join('-')
  }

  const raw = text(value)
  if (!raw) return ''
  const normalized = raw.replace(/[./]/g, '-')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    ?? normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (!match) return ''
  if (match[1]!.length === 4) {
    return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`
  }
  return `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`
}

function rowHasValue(row: unknown[]) {
  return row.some(value => text(value) !== '')
}

function getLineFormat(row: unknown[], headerMap: Map<string, number>, rowNumber: number): ParsedEntry | ImportError {
  const entryDate = dateToYmd(cell(row, headerMap, 'entryDate'))
  const description = text(cell(row, headerMap, 'description'))
  const accountCode = text(cell(row, headerMap, 'accountCode'))
  const debit = amount(cell(row, headerMap, 'debit'))
  const credit = amount(cell(row, headerMap, 'credit'))

  if (!entryDate) return { row: rowNumber, message: 'Date is required and must be YYYY-MM-DD.' }
  if (!description) return { row: rowNumber, message: 'Description is required.' }
  if (!accountCode) return { row: rowNumber, message: 'Account Code is required.' }
  if (!Number.isFinite(debit) || !Number.isFinite(credit)) return { row: rowNumber, message: 'Debit/Credit must be numeric.' }
  if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
    return { row: rowNumber, message: 'Each line must have either debit or credit, but not both.' }
  }

  return {
    sourceVoucherNo: text(cell(row, headerMap, 'voucherNo')),
    entryDate,
    description,
    rowNumbers: [rowNumber],
    lines: [{
      accountCode,
      accountName: '',
      description: text(cell(row, headerMap, 'lineDescription')) || description,
      debit,
      credit,
      rowNumber,
    }],
  }
}

function getNameLineFormat(row: unknown[], headerMap: Map<string, number>, rowNumber: number): ParsedEntry | ImportError {
  const entryDate = dateToYmd(cell(row, headerMap, 'entryDate'))
  const description = text(cell(row, headerMap, 'particular'))
  const accountName = text(cell(row, headerMap, 'accountName'))
  const debit = amount(cell(row, headerMap, 'debit'))
  const credit = amount(cell(row, headerMap, 'credit'))

  if (!entryDate) return { row: rowNumber, message: 'Date is required and must be YYYY-MM-DD.' }
  if (!description) return { row: rowNumber, message: 'Particular is required.' }
  if (!accountName) return { row: rowNumber, message: 'Account name is required.' }
  if (!Number.isFinite(debit) || !Number.isFinite(credit)) return { row: rowNumber, message: 'Debit/Credit must be numeric.' }
  if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
    return { row: rowNumber, message: 'Each line must have either debit or credit, but not both.' }
  }

  return {
    sourceVoucherNo: text(cell(row, headerMap, 'voucherNo')),
    entryDate,
    description,
    rowNumbers: [rowNumber],
    lines: [{
      accountCode: '',
      accountName,
      description,
      debit,
      credit,
      rowNumber,
    }],
  }
}

function getPairFormat(row: unknown[], headerMap: Map<string, number>, rowNumber: number): ParsedEntry | ImportError {
  const entryDate = dateToYmd(cell(row, headerMap, 'entryDate'))
  const description = text(cell(row, headerMap, 'description'))
  const debitAccountCode = text(cell(row, headerMap, 'debitAccountCode'))
  const creditAccountCode = text(cell(row, headerMap, 'creditAccountCode'))
  const entryAmount = amount(cell(row, headerMap, 'amount'))

  if (!entryDate) return { row: rowNumber, message: 'Date is required and must be YYYY-MM-DD.' }
  if (!description) return { row: rowNumber, message: 'Description is required.' }
  if (!debitAccountCode || !creditAccountCode) return { row: rowNumber, message: 'Debit Account Code and Credit Account Code are required.' }
  if (!Number.isFinite(entryAmount) || entryAmount <= 0) return { row: rowNumber, message: 'Amount must be greater than zero.' }

  return {
    sourceVoucherNo: text(cell(row, headerMap, 'voucherNo')),
    entryDate,
    description,
    rowNumbers: [rowNumber],
    lines: [
      { accountCode: debitAccountCode, accountName: '', description, debit: entryAmount, credit: 0, rowNumber },
      { accountCode: creditAccountCode, accountName: '', description, debit: 0, credit: entryAmount, rowNumber },
    ],
  }
}

function isImportError(value: ParsedEntry | ImportError): value is ImportError {
  return 'message' in value
}

function groupEntries(entries: ParsedEntry[]) {
  const grouped = new Map<string, ParsedEntry>()
  let autoIndex = 0

  for (const entry of entries) {
    const key = entry.sourceVoucherNo
      ? `voucher:${entry.sourceVoucherNo}`
      : entry.lines.length > 1
        ? `pair:${autoIndex++}`
        : `auto:${entry.entryDate}:${entry.description}:${autoIndex}`

    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...entry, lines: [...entry.lines], rowNumbers: [...entry.rowNumbers] })
      continue
    }

    existing.lines.push(...entry.lines)
    existing.rowNumbers.push(...entry.rowNumbers)
    if (existing.entryDate !== entry.entryDate || existing.description !== entry.description) {
      existing.sourceVoucherNo = entry.sourceVoucherNo
    }
  }

  return Array.from(grouped.values())
}

function validateAccountNameEntry(entry: ParsedEntry, accountsByName: AccountNameLookup): ImportError | null {
  for (const line of entry.lines) {
    const accountName = line.accountName.trim()
    const match = accountsByName.get(accountName)
    if (match === 'ambiguous') {
      return {
        row: entry.rowNumbers[0] ?? line.rowNumber,
        message: `Import record failed: account name "${accountName}" matches multiple accounts for this company.`,
      }
    }
    if (!match) {
      return {
        row: entry.rowNumbers[0] ?? line.rowNumber,
        message: `Import record failed: account name "${accountName}" does not exist for this company.`,
      }
    }
  }
  return null
}

function validateEntries(
  entries: ParsedEntry[],
  accountsByCode: AccountLookup,
  accountsByName: AccountNameLookup,
  importFormat: ImportFormat,
) {
  const errors: ImportError[] = []
  const seenVoucherNos = new Set<string>()

  for (const entry of entries) {
    if (entry.sourceVoucherNo) {
      if (seenVoucherNos.has(entry.sourceVoucherNo)) {
        errors.push({ row: entry.rowNumbers[0] ?? 0, message: `Duplicate Voucher No "${entry.sourceVoucherNo}" in file.` })
      }
      seenVoucherNos.add(entry.sourceVoucherNo)
    }

    if (importFormat === 'nameLine') {
      const accountError = validateAccountNameEntry(entry, accountsByName)
      if (accountError) {
        errors.push(accountError)
        continue
      }
    }

    if (entry.lines.length < 2) {
      errors.push({ row: entry.rowNumbers[0] ?? 0, message: 'Each journal entry must contain at least two lines.' })
    }

    const balance = validateBalance(entry.lines)
    if (!balance.balanced || balance.totalDebit <= 0) {
      errors.push({ row: entry.rowNumbers[0] ?? 0, message: `Entry is not balanced. Debit ${balance.totalDebit}, Credit ${balance.totalCredit}.` })
    }

    if (importFormat !== 'nameLine') {
      for (const line of entry.lines) {
        if (!accountsByCode.has(line.accountCode)) {
          errors.push({ row: line.rowNumber, message: `Account Code "${line.accountCode}" does not exist for this company.` })
        }
      }
    }
  }

  return errors
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const formData = await req.formData().catch(() => null)
  const companyId = text(formData?.get('companyId'))
  const file = formData?.get('file')

  if (!companyId) return apiError('Company is required.')
  if (!(file instanceof File)) return apiError('Please upload an Excel file.')
  if (!/\.(xlsx|xls)$/i.test(file.name)) return apiError('Only .xlsx or .xls files are supported.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) return apiError('Forbidden', 403)
  const companyScope = await resolveJournalCompanyScope(companyId)
  if (!companyScope.companyId) return apiError('Selected company does not exist.', 400)

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return apiError('Excel file has no worksheets.')

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return apiError('Excel worksheet cannot be read.')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })
  const [headers, ...bodyRows] = rows
  if (!headers?.length) return apiError('Excel header row is required.')
  if (bodyRows.length > MAX_ROWS) return apiError(`Import supports at most ${MAX_ROWS} rows per file.`)

  const headerMap = buildHeaderMap(headers)
  const importFormat = detectImportFormat(headerMap)
  if (!importFormat) {
    return apiError(
      'Missing required columns. Use Account Code + Debit/Credit, Account Name + Particular + Debit/Credit, or Debit Account Code + Credit Account Code + Amount.',
    )
  }

  const parsedRows: ParsedEntry[] = []
  const parseErrors: ImportError[] = []
  bodyRows.forEach((row, index) => {
    if (!rowHasValue(row)) return
    const rowNumber = index + 2
    const parsed = importFormat === 'pair' && text(cell(row, headerMap, 'debitAccountCode'))
      ? getPairFormat(row, headerMap, rowNumber)
      : importFormat === 'nameLine'
        ? getNameLineFormat(row, headerMap, rowNumber)
        : getLineFormat(row, headerMap, rowNumber)
    if (isImportError(parsed)) parseErrors.push(parsed)
    else parsedRows.push(parsed)
  })

  if (parsedRows.length === 0) {
    return NextResponse.json({ imported: 0, errors: parseErrors.length ? parseErrors : [{ row: 0, message: 'No journal rows found.' }] }, { status: 400 })
  }

  const entries = groupEntries(parsedRows)
  const accounts = await prisma.finAccount.findMany({
    where: { companyId: companyScope.companyId },
    select: { id: true, code: true, name: true },
  })
  const accountLookup = new Map(accounts.map(account => [account.code, account]))
  const accountNameLookup = buildAccountNameLookup(accounts)
  const validationErrors = validateEntries(entries, accountLookup, accountNameLookup, importFormat)

  const voucherNos = entries.map(entry => entry.sourceVoucherNo).filter(Boolean)
  if (voucherNos.length > 0) {
    const existing = await prisma.journalEntry.findMany({
      where: { voucherNo: { in: voucherNos } },
      select: { voucherNo: true },
    })
    for (const existingVoucher of existing) {
      const entry = entries.find(row => row.sourceVoucherNo === existingVoucher.voucherNo)
      validationErrors.push({
        row: entry?.rowNumbers[0] ?? 0,
        message: `Voucher No "${existingVoucher.voucherNo}" already exists.`,
      })
    }
  }

  const errors = [...parseErrors, ...validationErrors].sort((a, b) => a.row - b.row)
  if (errors.length > 0) {
    return NextResponse.json({ imported: 0, errors: errors.slice(0, 100), errorCount: errors.length }, { status: 400 })
  }

  const created = await prisma.$transaction(async tx => {
    const imported: { id: string; voucherNo: string }[] = []
    for (const entry of entries) {
      const entryDate = parseYmdDate(entry.entryDate)
      const voucherNo = entry.sourceVoucherNo || await generateVoucherNo(entryDate, tx)
      const createdEntry = await tx.journalEntry.create({
        data: {
          voucherNo,
          entryDate,
          description: entry.description,
          period: periodFromDate(entryDate),
          companyId: companyScope.companyId,
          createdById: session.user.id,
          lines: {
            create: entry.lines.map((line, index) => ({
              accountId: resolveAccountId(line, accountLookup, accountNameLookup)!,
              lineNum: index + 1,
              description: line.description || entry.description,
              debit: new Prisma.Decimal(line.debit),
              credit: new Prisma.Decimal(line.credit),
              notes: `Imported from ${file.name}, row ${line.rowNumber}`,
            })),
          },
        },
        select: { id: true, voucherNo: true },
      })
      imported.push(createdEntry)
    }
    return imported
  })

  await logAudit(session.user.id, 'CREATE', 'JournalEntryImport', companyScope.companyId, null, {
    fileName: file.name,
    imported: created.length,
    voucherNos: created.map(entry => entry.voucherNo),
  })

  return NextResponse.json({
    imported: created.length,
    rows: parsedRows.length,
    entries: created,
    toast: `Imported ${created.length} pending journal entries.`,
  })
}
