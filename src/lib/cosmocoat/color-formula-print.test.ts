import { describe, expect, it } from 'vitest'
import { scaleColorFormulaItemsForProduction } from '@/lib/cosmocoat/color-formula-print'

describe('scaleColorFormulaItemsForProduction', () => {
  it('scales item quantities to the target production weight', () => {
    const items = [
      { productionCode: 'P-001', name: 'Base Product', quantity: 80, notes: '' },
      { productionCode: 'AD-01', name: 'Pigment', quantity: 20, notes: 'slow add' },
    ]

    const scaled = scaleColorFormulaItemsForProduction(items, 100, 50)

    expect(scaled[0]?.quantity).toBe(40)
    expect(scaled[1]?.quantity).toBe(10)
    expect(scaled[0]?.percentage).toBe(80)
    expect(scaled[1]?.percentage).toBe(20)
  })

  it('returns zero quantities when target weight is invalid', () => {
    const items = [{ productionCode: 'AD-01', name: 'Pigment', quantity: 20, notes: '' }]
    const scaled = scaleColorFormulaItemsForProduction(items, 100, 0)
    expect(scaled[0]?.quantity).toBe(0)
  })
})
