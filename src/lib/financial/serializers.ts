import type { AccountType, JournalStatus } from '@prisma/client'
import { calculateYearToDateAmount } from '@/lib/financial/year-to-date'

type Decimalish = { toString(): string }

function money(value: Decimalish | number | string | null | undefined) {
  return Number(value ?? 0)
}

export type SerializedAccount = {
  id: string
  code: string
  name: string
  type: AccountType
  companyId: string | null
  level: number
  sortOrder: number
  parentId: string | null
  parent?: { id: string; code: string; name: string } | null
  isSystem: boolean
  notes: string
  yearToDateAmount: number
  yearToDateDebit: number
  yearToDateCredit: number
  createdAt?: string
  updatedAt?: string
}

export function serializeAccount(account: {
  id: string
  code: string
  name: string
  type: AccountType
  companyId?: string | null
  level: number
  sortOrder: number
  parentId: string | null
  parent?: { id: string; code: string; name: string } | null
  isSystem: boolean
  notes: string
  yearToDateAmount?: Decimalish | number
  yearToDateDebit?: Decimalish | number
  yearToDateCredit?: Decimalish | number
  createdAt?: Date
  updatedAt?: Date
}): SerializedAccount {
  const yearToDateDebit = money(account.yearToDateDebit)
  const yearToDateCredit = money(account.yearToDateCredit)
  const yearToDateAmount = calculateYearToDateAmount({
    name: account.name,
    type: account.type,
    code: account.code,
    debit: yearToDateDebit,
    credit: yearToDateCredit,
  })

  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    companyId: account.companyId ?? null,
    level: account.level,
    sortOrder: account.sortOrder,
    parentId: account.parentId,
    parent: account.parent ?? null,
    isSystem: account.isSystem,
    notes: account.notes,
    yearToDateAmount,
    yearToDateDebit,
    yearToDateCredit,
    createdAt: account.createdAt?.toISOString(),
    updatedAt: account.updatedAt?.toISOString(),
  }
}

export function serializeJournalEntry(entry: {
  id: string
  voucherNo: string
  entryDate: Date
  description: string
  period: string
  status: JournalStatus
  companyId?: string | null
  company?: { id: string; nameEn: string; companyCode: string | null } | null
  createdAt?: Date
  postedAt: Date | null
  reversedAt: Date | null
  createdBy?: { id: string; nameEn: string; email: string } | null
  lines: {
    id: string
    accountId: string
    lineNum: number
    description: string
    debit: Decimalish
    credit: Decimalish
    notes: string
    account?: { id: string; code: string; name: string; type: AccountType } | null
  }[]
}) {
  const lines = entry.lines
    .slice()
    .sort((a, b) => a.lineNum - b.lineNum)
    .map(line => ({
      id: line.id,
      accountId: line.accountId,
      lineNum: line.lineNum,
      description: line.description,
      debit: money(line.debit),
      credit: money(line.credit),
      notes: line.notes,
      account: line.account ?? null,
    }))

  return {
    id: entry.id,
    voucherNo: entry.voucherNo,
    entryDate: entry.entryDate.toISOString(),
    date: entry.entryDate.toISOString(),
    description: entry.description,
    period: entry.period,
    status: entry.status,
    companyId: entry.companyId ?? null,
    company: entry.company ?? null,
    totalAmount: lines.reduce((sum, line) => sum + line.debit, 0),
    createdBy: entry.createdBy?.nameEn ?? entry.createdBy?.email ?? 'System',
    createdById: entry.createdBy?.id ?? null,
    createdAt: entry.createdAt?.toISOString() ?? null,
    postedAt: entry.postedAt?.toISOString() ?? null,
    cancelledAt: entry.reversedAt?.toISOString() ?? null,
    lines,
  }
}

export function serializeLedgerEntry(entry: {
  id: string
  accountId: string
  companyId?: string | null
  lineNum?: number
  date: Date
  voucherNo: string
  description: string
  debit: Decimalish
  credit: Decimalish
  balance: Decimalish | number
  account: { id: string; code: string; name: string; type: AccountType }
  company?: { id: string; nameEn: string; companyCode: string | null } | null
}) {
  return {
    id: entry.id,
    accountId: entry.accountId,
    companyId: entry.companyId ?? null,
    company: entry.company ?? null,
    accountCode: entry.account.code,
    accountName: entry.account.name,
    accountType: entry.account.type,
    lineNum: entry.lineNum ?? 0,
    date: entry.date.toISOString(),
    voucherNo: entry.voucherNo,
    description: entry.description,
    debit: money(entry.debit),
    credit: money(entry.credit),
    balance: money(entry.balance),
  }
}
