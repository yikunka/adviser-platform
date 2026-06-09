import { describe, expect, it } from 'vitest'
import { canEditEnteredBalances, canEditOpeningBalance, openingBalanceEditBlockedMessage } from './opening-balance'

describe('opening balance edit rules', () => {
  it('allows level-2 leaf accounts', () => {
    expect(canEditOpeningBalance(2, false)).toBe(true)
    expect(canEditEnteredBalances(2, false)).toBe(true)
  })

  it('allows level-1 leaf accounts without children', () => {
    expect(canEditOpeningBalance(1, false)).toBe(true)
    expect(canEditEnteredBalances(1, false)).toBe(true)
    expect(openingBalanceEditBlockedMessage(1, false)).toBe('')
  })

  it('blocks level-1 accounts with children', () => {
    expect(canEditOpeningBalance(1, true)).toBe(false)
    expect(canEditEnteredBalances(1, true)).toBe(false)
    expect(openingBalanceEditBlockedMessage(1, true)).toContain('一级科目')
  })

  it('blocks parent accounts with children', () => {
    expect(canEditOpeningBalance(2, true)).toBe(false)
    expect(openingBalanceEditBlockedMessage(2, true)).toContain('上级科目')
  })
})
