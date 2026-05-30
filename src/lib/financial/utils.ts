import type { AccountType, Prisma } from '@prisma/client'
import { isDebitNormalAccountType } from '@/lib/financial/account-types'

type VoucherClient = {
  journalEntry: {
    findFirst(args: {
      where: { voucherNo: { startsWith: string } }
      orderBy: { voucherNo: 'desc' }
      select: { voucherNo: true }
    }): Promise<{ voucherNo: string } | null>
  }
}

export type BalanceLine = {
  accountId: string
  accountType?: AccountType
  accountCode?: string
  debit: number | Prisma.Decimal
  credit: number | Prisma.Decimal
}

export function formatCurrency(value: number | Prisma.Decimal | string | null | undefined) {
  const numeric = Number(value ?? 0)
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0)
}

export function periodFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function parseYmdDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function voucherDatePart(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('')
}

export async function generateVoucherNo(entryDate: Date, client: VoucherClient) {
  const prefix = `JE-${voucherDatePart(entryDate)}-`
  const latest = await client.journalEntry.findFirst({
    where: { voucherNo: { startsWith: prefix } },
    orderBy: { voucherNo: 'desc' },
    select: { voucherNo: true },
  })
  const lastNumber = Number(latest?.voucherNo.slice(prefix.length) ?? '0')
  return `${prefix}${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(3, '0')}`
}

export function validateBalance(lines: Pick<BalanceLine, 'debit' | 'credit'>[]) {
  const totalDebit = roundMoney(lines.reduce((sum, line) => sum + Number(line.debit), 0))
  const totalCredit = roundMoney(lines.reduce((sum, line) => sum + Number(line.credit), 0))
  return {
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    totalDebit,
    totalCredit,
    difference: roundMoney(totalDebit - totalCredit),
  }
}

export function calculateRunningBalance<T extends BalanceLine>(lines: T[]) {
  const balances = new Map<string, number>()
  return lines.map(line => {
    const previous = balances.get(line.accountId) ?? 0
    const balance = roundMoney(previous + signedLineAmount(line))
    balances.set(line.accountId, balance)
    return { ...line, balance }
  })
}

export function signedLineAmount(line: BalanceLine) {
  const debit = Number(line.debit)
  const credit = Number(line.credit)
  if (line.accountType && !isDebitNormalAccountType(line.accountType, line.accountCode)) {
    return credit - debit
  }
  return debit - credit
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
