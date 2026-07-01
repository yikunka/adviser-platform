import { describe, expect, it } from 'vitest'
import { computeTotals, lineAmount } from './calc'

describe('invoice calculation', () => {
  it('keeps the original amount when no discount is provided', () => {
    expect(lineAmount(2, 125)).toBe(250)
  })

  it('applies percentage discounts per line', () => {
    expect(lineAmount(2, 125, 'PERCENT', 10)).toBe(225)
  })

  it('applies fixed discounts per line', () => {
    expect(lineAmount(2, 125, 'FIXED', 25)).toBe(225)
  })

  it('caps fixed discounts at the line subtotal', () => {
    expect(lineAmount(1, 100, 'FIXED', 150)).toBe(0)
  })

  it('aggregates discounted line totals while keeping tax at zero when tax rate is zero', () => {
    const totals = computeTotals([
      { description: 'A', quantity: 2, unitPrice: 125, discountType: 'PERCENT', discountValue: 10 },
      { description: 'B', quantity: 1, unitPrice: 80, discountType: 'FIXED', discountValue: 5 },
    ], 0)

    expect(totals.lineAmounts).toEqual([225, 75])
    expect(totals.subtotal).toBe(300)
    expect(totals.taxAmount).toBe(0)
    expect(totals.total).toBe(300)
  })
})
