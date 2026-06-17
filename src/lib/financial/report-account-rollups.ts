import type { AccountType } from '@prisma/client'
import { calculateYearToDateBalance } from '@/lib/financial/year-to-date'
import { roundMoney } from '@/lib/financial/utils'

export type ReportRollupAccount = {
  id: string
  parentId: string | null
  name: string
  type: AccountType
  code: string
  yearToDateAmount?: number
  yearToDateDebit: number
  yearToDateCredit: number
}

export type YearToDateTotals = {
  debit: number
  credit: number
  balance: number
}

export function buildChildrenByParent<T extends { id: string; parentId: string | null }>(accounts: T[]) {
  const map = new Map<string | null, string[]>()
  for (const account of accounts) {
    map.set(account.parentId, [...(map.get(account.parentId) ?? []), account.id])
  }
  return map
}

export function collectLeafAccountIds(
  accountId: string,
  childrenByParent: Map<string | null, string[]>,
): string[] {
  const children = childrenByParent.get(accountId) ?? []
  if (children.length === 0) return [accountId]
  return children.flatMap(childId => collectLeafAccountIds(childId, childrenByParent))
}

export function buildLeafAccountIdsByAccount(
  accounts: Array<{ id: string; parentId: string | null }>,
) {
  const childrenByParent = buildChildrenByParent(accounts)
  const leafIdsByAccount = new Map<string, string[]>()
  for (const account of accounts) {
    leafIdsByAccount.set(account.id, collectLeafAccountIds(account.id, childrenByParent))
  }
  return { childrenByParent, leafIdsByAccount }
}

function ownYearToDateTotals(account: ReportRollupAccount): YearToDateTotals {
  const legacyAmount = roundMoney(account.yearToDateAmount ?? 0)
  const explicitDebit = roundMoney(account.yearToDateDebit)
  const explicitCredit = roundMoney(account.yearToDateCredit)
  const creditNormal = account.type === 'REVENUE'
  const debit = explicitDebit !== 0 || explicitCredit !== 0
    ? explicitDebit
    : creditNormal
      ? 0
      : legacyAmount
  const credit = explicitDebit !== 0 || explicitCredit !== 0
    ? explicitCredit
    : creditNormal
      ? legacyAmount
      : 0
  return {
    debit,
    credit,
    balance: calculateYearToDateBalance({
      name: account.name,
      type: account.type,
      code: account.code,
      debit,
      credit,
    }),
  }
}

export function buildYearToDateTotalsByAccount(accounts: ReportRollupAccount[]) {
  const { childrenByParent } = buildLeafAccountIdsByAccount(accounts)
  const ownById = new Map(accounts.map(account => [account.id, ownYearToDateTotals(account)]))
  const totalById = new Map<string, YearToDateTotals>()

  const resolve = (accountId: string): YearToDateTotals => {
    const cached = totalById.get(accountId)
    if (cached) return cached

    const children = childrenByParent.get(accountId) ?? []
    if (children.length === 0) {
      const own = ownById.get(accountId) ?? { debit: 0, credit: 0, balance: 0 }
      totalById.set(accountId, own)
      return own
    }

    const total = children.reduce<YearToDateTotals>((sum, childId) => {
      const child = resolve(childId)
      return {
        debit: roundMoney(sum.debit + child.debit),
        credit: roundMoney(sum.credit + child.credit),
        balance: roundMoney(sum.balance + child.balance),
      }
    }, { debit: 0, credit: 0, balance: 0 })

    totalById.set(accountId, total)
    return total
  }

  for (const account of accounts) {
    resolve(account.id)
  }

  return totalById
}
