import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma, type AccountType } from '@prisma/client'
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
type ReportAccountFixture = {
  id: string
  code: string
  name: string
  type: AccountType
  level: number
  parentId: string | null
  sortOrder: number
  yearToDateAmount?: number
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
      period?: { gte?: string; gt?: string; lte?: string; lt?: string }
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

      const period = query.where?.entry?.period
      const isPeriodMovement =
        period?.gte === '2026-05' && period?.lt === '2026-06'
      const isOpeningMovement =
        !period?.gte && period?.lt === '2026-05'
      const isClosingMovement =
        !period?.gte && period?.lt === '2026-06'

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
        periodDebit: 0,
        periodCredit: 1000,
        amount: 1000,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(1000)
    expect(reports.trialBalance.rows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'current-year-earnings',
      }),
    ]))
    expect(reports.balanceSheet.equity).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '3999' }),
    ]))
    expect(reports.balanceSheet.equitySection.lines).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '3999' }),
    ]))
    expect(reports.balanceSheet.totalEquity).toBe(1000)

    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        entry: expect.objectContaining({
          companyId: { in: [companyId] },
          period: { lte: '2026-05' },
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

  it('builds P&L from trial-balance movement accounts even when legacy account types are wrong', async () => {
    reportAccounts = [
      baseReportAccounts[0],
      {
        id: 'legacy-rev-parent',
        code: '05',
        name: '收入',
        type: 'ASSET',
        level: 1,
        parentId: null,
        sortOrder: 10,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
      {
        id: 'legacy-rev-child',
        code: '0501',
        name: '服务收入',
        type: 'ASSET',
        level: 2,
        parentId: 'legacy-rev-parent',
        sortOrder: 11,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
      {
        id: 'legacy-expense',
        code: '0701',
        name: '行政费用',
        type: 'ASSET',
        level: 1,
        parentId: null,
        sortOrder: 20,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
    ]
    periodMovementLines = [
      { accountId: 'bank', debit: 700, credit: 120 },
      { accountId: 'legacy-rev-child', debit: 0, credit: 700 },
      { accountId: 'legacy-expense', debit: 120, credit: 0 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.trialBalance.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'legacy-rev-child',
        periodCredit: 700,
      }),
      expect.objectContaining({
        accountId: 'legacy-expense',
        periodDebit: 120,
      }),
    ]))
    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'legacy-rev-child',
        code: '0501',
        type: 'REVENUE',
        periodDebit: 0,
        periodCredit: 700,
        amount: 700,
      }),
    ])
    expect(reports.incomeStatement.expenses).toEqual([
      expect.objectContaining({
        accountId: 'legacy-expense',
        code: '0701',
        type: 'EXPENSE',
        periodDebit: 120,
        periodCredit: 0,
        amount: 120,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(700)
    expect(reports.incomeStatement.totalExpenses).toBe(120)
    expect(reports.incomeStatement.netProfit).toBe(580)
  })

  it('uses legacy yearToDateAmount for P&L when explicit year-to-date debit and credit are empty', async () => {
    reportAccounts = [
      baseReportAccounts[0],
      {
        id: 'legacy-ytd-rev',
        code: '4001',
        name: '服務收入',
        type: 'REVENUE',
        level: 1,
        parentId: null,
        sortOrder: 10,
        yearToDateAmount: 930,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
    ]
    periodMovementLines = []

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'legacy-ytd-rev',
        periodDebit: 0,
        periodCredit: 930,
        amount: 930,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(930)
  })

  it('uses account-balance closing amounts for P&L when imported balances have no journal movement', async () => {
    periodMovementLines = []
    vi.mocked(prisma.accountBalance.findMany).mockResolvedValue([
      {
        id: 'balance-rev-child',
        accountId: 'rev-child',
        period: '2026-05',
        openingDebit: new Prisma.Decimal(0),
        openingCredit: new Prisma.Decimal(0),
        closingDebit: new Prisma.Decimal(0),
        closingCredit: new Prisma.Decimal(640),
        endingBalance: new Prisma.Decimal(640),
      },
    ])

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.trialBalance.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'rev-parent',
        closingCredit: 640,
      }),
      expect.objectContaining({
        accountId: 'rev-child',
        closingCredit: 640,
      }),
    ]))
    expect(reports.incomeStatement.revenue).toEqual([
      expect.objectContaining({
        accountId: 'rev-child',
        periodDebit: 0,
        periodCredit: 640,
        amount: 640,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(640)
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
        periodDebit: 200,
        periodCredit: 0,
        amount: -200,
      }),
    ])
    expect(reports.incomeStatement.totalRevenue).toBe(-200)
    expect(reports.incomeStatement.netProfit).toBe(-200)
  })

  it('keeps credit-balance asset accounts in the asset section as negative balances', async () => {
    periodMovementLines = [
      { accountId: 'bank', debit: 0, credit: 10193.9 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })
    const currentAssets = reports.balanceSheet.assetSections.find(section => section.label === '流动资产')
    const currentLiabilities = reports.balanceSheet.liabilitySections.find(section => section.label === '流动负债')

    expect(currentAssets?.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'bank',
        amount: -10193.9,
      }),
    ]))
    expect(currentLiabilities?.lines).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'bank' }),
    ]))
  })

  it('includes current-period profit in the visible current-year-profit equity line', async () => {
    reportAccounts = [
      ...baseReportAccounts,
      {
        id: 'current-year-profit',
        code: '8003',
        name: 'Current Year Profit',
        type: 'EQUITY',
        level: 1,
        parentId: null,
        sortOrder: 30,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
    ]
    periodMovementLines = [
      { accountId: 'bank', debit: 1000, credit: 0 },
      { accountId: 'rev-child', debit: 0, credit: 1000 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })
    const equityLineSum = reports.balanceSheet.equitySection.lines.reduce((sum, line) => sum + line.amount, 0)

    expect(reports.balanceSheet.equitySection.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'current-year-profit',
        amount: 1000,
      }),
    ]))
    expect(reports.balanceSheet.equitySection.total).toBe(equityLineSum)
    expect(reports.balanceSheet.totalEquity).toBe(equityLineSum)
  })

  it('rolls current-period profit into a nested current-year-profit equity account and its parent summary', async () => {
    reportAccounts = [
      ...baseReportAccounts,
      {
        id: 'equity-parent',
        code: '8000',
        name: 'Equity',
        type: 'EQUITY',
        level: 1,
        parentId: null,
        sortOrder: 30,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
      {
        id: 'current-year-profit',
        code: '8003',
        name: 'Current Year Profit',
        type: 'EQUITY',
        level: 2,
        parentId: 'equity-parent',
        sortOrder: 31,
        yearToDateDebit: 0,
        yearToDateCredit: 0,
      },
    ]
    periodMovementLines = [
      { accountId: 'bank', debit: 1000, credit: 0 },
      { accountId: 'rev-child', debit: 0, credit: 1000 },
    ]

    const reports = await buildFinancialReports('2026-05', { companyId })

    expect(reports.balanceSheet.equitySection.lines).toEqual([
      expect.objectContaining({
        accountId: 'equity-parent',
        amount: 1000,
        children: [
          expect.objectContaining({
            accountId: 'current-year-profit',
            amount: 1000,
          }),
        ],
      }),
    ])
    expect(reports.balanceSheet.equitySection.total).toBe(1000)
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
        periodDebit: 0,
        periodCredit: 1200,
        amount: 1200,
      }),
    ])
  })

  it('filters movements by accounting period instead of entry date ranges', async () => {
    await buildFinancialReports('2026-05', { companyId })

    expect(prisma.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        entry: expect.objectContaining({
          period: { gte: '2026-05', lt: '2026-06' },
          status: 'POSTED',
        }),
      },
    }))
    expect(prisma.journalLine.findMany).not.toHaveBeenCalledWith(expect.objectContaining({
      where: {
        entry: expect.objectContaining({
          entryDate: expect.anything(),
        }),
      },
    }))
  })
})
