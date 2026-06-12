import { describe, expect, it } from 'vitest'
import { buildDimensionPlReport, isPlAccountType, type DimensionPlLineInput } from './dimension-pl'

function line(overrides: Partial<DimensionPlLineInput>): DimensionPlLineInput {
  return {
    dimensionId: 'cc1',
    dimensionCode: 'CC01',
    dimensionName: '销售部',
    accountType: 'REVENUE',
    accountCode: '4001',
    debit: 0,
    credit: 0,
    ...overrides,
  }
}

describe('dimension P&L', () => {
  it('only counts P&L account types', () => {
    expect(isPlAccountType('REVENUE')).toBe(true)
    expect(isPlAccountType('EXPENSE')).toBe(true)
    expect(isPlAccountType('CGS')).toBe(true)
    expect(isPlAccountType('ASSET')).toBe(false)
    expect(isPlAccountType('LIABILITY')).toBe(false)
  })

  it('aggregates revenue/cost/expense per dimension and computes profit', () => {
    const report = buildDimensionPlReport([
      line({ accountType: 'REVENUE', accountCode: '4001', credit: 1000 }),
      line({ accountType: 'CGS', accountCode: '5001', debit: 300 }),
      line({ accountType: 'EXPENSE', accountCode: '6001', debit: 200 }),
      line({ dimensionId: 'cc2', dimensionCode: 'CC02', dimensionName: '市场部', accountType: 'EXPENSE', accountCode: '6001', debit: 150 }),
      // 资产类不计入
      line({ accountType: 'ASSET', accountCode: '1001', debit: 999 }),
    ])

    const sales = report.rows.find(r => r.dimensionId === 'cc1')!
    expect(sales.revenue).toBe(1000)
    expect(sales.costOfSales).toBe(300)
    expect(sales.expense).toBe(200)
    expect(sales.profit).toBe(500)

    const marketing = report.rows.find(r => r.dimensionId === 'cc2')!
    expect(marketing.expense).toBe(150)
    expect(marketing.profit).toBe(-150)

    expect(report.totals.revenue).toBe(1000)
    expect(report.totals.profit).toBe(350)
  })

  it('groups unassigned lines and sorts them last', () => {
    const report = buildDimensionPlReport([
      line({ dimensionId: null, accountType: 'REVENUE', credit: 500 }),
      line({ dimensionId: 'cc1', dimensionCode: 'CC01', accountType: 'REVENUE', credit: 800 }),
    ])
    expect(report.rows).toHaveLength(2)
    expect(report.rows[0]!.dimensionId).toBe('cc1')
    expect(report.rows[1]!.dimensionId).toBeNull()
    expect(report.rows[1]!.dimensionName).toBe('未分配')
    expect(report.rows[1]!.revenue).toBe(500)
  })

  it('handles revenue contra (debit reduces revenue)', () => {
    const report = buildDimensionPlReport([
      line({ accountType: 'REVENUE', credit: 1000 }),
      line({ accountType: 'REVENUE', debit: 100 }), // 销售退回
    ])
    expect(report.rows[0]!.revenue).toBe(900)
  })
})
