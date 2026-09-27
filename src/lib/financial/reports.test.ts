import { describe, expect, it } from 'vitest'
import { shouldIncludeProfitAndLossExpenseLine } from './account-types'
import { isFinancingAccount } from './cash-flow-classification'
import { classifyCurrentAccountBalance } from './current-account-classification'
import { trialBalanceColumns } from './report-balances'

describe('trialBalanceColumns', () => {
  it('places debit-normal positive balances in closing debit', () => {
    expect(trialBalanceColumns(125, 'ASSET')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })

  it('places credit-normal positive balances in closing credit', () => {
    expect(trialBalanceColumns(125, 'LIABILITY')).toEqual({ closingDebit: 0, closingCredit: 125 })
    expect(trialBalanceColumns(125, 'NON_CURRENT_LIABILITY')).toEqual({ closingDebit: 0, closingCredit: 125 })
    expect(trialBalanceColumns(125, 'NON_CURRENT_ASSET')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })

  it('places negative credit-normal balances in closing debit', () => {
    expect(trialBalanceColumns(-125, 'LIABILITY')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })

  it('uses balance direction rather than account code for current-account columns', () => {
    expect(trialBalanceColumns(125, 'CURRENT_ACCOUNT', '2001')).toEqual({ closingDebit: 125, closingCredit: 0 })
    expect(trialBalanceColumns(-125, 'CURRENT_ACCOUNT', '1001')).toEqual({ closingDebit: 0, closingCredit: 125 })
  })

  it('shows rounded zero balances as zero columns without negative zero', () => {
    const columns = trialBalanceColumns(-0.004, 'CURRENT_ACCOUNT', '22020086')

    expect(columns).toEqual({ closingDebit: 0, closingCredit: 0 })
    expect(Object.is(columns.closingDebit, -0)).toBe(false)
    expect(Object.is(columns.closingCredit, -0)).toBe(false)
  })
})

describe('shouldIncludeProfitAndLossExpenseLine', () => {
  it('includes level-1 expense and cost-of-sales accounts with movement', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 1,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(true)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 125,
    })).toBe(true)
  })

  it('excludes level-2+ expense and cost-of-sales detail rows', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 2,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(false)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      level: 2,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(false)
  })

  it('excludes third-level details, non-expense accounts, and zero movement accounts', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 3,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(false)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'REVENUE',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 125,
    })).toBe(false)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 0,
    })).toBe(false)
  })
})

describe('isFinancingAccount', () => {
  it('uses account type rather than liability code range for financing classification', () => {
    expect(isFinancingAccount({ code: '2500', type: 'LIABILITY' })).toBe(false)
    expect(isFinancingAccount({ code: '2500', type: 'NON_CURRENT_LIABILITY' })).toBe(true)
    expect(isFinancingAccount({ code: '4004', type: 'LIABILITY' })).toBe(false)
  })
})

describe('classifyCurrentAccountBalance', () => {
  it('classifies debit balances as current assets and credit balances as current liabilities', () => {
    expect(classifyCurrentAccountBalance(125)).toEqual({ side: 'ASSET', amount: 125 })
    expect(classifyCurrentAccountBalance(-125)).toEqual({ side: 'LIABILITY', amount: 125 })
    expect(classifyCurrentAccountBalance(0)).toBeNull()
  })
})
