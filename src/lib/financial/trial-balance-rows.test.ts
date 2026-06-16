import { describe, expect, it } from 'vitest'
import type { TrialBalanceDisplayRow } from './trial-balance-rows'
import {
  assembleTrialBalanceRows,
  buildLevel1GroupingMaps,
  calculateTrialBalanceLevel1Totals,
} from './trial-balance-rows'

function detailRow(overrides: Partial<TrialBalanceDisplayRow> & Pick<TrialBalanceDisplayRow, 'accountId' | 'code' | 'name'>): TrialBalanceDisplayRow {
  return {
    type: 'ASSET',
    level: 2,
    sortOrder: 10,
    periodDebit: 100,
    periodCredit: 0,
    closingDebit: 100,
    closingCredit: 0,
    ...overrides,
  }
}

describe('buildLevel1GroupingMaps', () => {
  const rawAccounts = [
    { id: 'a1', parentId: null, level: 1, sortOrder: 1, code: '1000' },
    { id: 'a2', parentId: 'a1', level: 2, sortOrder: 2, code: '1001' },
    { id: 'a3', parentId: 'a1', level: 2, sortOrder: 3, code: '1002' },
    { id: 'b1', parentId: null, level: 1, sortOrder: 4, code: '2000' },
  ]

  it('maps detail accounts to their level-1 ancestor', () => {
    const maps = buildLevel1GroupingMaps(rawAccounts, [
      { accountId: 'a2', code: '1001' },
      { accountId: 'a3', code: '1002' },
    ])

    expect(maps.level1AccountIdByReportAccountId.get('a2')).toBe('a1')
    expect(maps.level1AccountIdByReportAccountId.get('a3')).toBe('a1')
    expect(maps.level1SortOrderById.get('a1')).toBe(1)
  })
})

describe('assembleTrialBalanceRows', () => {
  const rawAccounts = [
    { id: 'a1', parentId: null, level: 1, sortOrder: 1, code: '1000' },
    { id: 'a2', parentId: 'a1', level: 2, sortOrder: 2, code: '1001' },
    { id: 'a3', parentId: 'a1', level: 2, sortOrder: 3, code: '1002' },
    { id: 'b1', parentId: null, level: 1, sortOrder: 4, code: '2000' },
  ]
  const maps = buildLevel1GroupingMaps(rawAccounts, [
    { accountId: 'a2', code: '1001' },
    { accountId: 'a3', code: '1002' },
    { accountId: 'b1', code: '2000' },
  ])

  it('places level-1 summary rows before their detail accounts', () => {
    const summaryRowsByLevel1Id = new Map<string, TrialBalanceDisplayRow>([
      ['a1', {
        accountId: 'a1',
        code: '1000',
        name: '流动资产',
        type: 'ASSET',
        level: 1,
        sortOrder: 1,
        periodDebit: 300,
        periodCredit: 0,
        closingDebit: 300,
        closingCredit: 0,
        isSummary: true,
      }],
    ])

    const rows = assembleTrialBalanceRows({
      detailRows: [
        detailRow({ accountId: 'a3', code: '1002', name: '银行存款', sortOrder: 3, closingDebit: 200 }),
        detailRow({ accountId: 'a2', code: '1001', name: '现金', sortOrder: 2, closingDebit: 100 }),
        detailRow({ accountId: 'b1', code: '2000', name: '流动负债', level: 1, type: 'LIABILITY', closingCredit: 50, closingDebit: 0, periodCredit: 50 }),
      ],
      summaryRowsByLevel1Id,
      level1AccountIdByReportAccountId: maps.level1AccountIdByReportAccountId,
      level1SortOrderById: maps.level1SortOrderById,
    })

    expect(rows.map(row => row.code)).toEqual(['1000', '1001', '1002', '2000'])
    expect(rows[0]?.isSummary).toBe(true)
  })

  it('keeps computed rows at the end', () => {
    const rows = assembleTrialBalanceRows({
      detailRows: [
        detailRow({ accountId: 'a2', code: '1001', name: '现金' }),
        {
          accountId: 'computed-adjustment',
          code: '——',
          name: 'Computed adjustment',
          type: 'EQUITY',
          level: 1,
          sortOrder: 999999,
          periodDebit: 0,
          periodCredit: 0,
          closingDebit: 0,
          closingCredit: 500,
          isComputed: true,
        },
      ],
      summaryRowsByLevel1Id: new Map(),
      level1AccountIdByReportAccountId: maps.level1AccountIdByReportAccountId,
      level1SortOrderById: maps.level1SortOrderById,
    })

    expect(rows.at(-1)?.isComputed).toBe(true)
  })
})

describe('calculateTrialBalanceLevel1Totals', () => {
  it('counts only level-1 rows and ignores descendant detail rows', () => {
    const rows: TrialBalanceDisplayRow[] = [
      detailRow({
        accountId: 'a1',
        code: '1000',
        name: '流动资产',
        level: 1,
        closingDebit: 300,
        closingCredit: 0,
        isSummary: true,
      }),
      detailRow({ accountId: 'a2', code: '1001', name: '现金', level: 2, closingDebit: 100 }),
      detailRow({ accountId: 'a3', code: '1002', name: '银行存款', level: 3, closingDebit: 200 }),
      detailRow({
        accountId: 'b1',
        code: '2000',
        name: '流动负债',
        level: 1,
        type: 'LIABILITY',
        closingDebit: 0,
        closingCredit: 300,
      }),
      detailRow({
        accountId: 'computed-adjustment',
        code: '——',
        name: 'Computed adjustment',
        level: 1,
        type: 'EQUITY',
        closingDebit: 0,
        closingCredit: 100,
        isComputed: true,
      }),
    ]

    expect(calculateTrialBalanceLevel1Totals(rows)).toEqual({
      totalDebit: 300,
      totalCredit: 300,
    })
  })
})
