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
})

describe('shouldIncludeProfitAndLossExpenseLine', () => {
  it('excludes expense parent accounts that have child accounts', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      hasChildren: true,
      periodNet: 125,
    })).toBe(false)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      hasChildren: true,
      periodNet: 125,
    })).toBe(false)
  })

  it('includes leaf expense and cost-of-sales accounts with period movement', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      hasChildren: false,
      periodNet: 125,
    })).toBe(true)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'CGS',
      hasChildren: false,
      periodNet: 125,
    })).toBe(true)
  })

  it('excludes non-expense accounts and zero movement accounts', () => {
    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'REVENUE',
      hasChildren: false,
      periodNet: 125,
    })).toBe(false)

    expect(shouldIncludeProfitAndLossExpenseLine({
      type: 'EXPENSE',
      hasChildren: false,
      periodNet: 0,
    })).toBe(false)
  })
})
