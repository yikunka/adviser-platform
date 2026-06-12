import { roundMoney } from '@/lib/financial/utils'

export type StatementEventType =
  | 'SALES_INVOICE'
  | 'RECEIPT'
  | 'CREDIT_NOTE'
  | 'PURCHASE_BILL'
  | 'BILL_PAYMENT'
  | 'DEBIT_NOTE'

export const STATEMENT_EVENT_LABELS: Record<StatementEventType, string> = {
  SALES_INVOICE: '销售发票',
  RECEIPT: '收款',
  CREDIT_NOTE: '贷项通知单',
  PURCHASE_BILL: '采购账单',
  BILL_PAYMENT: '付款',
  DEBIT_NOTE: '借项通知单',
}

export type StatementEvent = {
  date: Date
  type: StatementEventType
  docNo: string
  description: string
  /** 增加往来余额的金额（客户：发票；供应商：账单） */
  charge: number
  /** 减少往来余额的金额（收/付款、贷项/借项） */
  settle: number
}

export type StatementRow = StatementEvent & { balance: number }

/**
 * 往来对账单：按日期（同日按单号）排序，逐行滚动余额。
 * 客户视角余额 = 未收；供应商视角余额 = 未付。
 */
export function buildPartyStatement(events: StatementEvent[]): {
  rows: StatementRow[]
  closingBalance: number
  totalCharged: number
  totalSettled: number
} {
  const sorted = events.slice().sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime()
    if (dateDiff !== 0) return dateDiff
    return a.docNo.localeCompare(b.docNo)
  })

  let balance = 0
  let totalCharged = 0
  let totalSettled = 0
  const rows = sorted.map(event => {
    balance = roundMoney(balance + event.charge - event.settle)
    totalCharged = roundMoney(totalCharged + event.charge)
    totalSettled = roundMoney(totalSettled + event.settle)
    return { ...event, balance }
  })

  return { rows, closingBalance: balance, totalCharged, totalSettled }
}
