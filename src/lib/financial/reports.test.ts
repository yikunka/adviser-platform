import { describe, expect, it } from 'vitest'
import { trialBalanceColumns } from './report-balances'

describe('trialBalanceColumns', () => {
  it('places debit-normal positive balances in closing debit', () => {
    expect(trialBalanceColumns(125, 'ASSET')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })

  it('places credit-normal positive balances in closing credit', () => {
    expect(trialBalanceColumns(125, 'LIABILITY')).toEqual({ closingDebit: 0, closingCredit: 125 })
  })

  it('places negative credit-normal balances in closing debit', () => {
    expect(trialBalanceColumns(-125, 'LIABILITY')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })

  it('uses account code for current-account normal direction', () => {
    expect(trialBalanceColumns(125, 'CURRENT_ACCOUNT', '2001')).toEqual({ closingDebit: 0, closingCredit: 125 })
    expect(trialBalanceColumns(125, 'CURRENT_ACCOUNT', '1001')).toEqual({ closingDebit: 125, closingCredit: 0 })
  })
})
