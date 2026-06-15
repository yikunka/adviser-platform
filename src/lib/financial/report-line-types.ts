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
  amount: number
  periodDebit?: number
  periodCredit?: number
}
