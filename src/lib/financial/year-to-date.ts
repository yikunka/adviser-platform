import type { AccountType } from '@prisma/client'
import { isDebitNormalAccountType } from '@/lib/financial/account-types'

type YearToDateInput = {
  name?: string | null
  type: AccountType
  code?: string | null
  debit: number
  credit: number
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function isCurrentYearProfitAccountName(name: string | null | undefined) {
  const normalized = (name ?? '').replace(/\s/g, '').toLowerCase()
  return normalized.includes('本年利润') || normalized.includes('本年利潤')
}

export function calculateYearToDateBalance(input: YearToDateInput) {
  const debit = Number(input.debit) || 0
  const credit = Number(input.credit) || 0

  if (isCurrentYearProfitAccountName(input.name)) {
    return roundMoney(credit - debit)
  }

  return roundMoney(
    isDebitNormalAccountType(input.type, input.code ?? undefined)
      ? debit - credit
      : credit - debit,
  )
}

export function calculateYearToDateAmount(input: YearToDateInput) {
  if (isCurrentYearProfitAccountName(input.name)) {
    return calculateYearToDateBalance(input)
  }

  return roundMoney((Number(input.debit) || 0) + (Number(input.credit) || 0))
}
