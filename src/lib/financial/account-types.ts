import type { AccountType } from '@prisma/client'

export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'CGS', label: 'CGS (Cost of Goods Sold)' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'CURRENT_ACCOUNT', label: 'C/A Account (Current Account)' },
]

export const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPE_OPTIONS.map(option => option.value)

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: '#38bdf8',
  LIABILITY: '#ef4444',
  EQUITY: '#a855f7',
  REVENUE: '#10b981',
  CGS: '#f97316',
  EXPENSE: '#f59e0b',
  CURRENT_ACCOUNT: '#06b6d4',
}

/** Debit-normal types (ASSET, EXPENSE, CGS, and receivable-style C/A). */
export function isDebitNormalAccountType(type: AccountType, code?: string) {
  if (type === 'CURRENT_ACCOUNT' && code && /^2/.test(code)) return false
  if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(type)) return false
  return true
}

export function isProfitAndLossExpenseType(type: AccountType) {
  return type === 'EXPENSE' || type === 'CGS'
}
