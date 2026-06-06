import { describe, expect, it } from 'vitest'
import { calculateYearToDateAmount, calculateYearToDateBalance, isCurrentYearProfitAccountName } from '@/lib/financial/year-to-date'

describe('year-to-date account calculations', () => {
  it('detects current year profit accounts in simplified and traditional Chinese', () => {
    expect(isCurrentYearProfitAccountName('本年利润')).toBe(true)
    expect(isCurrentYearProfitAccountName('本年利潤')).toBe(true)
    expect(isCurrentYearProfitAccountName('未分配利润')).toBe(false)
  })

  it('calculates current year profit amount as credit minus debit', () => {
    const input = { name: '本年利润', type: 'EQUITY' as const, code: '3131', debit: 1200, credit: 3500 }

    expect(calculateYearToDateAmount(input)).toBe(2300)
    expect(calculateYearToDateBalance(input)).toBe(2300)
  })

  it('keeps non-profit year-to-date amount as debit plus credit', () => {
    const input = { name: '主营业务收入', type: 'REVENUE' as const, code: '4001', debit: 200, credit: 1500 }

    expect(calculateYearToDateAmount(input)).toBe(1700)
    expect(calculateYearToDateBalance(input)).toBe(1300)
  })
})
