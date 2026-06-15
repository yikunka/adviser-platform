import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import { requireFinancialWriteRole } from '@/lib/financial/api-guard'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { resolveJournalCompanyScope } from '@/lib/financial/company-scope'
import { ensureDefaultChartOfAccounts } from '@/lib/financial/default-chart-of-accounts'
import { createImportedAccount, type AccountRecord, type MutableAccountRecord } from '@/lib/financial/journal-import-accounts'
import {
  buildJournalImportHeaderMap,
  detectJournalImportFormat,
  normalizeJournalImportLookupText,
} from '@/lib/financial/journal-import-parser'
import { generateVoucherNo, parseYmdDate, periodFromDate, validateBalance } from '@/lib/financial/utils'

type ParsedLine = {
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
  rowNumber: number
}

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

type AccountLookup = Map<string, MutableAccountRecord>

const MAX_ROWS = 2000

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

function buildAccountNameLookup(accounts: AccountRecord[]): AccountNameLookup {
  const lookup: AccountNameLookup = new Map()
  for (const account of accounts) {
    const key = normalizeJournalImportLookupText(account.name)
    const existing = lookup.get(key)
    if (existing === 'ambiguous') continue
    if (existing) lookup.set(key, 'ambiguous')
    else lookup.set(key, account)
  }
  return lookup
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

function entryDescription(row: unknown[], headerMap: Map<string, number>) {
  return text(cell(row, headerMap, 'particular')) || text(cell(row, headerMap, 'description'))
}

function getLineFormat(row: unknown[], headerMap: Map<string, number>, rowNumber: number): ParsedEntry | ImportError {
  const entryDate = dateToYmd(cell(row, headerMap, 'entryDate'))
  const description = entryDescription(row, headerMap)
  const accountCode = text(cell(row, headerMap, 'accountCode'))
  const accountName = text(cell(row, headerMap, 'accountName'))
  const debit = amount(cell(row, headerMap, 'debit'))
  const credit = amount(cell(row, headerMap, 'credit'))

  if (!entryDate) return { row: rowNumber, message: 'Date is required and must be YYYY-MM-DD.' }
  if (!description) return { row: rowNumber, message: 'Particular/Description is required.' }
  if (!accountCode && !accountName) return { row: rowNumber, message: 'Account Code or Account Name is required.' }
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
      accountName,
      description: text(cell(row, headerMap, 'lineDescription')) || description,
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
    if (line.accountCode) continue
    const rawAccountName = line.accountName.trim()
    const accountName = normalizeJournalImportLookupText(line.accountName)
    const match = accountsByName.get(accountName)
    if (match === 'ambiguous') {
      return {
        row: entry.rowNumbers[0] ?? line.rowNumber,
        message: `Import record failed: account name "${rawAccountName}" matches multiple accounts for this company.`,
      }
    }
  }
  return null
}

function validateEntries(
  entries: ParsedEntry[],
  accountsByCode: AccountLookup,
  accountsByName: AccountNameLookup,
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

    const accountError = validateAccountNameEntry(entry, accountsByName)
    if (accountError) {
      errors.push(accountError)
      continue
    }

    if (entry.lines.length < 2) {
      errors.push({ row: entry.rowNumbers[0] ?? 0, message: 'Each journal entry must contain at least two lines.' })
    }

    const balance = validateBalance(entry.lines)
    if (!balance.balanced || balance.totalDebit <= 0) {
      errors.push({ row: entry.rowNumbers[0] ?? 0, message: `Entry is not balanced. Debit ${balance.totalDebit}, Credit ${balance.totalCredit}.` })
    }

    for (const line of entry.lines) {
      if (line.accountCode && !accountsByCode.has(line.accountCode)) {
        errors.push({ row: line.rowNumber, message: `Account Code "${line.accountCode}" does not exist for this company.` })
      }
    }
  }

  return errors
}

async function resolveOrCreateAccountId(
  tx: Prisma.TransactionClient,
  args: {
    companyId: string
    line: ParsedLine
    availableAccounts: AccountRecord[]
    accountsByCode: AccountLookup
    accountsByName: AccountNameLookup
  },
) {
  if (args.line.accountCode) {
    const match = args.accountsByCode.get(args.line.accountCode)
    if (!match) throw new Error(`Account Code "${args.line.accountCode}" does not exist for this company.`)
    return match.id
  }

  const accountName = normalizeJournalImportLookupText(args.line.accountName)
  const existing = args.accountsByName.get(accountName)
  if (existing === 'ambiguous') {
    throw new Error(`Import record failed: account name "${args.line.accountName.trim()}" matches multiple accounts for this company.`)
  }
  if (existing) return existing.id

  const created = await createImportedAccount(tx, {
    companyId: args.companyId,
    accountName,
    debit: args.line.debit,
    credit: args.line.credit,
    availableAccounts: args.availableAccounts,
  })
  args.availableAccounts.push(created)
  args.accountsByCode.set(created.code, created)
  args.accountsByName.set(normalizeJournalImportLookupText(created.name), created)
  return created.id
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireFinancialWriteRole()
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
  await ensureDefaultChartOfAccounts(companyScope.companyId, prisma)

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return apiError('Excel file has no worksheets.')

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return apiError('Excel worksheet cannot be read.')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })
  const [headers, ...bodyRows] = rows
  if (!headers?.length) return apiError('Excel header row is required.')
  if (bodyRows.length > MAX_ROWS) return apiError(`Import supports at most ${MAX_ROWS} rows per file.`)

  const headerMap = buildJournalImportHeaderMap(headers)
  const importFormat = detectJournalImportFormat(headerMap)
  if (!importFormat) {
    return apiError(
      'Missing required columns. Use Date + Voucher Number + Account Code/Account Name + Particular/Description + Debit/Credit, or Debit Account Code + Credit Account Code + Amount.',
    )
  }

  const parsedRows: ParsedEntry[] = []
  const parseErrors: ImportError[] = []
  bodyRows.forEach((row, index) => {
    if (!rowHasValue(row)) return
    const rowNumber = index + 2
    const parsed = importFormat === 'pair' && text(cell(row, headerMap, 'debitAccountCode'))
      ? getPairFormat(row, headerMap, rowNumber)
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
    select: { id: true, code: true, name: true, type: true, parentId: true, level: true, sortOrder: true },
  })
  const accountLookup = new Map(accounts.map(account => [account.code, account]))
  const accountNameLookup = buildAccountNameLookup(accounts)
  const validationErrors = validateEntries(entries, accountLookup, accountNameLookup)

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
    const txAccounts = [...accounts]
    const txAccountLookup = new Map(accountLookup)
    const txAccountNameLookup = new Map(accountNameLookup)
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
            create: await Promise.all(entry.lines.map(async (line, index) => ({
              accountId: await resolveOrCreateAccountId(tx, {
                companyId: companyScope.companyId!,
                line,
                availableAccounts: txAccounts,
                accountsByCode: txAccountLookup,
                accountsByName: txAccountNameLookup,
              }),
              lineNum: index + 1,
              description: line.description || entry.description,
              debit: new Prisma.Decimal(line.debit),
              credit: new Prisma.Decimal(line.credit),
              notes: `Imported from ${file.name}, row ${line.rowNumber}`,
            }))),
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
