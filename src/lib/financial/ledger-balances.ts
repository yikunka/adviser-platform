import type { AccountType, Prisma } from '@prisma/client'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

export type LedgerBalanceAccount = {
  id: string
  type: AccountType
  code: string
}

export type LedgerBalanceLine = {
  accountId: string
  debit: number | Prisma.Decimal
  credit: number | Prisma.Decimal
}

export type AccountOpeningBalance = {
  accountId: string
  openingDebit: number | Prisma.Decimal
  openingCredit: number | Prisma.Decimal
}

export function signedOpeningBalance(
  opening: AccountOpeningBalance,
  account: LedgerBalanceAccount,
) {
  return signedLineAmount({
    accountId: opening.accountId,
    accountType: account.type,
    accountCode: account.code,
    debit: opening.openingDebit,
    credit: opening.openingCredit,
  })
}

export function applyLedgerMovement(
  balance: number,
  line: LedgerBalanceLine,
  account: LedgerBalanceAccount,
) {
  return roundMoney(
    balance + signedLineAmount({
      accountId: line.accountId,
      accountType: account.type,
      accountCode: account.code,
      debit: line.debit,
      credit: line.credit,
    }),
  )
}

export function addLedgerMovementsToOpeningBalances<T extends LedgerBalanceLine>(
  openingBalances: Map<string, number>,
  lines: T[],
  accountsById: Map<string, LedgerBalanceAccount>,
) {
  const balances = new Map(openingBalances)
  for (const line of lines) {
    const account = accountsById.get(line.accountId)
    if (!account) continue
    balances.set(
      line.accountId,
      applyLedgerMovement(balances.get(line.accountId) ?? 0, line, account),
    )
  }
  return balances
}

export function calculateLedgerRunningBalances<T extends LedgerBalanceLine>(
  entries: T[],
  accountsById: Map<string, LedgerBalanceAccount>,
  openingBalances: Map<string, number>,
) {
  const balances = new Map(openingBalances)
  return entries.map(entry => {
    const account = accountsById.get(entry.accountId)
    if (!account) return { ...entry, calculatedBalance: roundMoney(balances.get(entry.accountId) ?? 0) }
    const calculatedBalance = applyLedgerMovement(
      balances.get(entry.accountId) ?? 0,
      entry,
      account,
    )
    balances.set(entry.accountId, calculatedBalance)
    return { ...entry, calculatedBalance }
  })
}
