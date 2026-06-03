import { describe, expect, it } from 'vitest'
import { canEditOpeningBalance, openingBalanceEditBlockedMessage } from './opening-balance'

describe('opening balance edit rules', () => {
  it('allows level-2 leaf accounts', () => {
    expect(canEditOpeningBalance(2, false)).toBe(true)
  })

  it('blocks level-1 accounts', () => {
    expect(canEditOpeningBalance(1, false)).toBe(false)
    expect(openingBalanceEditBlockedMessage(1, false)).toContain('一级科目')
  })

  it('blocks parent accounts with children', () => {
    expect(canEditOpeningBalance(2, true)).toBe(false)
    expect(openingBalanceEditBlockedMessage(2, true)).toContain('上级科目')
  })
})
