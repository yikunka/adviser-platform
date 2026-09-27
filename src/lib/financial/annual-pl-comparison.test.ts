import { describe, expect, it } from 'vitest'
import {
  buildAnnualPlComparisonExcelRows,
  buildAnnualPlComparisonRows,
  sumAnnualPlMonths,
  yearMonths,
  type AnnualPlComparisonReport,
  type AnnualPlMonthSummary,
} from './annual-pl-comparison'

describe('yearMonths', () => {
  it('returns twelve YYYY-MM periods for the calendar year', () => {
    expect(yearMonths(2026)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08',
      '2026-09', '2026-10', '2026-11', '2026-12',
    ])
  })
})

describe('buildAnnualPlComparisonRows', () => {
  it('builds summary rows with year totals as the sum of monthly period amounts', () => {
    const months: AnnualPlMonthSummary[] = Array.from({ length: 12 }, (_, index) => ({
      period: `2026-${String(index + 1).padStart(2, '0')}`,
      totalRevenue: index === 0 ? 100 : index === 1 ? 50 : 0,
      totalCostOfSales: index === 0 ? 40 : 0,
      grossProfit: index === 0 ? 60 : index === 1 ? 50 : 0,
      totalExpenses: index === 0 ? 10 : 0,
      netProfit: index === 0 ? 50 : index === 1 ? 50 : 0,
    }))

    const rows = buildAnnualPlComparisonRows(months)

    expect(rows.map(row => row.label)).toEqual([
      '营业收入',
      '营业成本',
      '毛利',
      '营业费用',
      '本期利润',
    ])
    expect(rows.find(row => row.key === 'totalRevenue')?.yearTotal).toBe(150)
    expect(rows.find(row => row.key === 'netProfit')?.yearTotal).toBe(100)
    expect(sumAnnualPlMonths([1.005, 2.005])).toBe(3.01)
  })
})

describe('buildAnnualPlComparisonExcelRows', () => {
  it('builds a single-sheet matrix with month columns and year total', () => {
    const report: AnnualPlComparisonReport = {
      year: 2026,
      currency: 'HKD',
      standard: 'HKFRS',
      periods: yearMonths(2026),
      rows: [
        {
          key: 'totalRevenue',
          label: '营业收入',
          months: [100, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          yearTotal: 150,
        },
      ],
      generatedAt: '2026-09-27T00:00:00.000Z',
    }

    const excelRows = buildAnnualPlComparisonExcelRows(report)
    expect(excelRows[0]?.[0]).toBe('项目')
    expect(excelRows[0]?.[1]).toBe('1月')
    expect(excelRows[0]?.[13]).toBe('全年合计')
    expect(excelRows[1]).toEqual(['营业收入', 100, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 150])
  })
})
