import type { AccountType } from '@prisma/client'
import { buildLeafAccountIdsByAccount, buildYearToDateTotalsByAccount } from '@/lib/financial/report-account-rollups'
import { trialBalanceColumns } from '@/lib/financial/report-balances'
import { roundMoney } from '@/lib/financial/utils'

export type JournalAccountPickerBalanceAccount = {
  id: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  yearToDateAmount?: number
  yearToDateDebit: number
  yearToDateCredit: number
}

export type MovementTotals = {
  debit: number
  credit: number
}

export type JournalAccountPickerBalanceColumns = {
  balanceDebit: number
  balanceCredit: number
}

function signedBalance(amount: number, type: AccountType, code?: string) {
  const columns = trialBalanceColumns(amount, type, code)
  return columns.closingDebit - columns.closingCredit
}

function movementSignedBalance(totals: MovementTotals, type: AccountType, code?: string) {
  const netDebit = roundMoney(totals.debit - totals.credit)
  return signedBalance(netDebit, type, code)
}

function sumMovements(map: Map<string, MovementTotals>, accountIds: string[]) {
  return accountIds.reduce<MovementTotals>((sum, accountId) => {
    const totals = map.get(accountId)
    if (!totals) return sum
    return {
      debit: roundMoney(sum.debit + totals.debit),
      credit: roundMoney(sum.credit + totals.credit),
    }
  }, { debit: 0, credit: 0 })
}

export function calculateJournalAccountPickerBalances(input: {
  accounts: JournalAccountPickerBalanceAccount[]
  movementTotalsByAccount: Map<string, MovementTotals>
  storedBalanceTotalsByAccount: Map<string, MovementTotals>
}) {
  const { leafIdsByAccount } = buildLeafAccountIdsByAccount(input.accounts)
  const yearToDateTotalsByAccount = buildYearToDateTotalsByAccount(input.accounts)
  const balances = new Map<string, JournalAccountPickerBalanceColumns>()

  for (const account of input.accounts) {
    const sourceAccountIds = leafIdsByAccount.get(account.id) ?? [account.id]
    const movementTotals = sumMovements(input.movementTotalsByAccount, sourceAccountIds)
    const storedBalanceTotals = sumMovements(input.storedBalanceTotalsByAccount, sourceAccountIds)
    const yearToDateBalance = yearToDateTotalsByAccount.get(account.id)?.balance ?? 0
    const balance = roundMoney(
      movementSignedBalance(movementTotals, account.type, account.code)
        + movementSignedBalance(storedBalanceTotals, account.type, account.code)
        + yearToDateBalance,
    )
    const columns = trialBalanceColumns(balance, account.type, account.code)
    balances.set(account.id, {
      balanceDebit: columns.closingDebit,
      balanceCredit: columns.closingCredit,
    })
  }

  return balances
}
