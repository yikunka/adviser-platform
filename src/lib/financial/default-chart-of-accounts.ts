import type { AccountType } from '@prisma/client'
import type { prisma } from '@/lib/db/prisma'

type FinAccountDbClient = Pick<typeof prisma, 'finAccount'>

export type DefaultChartAccount = {
  code: string
  name: string
  type: AccountType
  sortOrder: number
  parentCode?: string
}

/** HKFRS starter chart seeded when a company has no accounts yet. */
export const DEFAULT_CHART_OF_ACCOUNTS: ReadonlyArray<DefaultChartAccount> = [
  { code: '01', name: '现金与银行', type: 'ASSET', sortOrder: 1 },
  { code: '02', name: '应收', type: 'ASSET', sortOrder: 2 },
  { code: '03', name: '应付', type: 'LIABILITY', sortOrder: 3 },
  { code: '04', name: '权益', type: 'EQUITY', sortOrder: 4 },
  { code: '0401', name: '本年利润', type: 'EQUITY', sortOrder: 401, parentCode: '04' },
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
    data: DEFAULT_CHART_OF_ACCOUNTS
      .filter(account => !account.parentCode)
      .map(account => ({
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
  const parentAccounts = await client.finAccount.findMany({
    where: {
      companyId,
      code: { in: DEFAULT_CHART_OF_ACCOUNTS.map(account => account.parentCode).filter((code): code is string => Boolean(code)) },
    },
    select: { id: true, code: true, level: true },
  })
  const parentByCode = new Map(parentAccounts.map(account => [account.code, account]))
  const childAccounts = DEFAULT_CHART_OF_ACCOUNTS.filter(account => account.parentCode)
  if (childAccounts.length > 0) {
    await client.finAccount.createMany({
      data: childAccounts.map(account => {
        const parent = parentByCode.get(account.parentCode!)
        if (!parent) throw new Error(`Default account parent ${account.parentCode} was not created.`)
        return {
          companyId,
          code: account.code,
          name: account.name,
          type: account.type,
          parentId: parent.id,
          level: parent.level + 1,
          sortOrder: account.sortOrder,
          isSystem: false,
          notes: '',
        }
      }),
    })
  }

  return true
}
