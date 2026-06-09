import { describe, expect, it } from 'vitest'
import { shouldIncludeAccountInBalanceSheet } from './balance-sheet-inclusion'

describe('shouldIncludeAccountInBalanceSheet', () => {
  it('includes only level-1 accounts', () => {
    expect(shouldIncludeAccountInBalanceSheet(1)).toBe(true)
    expect(shouldIncludeAccountInBalanceSheet(2)).toBe(false)
    expect(shouldIncludeAccountInBalanceSheet(3)).toBe(false)
    expect(shouldIncludeAccountInBalanceSheet(4)).toBe(false)
  })
})
