import type { AccountType } from '@prisma/client'

export type ReportAccountRow = {
  accountId: string
  parentId?: string | null
  code: string
  name: string
  type: AccountType
  level: number
}

export type StatementLineRow = ReportAccountRow & {
  /** Selected-period statement amount (本期金额 on the income statement). */
  amount: number
  /** Calendar year-to-date statement amount through the selected period (本年度总金额). */
  yearToDateAmount?: number
  periodDebit?: number
  periodCredit?: number
  note?: string
  noteAmount?: number
}
