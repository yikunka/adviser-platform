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
  { code: '01', name: '现金与银行', type: 'ASSET', sortOrder: 1 },
  { code: '02', name: '应收', type: 'ASSET', sortOrder: 2 },
  { code: '03', name: '应付', type: 'LIABILITY', sortOrder: 3 },
  { code: '04', name: '权益', type: 'EQUITY', sortOrder: 4 },
  { code: '05', name: '收入', type: 'REVENUE', sortOrder: 5 },
  { code: '06', name: '成本', type: 'CGS', sortOrder: 6 },
  { code: '07', name: '行政费用', type: 'EXPENSE', sortOrder: 7 },
  { code: '08', name: '销售费用', type: 'EXPENSE', sortOrder: 8 },
  { code: '09', name: '财务费用', type: 'EXPENSE', sortOrder: 9 },
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
