import { describe, expect, it } from 'vitest'
import {
  buildIncomeStatementDisplayRows,
  formatPctOfRevenue,
} from './income-statement-display'
import type { IncomeStatementReport } from './reports'

function sampleStatement(): IncomeStatementReport {
  return {
    period: '2026-05',
    currency: 'HKD',
    standard: 'HKFRS',
    revenue: [
      {
        accountId: 'r1',
        code: '05',
        name: '主营业务收入',
        type: 'REVENUE',
        level: 1,
        amount: 100000,
        yearToDateAmount: 400000,
      },
    ],
    costOfSales: [
      {
        accountId: 'c1',
        code: '06',
        name: '主营业务成本',
        type: 'CGS',
        level: 1,
        amount: 40000,
        yearToDateAmount: 160000,
      },
    ],
    expenses: [],
    expenseCategories: [
      {
        key: 'administrative',
        label: '管理费用',
        total: 10000,
        totalYtd: 50000,
        lines: [
          {
            accountId: 'e1',
            code: '07',
            name: '办公费',
            type: 'EXPENSE',
            level: 1,
            amount: 10000,
            yearToDateAmount: 50000,
          },
        ],
      },
    ],
    totalRevenue: 100000,
    totalCostOfSales: 40000,
    grossProfit: 60000,
    totalExpenses: 10000,
    netProfit: 50000,
    totalRevenueYtd: 400000,
    totalCostOfSalesYtd: 160000,
    grossProfitYtd: 240000,
    totalExpensesYtd: 50000,
    netProfitYtd: 190000,
  }
}

describe('income statement display', () => {
  it('builds a continuous waterfall with milestones and expense groups', () => {
    const rows = buildIncomeStatementDisplayRows(sampleStatement())
    expect(rows.some(row => row.kind === 'section' && row.label === '营业收入')).toBe(true)
    expect(rows.some(row => row.kind === 'milestone' && row.label === '毛利')).toBe(true)
    expect(rows.some(row => row.kind === 'expense-group' && row.label === '管理费用')).toBe(true)
    expect(rows.some(row => row.kind === 'milestone' && row.label === '本期利润')).toBe(true)
  })

  it('formats percent of revenue', () => {
    expect(formatPctOfRevenue(60000, 100000)).toBe('60.0%')
    expect(formatPctOfRevenue(10, 0)).toBe('—')
  })
})
