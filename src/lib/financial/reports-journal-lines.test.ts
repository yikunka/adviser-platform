import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { buildFinancialReports } from './reports'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    accountBalance: { findMany: vi.fn() },
    finAccount: { findMany: vi.fn() },
    journalLine: { findMany: vi.fn() },
  },
}))

const companyId = 'company-cos'
const start = new Date('2026-05-01T00:00:00.000Z').getTime()
const end = new Date('2026-06-01T00:00:00.000Z').getTime()

const reportAccounts = [
  {
    id: 'bank',
    code: '1002',
    name: '银行存款 BANK',
    type: 'ASSET',
    level: 1,
    parentId: null,
    sortOrder: 1,
    yearToDateDebit: 0,
    yearToDateCredit: 0,
  },
  {
    id: 'rev-parent',
    code: '4000',
    name: '收入',
    type: 'REVENUE',
    level: 1,
    parentId: null,
    sortOrder: 10,
    yearToDateDebit: 0,
    yearToDateCredit: 0,
  },
  {
    id: 'rev-child',
    code: '4001',
    name: '主营业务收入',
    type: 'REVENUE',
    level: 2,
    parentId: 'rev-parent',
    sortOrder: 11,
    yearToDateDebit: 0,
    yearToDateCredit: 0,
  },
] as const

type MockFindManyArgs = {
  distinct?: string[]
  select?: Record<string, unknown>
  where?: {
    id?: { in?: string[] }
    entry?: {
      entryDate?: { gte?: Date; lt?: Date }
    }
  }
}

function findManyArgs(args: unknown): MockFindManyArgs {
  return (args ?? {}) as MockFindManyArgs
}

describe('buildFinancialReports journal-line source', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(prisma.accountBalance.findMany).mockResolvedValue([])
    vi.mocked(prisma.finAccount.findMany).mockImplementation((async (args?: unknown) => {
      const query = findManyArgs(args)
      if (query.select?.parentId && !query.select?.code) {
        const ids = new Set(query.where?.id?.in ?? [])
        return reportAccounts
          .filter(account => ids.has(account.id))
          .map(account => ({ id: account.id, parentId: account.parentId }))
      }

      return [...reportAccounts]
    }) as never)
    vi.mocked(prisma.journalLine.findMany).mockImplementation((async (args?: unknown) => {
      const query = findManyArgs(args)
      if (query.distinct) {
        return [{ accountId: 'bank' }, { accountId: 'rev-child' }]
      }

      const entryDate = query.where?.entry?.entryDate
      const isPeriodMovement =
        entryDate?.gte?.getTime() === start && entryDate?.lt?.getTime() === end
      const isClosingMovement =
        !entryDate?.gte && entryDate?.lt?.getTime() === end

      if (!isPeriodMovement && !isClosingMovement) return []

      return [
        { accountId: 'bank', debit: 1000, credit: 0 },
        { accountId: 'rev-child', debit: 0, credit: 1000 },
      ]
    }) as never)
  })

  it('builds P&L from posted journal lines and includes referenced ancestor accounts', async () => {
    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'rev-child',
        code: '4001',
        name: '主营业务收入',
        amount: 1000,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(1000)

    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        entry: expect.objectContaining({
          companyId: { in: [companyId] },
          status: 'POSTED',
        }),
      },
    }))
    expect(prisma.finAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { companyId: { in: [companyId] } },
          { id: { in: expect.arrayContaining(['rev-child', 'rev-parent']) } },
        ]),
      }),
    }))
  })
})
