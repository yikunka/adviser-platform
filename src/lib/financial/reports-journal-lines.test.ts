import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountType } from '@prisma/client'
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

type ReportAccountFixture = {
  id: string
  code: string
  name: string
  type: AccountType
  level: number
  parentId: string | null
  sortOrder: number
  yearToDateDebit: number
  yearToDateCredit: number
}

const baseReportAccounts: ReportAccountFixture[] = [
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
]

type MovementLineFixture = { accountId: string; debit: number; credit: number }

let reportAccounts: readonly ReportAccountFixture[]
let periodMovementLines: MovementLineFixture[]
let priorMovementLines: MovementLineFixture[]

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
    reportAccounts = baseReportAccounts
    periodMovementLines = [
      { accountId: 'bank', debit: 1000, credit: 0 },
      { accountId: 'rev-child', debit: 0, credit: 1000 },
    ]
    priorMovementLines = []

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
      const isOpeningMovement =
        !entryDate?.gte && entryDate?.lt?.getTime() === start
      const isClosingMovement =
        !entryDate?.gte && entryDate?.lt?.getTime() === end

      if (isPeriodMovement) return periodMovementLines
      if (isOpeningMovement) return priorMovementLines
      if (isClosingMovement) return [...priorMovementLines, ...periodMovementLines]

      return []
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

  it('falls back to active P&L accounts when the monthly movement is not covered by the normal statement level', async () => {
    reportAccounts = [
      baseReportAccounts[0],
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
        id: 'rev-direct-level3',
        code: '400101',
        name: '服務收入',
        type: 'REVENUE',
        level: 3,
        parentId: 'rev-parent',
        sortOrder: 12,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
    ]
    periodMovementLines = [
      { accountId: 'bank', debit: 888, credit: 0 },
      { accountId: 'rev-direct-level3', debit: 0, credit: 888 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.trialBalance.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'rev-direct-level3',
        periodCredit: 888,
      }),
    ]))
    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'rev-direct-level3',
        code: '400101',
        name: '服務收入',
        amount: 888,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(888)
  })

  it('keeps P&L movement direction when debit activity offsets revenue', async () => {
    periodMovementLines = [
      { accountId: 'bank', debit: 0, credit: 200 },
      { accountId: 'rev-child', debit: 200, credit: 0 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'rev-child',
        amount: -200,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(-200)
    expect(reports.incomeStatement.netProfit).toBe(-200)
  })

  it('uses only the selected accounting period movement for the P&L, not cumulative balances', async () => {
    priorMovementLines = [
      { accountId: 'bank', debit: 5000, credit: 0 },
      { accountId: 'rev-child', debit: 0, credit: 5000 },
    ]
    periodMovementLines = [
      { accountId: 'bank', debit: 1200, credit: 0 },
      { accountId: 'rev-child', debit: 0, credit: 1200 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.incomeStatement.totalRevenue).toBe(1200)
    expect(reports.incomeStatement.netProfit).toBe(1200)
    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'rev-child',
        amount: 1200,
      }),
    ])
  })
})
