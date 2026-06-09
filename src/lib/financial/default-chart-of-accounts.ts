import type { AccountType } from '@prisma/client'
import type { prisma } from '@/lib/db/prisma'

type FinAccountDbClient = Pick<typeof prisma, 'finAccount'>

export type DefaultChartAccount = {
  code: string
  name: string
  type: AccountType
  sortOrder: number
}

/** Level-1 HKFRS starter chart seeded when a company has no accounts yet. */
export const DEFAULT_CHART_OF_ACCOUNTS: ReadonlyArray<DefaultChartAccount> = [
  { code: '1001', name: '现金 CASH IN HAND', type: 'ASSET', sortOrder: 1 },
  { code: '1002', name: '银行存款 BANK', type: 'ASSET', sortOrder: 2 },
  { code: '1100', name: '应收账款 ACCOUNTS RECEIVABLE', type: 'ASSET', sortOrder: 10 },
  { code: '1200', name: '存货 INVENTORY', type: 'ASSET', sortOrder: 20 },
  { code: '1300', name: '固定资产 FIXED ASSETS', type: 'NON_CURRENT_ASSET', sortOrder: 30 },
  { code: '2001', name: '应付账款 ACCOUNTS PAYABLE', type: 'LIABILITY', sortOrder: 1 },
  { code: '2100', name: '应交税费 TAXES PAYABLE', type: 'LIABILITY', sortOrder: 10 },
  { code: '2500', name: '长期借款 LONG-TERM BORROWINGS', type: 'NON_CURRENT_LIABILITY', sortOrder: 20 },
  { code: '3001', name: '实收资本 SHARE CAPITAL', type: 'EQUITY', sortOrder: 1 },
  { code: '3100', name: '留存收益 RETAINED EARNINGS', type: 'EQUITY', sortOrder: 10 },
  { code: '4001', name: '营业收入 REVENUE', type: 'REVENUE', sortOrder: 1 },
  { code: '5001', name: '营业成本 COST OF SALES', type: 'CGS', sortOrder: 1 },
  { code: '6001', name: '管理费用 ADMINISTRATIVE EXPENSES', type: 'EXPENSE', sortOrder: 1 },
]

export async function ensureDefaultChartOfAccounts(
  companyId: string,
  client: FinAccountDbClient,
) {
  const existingCount = await client.finAccount.count({ where: { companyId } })
  if (existingCount > 0) return false

  await client.finAccount.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map(account => ({
      companyId,
      code: account.code,
      name: account.name,
      type: account.type,
      level: 1,
      sortOrder: account.sortOrder,
      isSystem: false,
      notes: '',
    })),
  })

  return true
}
