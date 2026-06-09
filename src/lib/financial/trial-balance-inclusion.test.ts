import { describe, expect, it } from 'vitest'
import { isLevel1AccountWithChildren, shouldIncludeAccountInTrialBalance, shouldShowLevel1SummaryInTrialBalance } from './trial-balance-inclusion'

describe('isLevel1AccountWithChildren', () => {
  it('identifies level-1 accounts with sub-accounts', () => {
    expect(isLevel1AccountWithChildren(1, true)).toBe(true)
    expect(isLevel1AccountWithChildren(1, false)).toBe(false)
    expect(isLevel1AccountWithChildren(2, true)).toBe(false)
  })
})

describe('shouldIncludeAccountInTrialBalance', () => {
  const empty = { debit: 0, credit: 0 }
  const active = {
    level: 2,
    hasChildren: false,
    periodTotals: { debit: 50, credit: 150 },
    openingTotals: empty,
    closingBalance: 100,
    yearToDateTotals: { debit: 50, credit: 150, balance: 100 },
  }

  it('includes parent accounts with rolled-up descendant ledger activity', () => {
    expect(shouldIncludeAccountInTrialBalance(active)).toBe(true)
  })

  it('excludes level-1 accounts that have sub-accounts even with rolled-up activity', () => {
    expect(shouldIncludeAccountInTrialBalance({
      ...active,
      level: 1,
      hasChildren: true,
    })).toBe(false)
  })

  it('includes leaf level-1 accounts with balances', () => {
    expect(shouldIncludeAccountInTrialBalance({
      ...active,
      level: 1,
      hasChildren: false,
    })).toBe(true)
  })

  it('includes current-year profit accounts with year-to-date balances but no ledger activity', () => {
    expect(shouldIncludeAccountInTrialBalance({
      level: 2,
      hasChildren: false,
      periodTotals: empty,
      openingTotals: empty,
      closingBalance: 700,
      yearToDateTotals: { debit: 200, credit: 900, balance: 700 },
    })).toBe(true)
  })

  it('excludes accounts with no ledger, opening, closing, or year-to-date activity', () => {
    expect(shouldIncludeAccountInTrialBalance({
      level: 2,
      hasChildren: false,
      periodTotals: empty,
      openingTotals: empty,
      closingBalance: 0,
      yearToDateTotals: { debit: 0, credit: 0, balance: 0 },
    })).toBe(false)
  })
})

describe('shouldShowLevel1SummaryInTrialBalance', () => {
  const empty = { debit: 0, credit: 0 }
  const active = {
    level: 1,
    hasChildren: true,
    periodTotals: { debit: 50, credit: 150 },
    openingTotals: empty,
    closingBalance: 100,
    yearToDateTotals: { debit: 50, credit: 150, balance: 100 },
  }

  it('includes level-1 accounts with sub-accounts when rolled-up activity exists', () => {
    expect(shouldShowLevel1SummaryInTrialBalance(active)).toBe(true)
  })

  it('excludes level-1 leaf accounts', () => {
    expect(shouldShowLevel1SummaryInTrialBalance({
      ...active,
      hasChildren: false,
    })).toBe(false)
  })

  it('excludes lower-level parent accounts', () => {
    expect(shouldShowLevel1SummaryInTrialBalance({
      ...active,
      level: 2,
    })).toBe(false)
  })
})
