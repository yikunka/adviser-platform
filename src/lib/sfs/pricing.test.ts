import { describe, expect, it } from 'vitest'
import { computeSfsOrderPricing, resolveMultiDiamondDiscountPct } from '@/lib/sfs/pricing'
import { type SfsOrderSpecOptions, type SfsSpecOption } from '@/lib/sfs/diamond-spec-options'

function opt(category: SfsSpecOption['category'], value: string, price: number | null): SfsSpecOption {
  return { id: `${category}-${value}`, category, label: value, value, imageUrl: null, chainLength: null, price, sortOrder: 0, isActive: true }
}

function specOptions(overrides: Partial<SfsOrderSpecOptions> = {}): SfsOrderSpecOptions {
  return {
    sources: [opt('SOURCE', 'Hairs', 25), opt('SOURCE', 'Ashes', null)],
    colors: [opt('COLOR', 'Natural Color', 100), opt('COLOR', 'Transparent', null)],
    carats: [opt('CARAT', '1.0', 1000), opt('CARAT', '2.0', 2500)],
    shapes: [opt('SHAPE', 'Round', 50), opt('SHAPE', 'Heart', 200)],
    settingTypes: [opt('SETTING_TYPE', 'Ring', null), opt('SETTING_TYPE', 'Diamond only', null)],
    ringDesigns: [opt('RING_DESIGN', 'Solitaire', 300), opt('RING_DESIGN', 'Halo', 800)],
    necklaceDesigns: [],
    earringDesigns: [],
    braceletDesigns: [],
    metals: [opt('METAL', 'Platinum', 10), opt('METAL', 'Yellow Gold', 0)],
    ...overrides,
  }
}

const TIERS = [
  { minDiamondCount: 2, discountPercent: 5 },
  { minDiamondCount: 3, discountPercent: 10 },
]

describe('resolveMultiDiamondDiscountPct', () => {
  it('returns 0 when count is below all tiers', () => {
    expect(resolveMultiDiamondDiscountPct(1, TIERS)).toBe(0)
  })

  it('picks the highest matching tier', () => {
    expect(resolveMultiDiamondDiscountPct(2, TIERS)).toBe(5)
    expect(resolveMultiDiamondDiscountPct(4, TIERS)).toBe(10)
  })
})

describe('computeSfsOrderPricing', () => {
  it('additively combines carat + color + shape and applies metal percent on design', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' }],
      color: 'Natural Color',
      specOptions: specOptions(),
    })
    expect(result.lines[0].diamondPart).toBe(1150)
    expect(result.lines[0].jewelleryPart).toBe(300)
    expect(result.lines[0].unitPrice).toBe(1450)
    expect(result.subtotal).toBe(1450)
    expect(result.discountPct).toBe(0)
  })

  it('applies metal as a percent add-on of the jewellery design price', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Platinum' }],
      color: 'Natural Color',
      specOptions: specOptions(),
    })
    expect(result.lines[0].jewelleryPart).toBe(330)
    expect(result.lines[0].unitPrice).toBe(1480)
  })

  it('discounts only the diamond portion across multiple diamonds', () => {
    const result = computeSfsOrderPricing({
      diamonds: [
        { carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' },
        { carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' },
      ],
      color: 'Natural Color',
      specOptions: specOptions(),
      multiDiamondDiscountTiers: TIERS,
    })
    // each diamondPart 1150 → gross 2300; 5% off → 2185; jewellery 300+300=600
    expect(result.diamondCount).toBe(2)
    expect(result.discountPct).toBe(5)
    expect(result.diamondGross).toBe(2300)
    expect(result.diamondNet).toBe(2185)
    expect(result.discountAmount).toBe(115)
    expect(result.jewelleryTotal).toBe(600)
    expect(result.subtotalGross).toBe(2900)
    expect(result.subtotal).toBe(2785)
    expect(result.lines[0].unitPrice).toBe(1392.5)
    expect(result.lines[1].unitPrice).toBe(1392.5)
  })

  it('does not discount jewellery when only one diamond', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' }],
      color: 'Natural Color',
      specOptions: specOptions(),
      multiDiamondDiscountTiers: TIERS,
    })
    expect(result.discountPct).toBe(0)
    expect(result.subtotal).toBe(1450)
  })

  it('treats metal as 0 when there is no design / Diamond only', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Diamond only', metal: 'Platinum' }],
      color: 'Natural Color',
      specOptions: specOptions(),
    })
    expect(result.lines[0].jewelleryPart).toBe(0)
    expect(result.lines[0].unitPrice).toBe(1150)
  })

  it('excludes jewellery from the live estimate for Custom designs (staff-quoted)', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Custom', metal: 'Platinum' }],
      color: 'Natural Color',
      specOptions: specOptions(),
    })
    expect(result.lines[0].jewelleryPart).toBe(0)
    expect(result.jewelleryTotal).toBe(0)
    expect(result.lines[0].unitPrice).toBe(1150)
    expect(result.subtotal).toBe(1150)
  })

  it('includes the source material adjustment in the diamond price portion', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Diamond only' }],
      sourceType: 'Hairs',
      color: 'Natural Color',
      specOptions: specOptions(),
    })

    expect(result.lines[0].diamondPart).toBe(1175)
    expect(result.lines[0].unitPrice).toBe(1175)
  })

  it('treats unpriced spec options as 0', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Diamond only' }],
      color: 'Transparent',
      specOptions: specOptions(),
    })
    expect(result.lines[0].unitPrice).toBe(1050)
  })

  it('prefers a customer price override over the global price', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Platinum' }],
      color: 'Natural Color',
      specOptions: specOptions(),
      overrides: [
        { category: 'CARAT', value: '1.0', price: 500 },
        { category: 'RING_DESIGN', value: 'Solitaire', price: 1000 },
        { category: 'METAL', value: 'Platinum', price: 20 },
      ],
    })
    expect(result.lines[0].diamondPart).toBe(650)
    expect(result.lines[0].jewelleryPart).toBe(1200)
    expect(result.lines[0].unitPrice).toBe(1850)
  })

  it('returns an empty result for an order with no diamonds', () => {
    const result = computeSfsOrderPricing({ diamonds: [], color: 'Natural Color', specOptions: specOptions() })
    expect(result.lines).toEqual([])
    expect(result.subtotal).toBe(0)
    expect(result.diamondCount).toBe(0)
  })
})
