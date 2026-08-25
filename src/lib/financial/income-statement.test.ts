import { describe, expect, it } from 'vitest'
import {
  buildIncomeStatementExpenseCategories,
  classifyIncomeStatementExpenseCategory,
  inferProfitAndLossStatementType,
  shouldIncludeIncomeStatementLine,
} from './income-statement'

describe('inferProfitAndLossStatementType', () => {
  it('does not treat balance-sheet accounts as revenue only because their code starts with 4', () => {
    expect(inferProfitAndLossStatementType({
      type: 'LIABILITY',
      code: '4004',
      name: 'Accruals',
    })).toBeNull()
  })

  it('still recognizes clearly named income statement accounts when imported with a wrong type', () => {
    expect(inferProfitAndLossStatementType({
      type: 'LIABILITY',
      code: '4001',
      name: 'Service Revenue',
    })).toBe('REVENUE')
  })
})

describe('shouldIncludeIncomeStatementLine', () => {
  it('includes top-level revenue when it has no child accounts', () => {
    expect(shouldIncludeIncomeStatementLine({
      type: 'REVENUE',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 1000,
    })).toBe(true)
  })

  it('uses second-level revenue details when the top-level account has children', () => {
    expect(shouldIncludeIncomeStatementLine({
      type: 'REVENUE',
      level: 1,
      topLevelHasChildren: true,
      periodNet: 1000,
    })).toBe(false)

    expect(shouldIncludeIncomeStatementLine({
      type: 'REVENUE',
      level: 2,
      topLevelHasChildren: true,
      periodNet: 1000,
    })).toBe(true)
  })

  it('excludes third-level and zero-movement rows', () => {
    expect(shouldIncludeIncomeStatementLine({
      type: 'REVENUE',
      level: 3,
      topLevelHasChildren: true,
      periodNet: 1000,
    })).toBe(false)

    expect(shouldIncludeIncomeStatementLine({
      type: 'EXPENSE',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 0,
    })).toBe(false)
  })
})

describe('income statement expense categories', () => {
  it('classifies details by their top-level expense account', () => {
    expect(classifyIncomeStatementExpenseCategory({
      account: { code: '610101', name: '广告费' },
      topLevelAccount: { code: '6100', name: '销售费用' },
    })).toBe('sales')

    expect(classifyIncomeStatementExpenseCategory({
      account: { code: '600101', name: '银行手续费' },
      topLevelAccount: { code: '6000', name: '管理费用' },
    })).toBe('administrative')
  })

  it('classifies finance expenses by account name when no parent category is available', () => {
    expect(classifyIncomeStatementExpenseCategory({
      account: { code: '6301', name: '银行手续费 Bank Fees' },
    })).toBe('finance')
  })

  it('builds fixed sales, administrative, and finance subtotals', () => {
    const categories = buildIncomeStatementExpenseCategories([
      {
        category: 'sales',
        line: { accountId: 'sales', code: '6101', name: '销售费用', type: 'EXPENSE', level: 1, amount: 125.12 },
      },
      {
        category: 'administrative',
        line: { accountId: 'admin', code: '6001', name: '管理费用', type: 'EXPENSE', level: 1, amount: 200 },
      },
      {
        category: 'finance',
        line: { accountId: 'finance', code: '6301', name: '财务费用', type: 'EXPENSE', level: 1, amount: 20.335 },
      },
    ])

    expect(categories.map(category => category.label)).toEqual(['销售费用', '管理费用', '财务费用'])
    expect(categories.map(category => category.total)).toEqual([125.12, 200, 20.34])
    expect(categories.map(category => category.totalYtd)).toEqual([0, 0, 0])
  })

  it('sums year-to-date amounts into expense category totalYtd', () => {
    const categories = buildIncomeStatementExpenseCategories([
      {
        category: 'sales',
        line: {
          accountId: 'sales',
          code: '6101',
          name: '销售费用',
          type: 'EXPENSE',
          level: 1,
          amount: 10,
          yearToDateAmount: 40.5,
        },
      },
      {
        category: 'administrative',
        line: {
          accountId: 'admin',
          code: '6001',
          name: '管理费用',
          type: 'EXPENSE',
          level: 1,
          amount: 20,
          yearToDateAmount: 80,
        },
      },
    ])

    expect(categories.find(c => c.key === 'sales')?.totalYtd).toBe(40.5)
    expect(categories.find(c => c.key === 'administrative')?.totalYtd).toBe(80)
    expect(categories.find(c => c.key === 'finance')?.totalYtd).toBe(0)
  })
})
