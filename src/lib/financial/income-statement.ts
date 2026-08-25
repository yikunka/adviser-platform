import type { AccountType } from '@prisma/client'
import type { StatementLineRow } from '@/lib/financial/report-line-types'
import { roundMoney } from '@/lib/financial/utils'

export type IncomeStatementExpenseCategoryKey = 'sales' | 'administrative' | 'finance'

export type IncomeStatementExpenseCategory = {
  key: IncomeStatementExpenseCategoryKey
  label: string
  lines: StatementLineRow[]
  total: number
  /** Calendar year-to-date total of category lines. */
  totalYtd: number
}

export const INCOME_STATEMENT_EXPENSE_CATEGORIES: ReadonlyArray<{
  key: IncomeStatementExpenseCategoryKey
  label: string
}> = [
  { key: 'sales', label: '销售费用' },
  { key: 'administrative', label: '管理费用' },
  { key: 'finance', label: '财务费用' },
]

const PL_STATEMENT_TYPES: ReadonlySet<AccountType> = new Set(['REVENUE', 'EXPENSE', 'CGS'])
export type ProfitAndLossStatementType = 'REVENUE' | 'EXPENSE' | 'CGS'

function isProfitAndLossStatementType(type: AccountType): type is ProfitAndLossStatementType {
  return PL_STATEMENT_TYPES.has(type)
}

function isRevenueCandidate(account: { code: string; name: string }) {
  const text = normalize(`${account.code} ${account.name}`)
  return (
    /收入|收益|營業收入|营业收入|销售收入|銷售收入|主营业务收入|主營業務收入|revenue|income|turnover/.test(text)
    || /^05/.test(account.code)
    || /^4/.test(account.code)
  )
}

function hasRevenueName(account: { name: string }) {
  const text = normalize(account.name)
  return /收入|收益|營業收入|营业收入|销售收入|銷售收入|主营业务收入|主營業務收入|revenue|income|turnover/.test(text)
}

function isCostOfSalesCandidate(account: { code: string; name: string }) {
  const text = normalize(`${account.code} ${account.name}`)
  return (
    /销售成本|銷售成本|主营业务成本|主營業務成本|采购成本|採購成本|costofsales|\bcogs\b|purchasecost/.test(text)
    || /^06/.test(account.code)
    || /^5/.test(account.code)
  )
}

function hasCostOfSalesName(account: { name: string }) {
  const text = normalize(account.name)
  return /销售成本|銷售成本|主营业务成本|主營業務成本|采购成本|採購成本|costofsales|\bcogs\b|purchasecost/.test(text)
}

function isExpenseCandidate(account: { code: string; name: string }) {
  const text = normalize(`${account.code} ${account.name}`)
  return (
    /费用|費用|expense|bankfee|bankcharge|interest|administrative|admin|selling|marketing|promotion|distribution/.test(text)
    || /^(07|08|09)/.test(account.code)
    || /^6/.test(account.code)
  )
}

function hasExpenseName(account: { name: string }) {
  const text = normalize(account.name)
  return /费用|費用|expense|bankfee|bankcharge|interest|administrative|admin|selling|marketing|promotion|distribution/.test(text)
}

function isBalanceSheetType(type: AccountType) {
  return type === 'ASSET'
    || type === 'NON_CURRENT_ASSET'
    || type === 'LIABILITY'
    || type === 'NON_CURRENT_LIABILITY'
    || type === 'EQUITY'
    || type === 'CURRENT_ACCOUNT'
}

export function inferProfitAndLossStatementType(account: {
  type: AccountType
  code: string
  name: string
}): ProfitAndLossStatementType | null {
  if (isProfitAndLossStatementType(account.type)) return account.type
  if (isBalanceSheetType(account.type)) {
    if (hasExpenseName(account)) return 'EXPENSE'
    if (hasCostOfSalesName(account)) return 'CGS'
    if (hasRevenueName(account)) return 'REVENUE'
    return null
  }
  if (isExpenseCandidate(account)) return 'EXPENSE'
  if (isCostOfSalesCandidate(account)) return 'CGS'
  if (isRevenueCandidate(account)) return 'REVENUE'
  return null
}

export function shouldIncludeIncomeStatementLine(input: {
  type: AccountType
  level: number
  topLevelHasChildren: boolean
  periodNet: number
}) {
  if (!PL_STATEMENT_TYPES.has(input.type) || input.periodNet === 0) return false
  if (input.level === 1) return !input.topLevelHasChildren
  return input.level === 2 && input.topLevelHasChildren
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, '')
}

function categoryForCandidate(account: { code: string; name: string }): IncomeStatementExpenseCategoryKey | null {
  const text = normalize(`${account.code} ${account.name}`)

  if (
    /财务费用|財務費用|finance|financial|interest|bankfee|bankcharge|汇兑|匯兌/.test(text)
    || /^(6603|63)/.test(account.code)
  ) {
    return 'finance'
  }

  if (
    /销售费用|銷售費用|营业费用|營業費用|selling|salesexpense|distribution/.test(text)
    || /^(6601|61)/.test(account.code)
  ) {
    return 'sales'
  }

  if (
    /管理费用|管理費用|行政费用|行政費用|administrative|admin|general/.test(text)
    || /^(6602|62|60)/.test(account.code)
  ) {
    return 'administrative'
  }

  return null
}

export function classifyIncomeStatementExpenseCategory(input: {
  account: { code: string; name: string }
  topLevelAccount?: { code: string; name: string } | null
}): IncomeStatementExpenseCategoryKey {
  const candidates = input.topLevelAccount
    ? [input.topLevelAccount, input.account]
    : [input.account]

  for (const candidate of candidates) {
    const category = categoryForCandidate(candidate)
    if (category) return category
  }

  return 'administrative'
}

export function buildIncomeStatementExpenseCategories(
  entries: Array<{ line: StatementLineRow; category: IncomeStatementExpenseCategoryKey }>,
): IncomeStatementExpenseCategory[] {
  return INCOME_STATEMENT_EXPENSE_CATEGORIES.map(definition => {
    const lines = entries
      .filter(entry => entry.category === definition.key)
      .map(entry => entry.line)
    return {
      ...definition,
      lines,
      total: roundMoney(lines.reduce((sum, line) => sum + line.amount, 0)),
      totalYtd: roundMoney(lines.reduce((sum, line) => sum + (line.yearToDateAmount ?? 0), 0)),
    }
  })
}
