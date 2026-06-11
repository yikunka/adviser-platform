import { describe, expect, it } from 'vitest'
import { shouldIncludeProfitAndLossExpenseLine } from './account-types'
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

  it('uses account code for current-account normal direction', () => {
    expect(trialBalanceColumns(125, 'CURRENT_ACCOUNT', '2001')).toEqual({ closingDebit: 0, closingCredit: 125 })
    expect(trialBalanceColumns(125, 'CURRENT_ACCOUNT', '1001')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })

  it('shows rounded zero balances as zero columns without negative zero', () => {
    const columns = trialBalanceColumns(-0.004, 'CURRENT_ACCOUNT', '22020086')

    expect(columns).toEqual({ closingDebit: 0, closingCredit: 0 })
    expect(Object.is(columns.closingDebit, -0)).toBe(false)
    expect(Object.is(columns.closingCredit, -0)).toBe(false)
  })
})

describe('shouldIncludeProfitAndLossExpenseLine', () => {
  it('excludes top-level expense and cost-of-sales accounts when they have second-level accounts', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 1,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(false)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      level: 1,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(false)
  })

  it('includes second-level expense and cost-of-sales accounts when top-level accounts have children', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 2,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(true)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      level: 2,
      topLevelHasChildren: true,
      periodNet: 125,
    })).toBe(true)
  })

  it('includes top-level expense and cost-of-sales accounts when they have no second-level accounts', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 125,
    })).toBe(true)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      level: 1,
      topLevelHasChildren: false,
      periodNet: 125,
    })).toBe(true)
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
