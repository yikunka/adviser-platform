import type { AccountType } from '@prisma/client'
import { isDebitNormalAccountType } from '@/lib/financial/account-types'
import { roundMoney } from '@/lib/financial/utils'

export function trialBalanceColumns(balance: number, type: AccountType, code?: string) {
  const normalBalance = roundMoney(balance)
  if (isDebitNormalAccountType(type, code)) {
    if (normalBalance >= 0) return { closingDebit: normalBalance, closingCredit: 0 }
    return { closingDebit: 0, closingCredit: Math.abs(normalBalance) }
  }
  if (normalBalance >= 0) return { closingDebit: 0, closingCredit: normalBalance }
  return { closingDebit: Math.abs(normalBalance), closingCredit: 0 }
}
