import type { AccountType } from '@prisma/client'

export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: 'ASSET', label: '流动资产' },
  { value: 'NON_CURRENT_ASSET', label: '长期资产' },
  { value: 'LIABILITY', label: '流动负债' },
  { value: 'NON_CURRENT_LIABILITY', label: '长期负债' },
  { value: 'EQUITY', label: '权益' },
  { value: 'REVENUE', label: '收入' },
  { value: 'CGS', label: '销售成本' },
  { value: 'EXPENSE', label: '费用' },
  { value: 'CURRENT_ACCOUNT', label: '往来科目' },
]

export const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPE_OPTIONS.map(option => option.value)

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map(option => [option.value, option.label]),
) as Record<AccountType, string>

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: '#38bdf8',
  NON_CURRENT_ASSET: '#0ea5e9',
  LIABILITY: '#ef4444',
  NON_CURRENT_LIABILITY: '#dc2626',
  EQUITY: '#a855f7',
  REVENUE: '#10b981',
  CGS: '#f97316',
  EXPENSE: '#f59e0b',
  CURRENT_ACCOUNT: '#06b6d4',
}

const CREDIT_NORMAL_TYPES: ReadonlyArray<AccountType> = [
  'LIABILITY',
  'NON_CURRENT_LIABILITY',
  'EQUITY',
  'REVENUE',
]

/** Debit-normal types (assets, expenses, CGS, and current accounts before balance-side classification). */
export function isDebitNormalAccountType(type: AccountType, code?: string) {
  void code
  if (CREDIT_NORMAL_TYPES.includes(type)) return false
  return true
}

export function isProfitAndLossExpenseType(type: AccountType) {
  return type === 'EXPENSE' || type === 'CGS'
}

export function shouldIncludeProfitAndLossExpenseLine(input: {
  type: AccountType
  level: number
  topLevelHasChildren: boolean
  periodNet: number
}) {
  void input.topLevelHasChildren
  // Keep aligned with income-statement display: level-1 only; children roll up.
  if (!isProfitAndLossExpenseType(input.type) || input.periodNet === 0) return false
  return input.level === 1
}

export function isCreditNormalAccountType(type: AccountType, code?: string) {
  return !isDebitNormalAccountType(type, code)
}
