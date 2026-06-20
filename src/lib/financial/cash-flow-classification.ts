import type { AccountType } from '@prisma/client'

export function isFinancingAccount(account: { type: AccountType; code?: string }) {
  return account.type === 'EQUITY' || account.type === 'NON_CURRENT_LIABILITY'
}
