import type { AccountType } from '@prisma/client'
import { serializeAccount } from '@/lib/financial/serializers'
import { calculateYearToDateAmount, calculateYearToDateBalance } from '@/lib/financial/year-to-date'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

type Decimalish = { toString(): string }

export type AccountRollupInput = {
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
  yearToDateDebit: Decimalish | number
  yearToDateCredit: Decimalish | number
  createdAt?: Date
  updatedAt?: Date
  accountBalances: {
    period: string
    openingDebit: Decimalish | number
    openingCredit: Decimalish | number
  }[]
}

type AccountOwnAmounts = {
  openingDebit: number
  openingCredit: number
  openingBalance: number
  yearToDateAmount: number
  yearToDateDebit: number
  yearToDateCredit: number
  yearToDateBalance: number
}

function sumChildTotals(
  accountId: string,
  childrenByParent: Map<string | null, string[]>,
  ownById: Map<string, AccountOwnAmounts>,
  totalById: Map<string, AccountOwnAmounts>,
): AccountOwnAmounts {
  const cached = totalById.get(accountId)
  if (cached) return cached

  const children = childrenByParent.get(accountId) ?? []
  const own = ownById.get(accountId) ?? {
    openingDebit: 0,
    openingCredit: 0,
    openingBalance: 0,
    yearToDateAmount: 0,
    yearToDateDebit: 0,
    yearToDateCredit: 0,
    yearToDateBalance: 0,
  }

  if (children.length === 0) {
    totalById.set(accountId, own)
    return own
  }

  const total = children.reduce<AccountOwnAmounts>((sum, childId) => {
    const child = sumChildTotals(childId, childrenByParent, ownById, totalById)
    return {
      openingDebit: roundMoney(sum.openingDebit + child.openingDebit),
      openingCredit: roundMoney(sum.openingCredit + child.openingCredit),
      openingBalance: roundMoney(sum.openingBalance + child.openingBalance),
      yearToDateAmount: roundMoney(sum.yearToDateAmount + child.yearToDateAmount),
      yearToDateDebit: roundMoney(sum.yearToDateDebit + child.yearToDateDebit),
      yearToDateCredit: roundMoney(sum.yearToDateCredit + child.yearToDateCredit),
      yearToDateBalance: roundMoney(sum.yearToDateBalance + child.yearToDateBalance),
    }
  }, {
    openingDebit: 0,
    openingCredit: 0,
    openingBalance: 0,
    yearToDateAmount: 0,
    yearToDateDebit: 0,
    yearToDateCredit: 0,
    yearToDateBalance: 0,
  })

  totalById.set(accountId, total)
  return total
}

export function serializeAccountsWithRollups<T extends AccountRollupInput>(accounts: T[]) {
  const childrenByParent = new Map<string | null, string[]>()
  const ownById = new Map<string, AccountOwnAmounts>()

  const serialized = accounts.map(account => {
    const openingBalance = account.accountBalances[0] ?? null
    const openingDebit = roundMoney(Number(openingBalance?.openingDebit ?? 0))
    const openingCredit = roundMoney(Number(openingBalance?.openingCredit ?? 0))
    const ownOpeningBalance = roundMoney(signedLineAmount({
      accountId: account.id,
      accountType: account.type,
      accountCode: account.code,
      debit: openingDebit,
      credit: openingCredit,
    }))
    const yearToDateDebit = roundMoney(Number(account.yearToDateDebit))
    const yearToDateCredit = roundMoney(Number(account.yearToDateCredit))
    const yearToDateAmount = calculateYearToDateAmount({
      name: account.name,
      type: account.type,
      code: account.code,
      debit: yearToDateDebit,
      credit: yearToDateCredit,
    })
    const yearToDateBalance = calculateYearToDateBalance({
      name: account.name,
      type: account.type,
      code: account.code,
      debit: yearToDateDebit,
      credit: yearToDateCredit,
    })

    childrenByParent.set(account.parentId, [...(childrenByParent.get(account.parentId) ?? []), account.id])
    ownById.set(account.id, {
      openingDebit,
      openingCredit,
      openingBalance: ownOpeningBalance,
      yearToDateAmount,
      yearToDateDebit,
      yearToDateCredit,
      yearToDateBalance,
    })

    return {
      ...serializeAccount(account),
      openingBalancePeriod: openingBalance?.period ?? null,
      openingDebit,
      openingCredit,
      openingBalance: ownOpeningBalance,
      openingDebitTotal: openingDebit,
      openingCreditTotal: openingCredit,
      openingBalanceTotal: ownOpeningBalance,
      yearToDateAmount,
      yearToDateDebit,
      yearToDateCredit,
      yearToDateAmountTotal: yearToDateAmount,
      yearToDateDebitTotal: yearToDateDebit,
      yearToDateCreditTotal: yearToDateCredit,
      yearToDateBalance,
      yearToDateBalanceTotal: yearToDateBalance,
    }
  })

  const totalById = new Map<string, AccountOwnAmounts>()
  return serialized.map(account => {
    const total = sumChildTotals(account.id, childrenByParent, ownById, totalById)
    return {
      ...account,
      openingDebitTotal: total.openingDebit,
      openingCreditTotal: total.openingCredit,
      openingBalanceTotal: total.openingBalance,
      yearToDateAmountTotal: total.yearToDateAmount,
      yearToDateDebitTotal: total.yearToDateDebit,
      yearToDateCreditTotal: total.yearToDateCredit,
      yearToDateBalanceTotal: total.yearToDateBalance,
    }
  })
}
