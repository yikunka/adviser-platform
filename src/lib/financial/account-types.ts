import type { AccountType } from '@prisma/client'

export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: 'ASSET', label: '资产' },
  { value: 'LIABILITY', label: '负债' },
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
