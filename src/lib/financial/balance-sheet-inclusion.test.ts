import { describe, expect, it } from 'vitest'
import { shouldIncludeAccountInBalanceSheet, isBalanceSheetSummaryRow } from './balance-sheet-inclusion'

describe('shouldIncludeAccountInBalanceSheet', () => {
  it('includes accounts at all levels for detail collection', () => {
    expect(shouldIncludeAccountInBalanceSheet(1)).toBe(true)
    expect(shouldIncludeAccountInBalanceSheet(2)).toBe(true)
    expect(shouldIncludeAccountInBalanceSheet(3)).toBe(true)
    expect(shouldIncludeAccountInBalanceSheet(4)).toBe(true)
  })
})

describe('isBalanceSheetSummaryRow', () => {
  it('identifies level-1 rows as summary rows', () => {
    expect(isBalanceSheetSummaryRow(1)).toBe(true)
    expect(isBalanceSheetSummaryRow(2)).toBe(false)
  })
})
