import type { AccountType } from '@prisma/client'

export type ReportAccountRow = {
  accountId: string
  code: string
  name: string
  type: AccountType
  level: number
}

export type StatementLineRow = ReportAccountRow & {
  amount: number
}
