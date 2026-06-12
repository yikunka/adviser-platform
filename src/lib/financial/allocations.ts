import { roundMoney } from '@/lib/financial/utils'

const EPSILON = 0.005

export type AllocationCheckInput = {
  /** 本次收/付款总额（或贷项总额） */
  sourceAmount: number
  /** 该来源已核销金额（追加核销时） */
  alreadyAllocated?: number
  allocations: Array<{
    label: string // 单据号，用于错误提示
    outstanding: number // 目标单据未结金额
    amount: number // 本次核销金额
  }>
}

/** 核销金额校验：单笔>0、不超过目标未结、合计不超过来源可用额度。 */
export function validateAllocations(input: AllocationCheckInput): string | null {
  const available = roundMoney(input.sourceAmount - (input.alreadyAllocated ?? 0))
  let sum = 0
  for (const allocation of input.allocations) {
    if (allocation.amount <= 0) {
      return `核销金额必须大于零（${allocation.label}）。`
    }
    if (allocation.amount > allocation.outstanding + EPSILON) {
      return `核销金额超过单据未结金额（${allocation.label}：未结 ${roundMoney(allocation.outstanding)}）。`
    }
    sum = roundMoney(sum + allocation.amount)
  }
  if (sum > available + EPSILON) {
    return `核销合计 ${sum} 超过可用金额 ${available}。`
  }
  return null
}

/** 结算状态推导（发票/账单共用）：未收 → 部分 → 已结清。 */
export function settlementProgress(total: number, amountPaid: number) {
  const outstanding = roundMoney(total - amountPaid)
  if (amountPaid <= EPSILON) return { outstanding, settled: 'NONE' as const }
  if (outstanding <= EPSILON) return { outstanding: 0, settled: 'FULL' as const }
  return { outstanding, settled: 'PARTIAL' as const }
}
