import { describe, expect, it } from 'vitest'
import { shouldIncludeAccountInTrialBalance } from './trial-balance-inclusion'

describe('shouldIncludeAccountInTrialBalance', () => {
  const empty = { debit: 0, credit: 0 }

  it('includes parent accounts with rolled-up descendant ledger activity', () => {
    expect(shouldIncludeAccountInTrialBalance({
      periodTotals: { debit: 50, credit: 150 },
      openingTotals: empty,
      closingBalance: 100,
      yearToDateTotals: { debit: 50, credit: 150, balance: 100 },
    })).toBe(true)
  })

  it('includes current-year profit accounts with year-to-date balances but no ledger activity', () => {
    expect(shouldIncludeAccountInTrialBalance({
      periodTotals: empty,
      openingTotals: empty,
      closingBalance: 700,
      yearToDateTotals: { debit: 200, credit: 900, balance: 700 },
    })).toBe(true)
  })

  it('excludes accounts with no ledger, opening, closing, or year-to-date activity', () => {
    expect(shouldIncludeAccountInTrialBalance({
      periodTotals: empty,
      openingTotals: empty,
      closingBalance: 0,
      yearToDateTotals: { debit: 0, credit: 0, balance: 0 },
    })).toBe(false)
  })
})
