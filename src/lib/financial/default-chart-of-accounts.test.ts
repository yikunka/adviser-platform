import { describe, expect, it } from 'vitest'
import { DEFAULT_CHART_OF_ACCOUNTS } from './default-chart-of-accounts'

describe('default chart of accounts template', () => {
  it('includes common level-1 starter accounts with distinct current and non-current types', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map(account => account.code)
    expect(codes).toContain('1001')
    expect(codes).toContain('1002')
    expect(codes).toContain('1300')
    expect(codes).toContain('2500')

    const fixedAsset = DEFAULT_CHART_OF_ACCOUNTS.find(account => account.code === '1300')
    const longTermLoan = DEFAULT_CHART_OF_ACCOUNTS.find(account => account.code === '2500')
    expect(fixedAsset?.type).toBe('NON_CURRENT_ASSET')
    expect(longTermLoan?.type).toBe('NON_CURRENT_LIABILITY')
  })

  it('uses unique account codes', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map(account => account.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
