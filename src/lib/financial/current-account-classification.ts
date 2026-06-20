import { roundMoney } from '@/lib/financial/utils'

export function classifyCurrentAccountBalance(balance: number) {
  const amount = roundMoney(balance)
  if (amount > 0) return { side: 'ASSET' as const, amount }
  if (amount < 0) return { side: 'LIABILITY' as const, amount: Math.abs(amount) }
  return null
}
