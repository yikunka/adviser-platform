import { describe, expect, it } from 'vitest'
import { computeSfsOrderPricing, selectCountDiscountTier, type SfsPriceTier } from '@/lib/sfs/pricing'
import { type SfsOrderSpecOptions, type SfsSpecOption } from '@/lib/sfs/diamond-spec-options'

function opt(category: SfsSpecOption['category'], value: string, price: number | null): SfsSpecOption {
  return { id: `${category}-${value}`, category, label: value, value, imageUrl: null, price, sortOrder: 0, isActive: true }
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
    metals: [opt('METAL', 'Platinum', 500), opt('METAL', 'Yellow Gold', 0)],
    ...overrides,
  }
}

describe('selectCountDiscountTier', () => {
  const tiers: SfsPriceTier[] = [
    { minCount: 1, maxCount: 2, discountRate: 0 },
    { minCount: 3, maxCount: 5, discountRate: 0.05 },
    { minCount: 6, maxCount: null, discountRate: 0.1 },
  ]

  it('returns 0 when no tier matches', () => {
    expect(selectCountDiscountTier(1, [])).toBe(0)
  })

  it('picks the matching tier by count', () => {
    expect(selectCountDiscountTier(2, tiers)).toBe(0)
    expect(selectCountDiscountTier(4, tiers)).toBe(0.05)
    expect(selectCountDiscountTier(9, tiers)).toBe(0.1)
  })

  it('prefers the most specific (highest minCount) tier when overlapping', () => {
    const overlapping: SfsPriceTier[] = [
      { minCount: 1, maxCount: null, discountRate: 0.02 },
      { minCount: 5, maxCount: null, discountRate: 0.2 },
    ]
    expect(selectCountDiscountTier(6, overlapping)).toBe(0.2)
    expect(selectCountDiscountTier(3, overlapping)).toBe(0.02)
  })
})

describe('computeSfsOrderPricing', () => {
  it('additively combines carat + color + shape and adds the design price', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' }],
      color: 'Natural Color',
      specOptions: specOptions(),
    })
    // diamond = 1000 + 100 + 50 = 1150; jewellery = design 300 + metal 0 = 300
    expect(result.lines[0].diamondPart).toBe(1150)
    expect(result.lines[0].jewelleryPart).toBe(300)
    expect(result.lines[0].unitPrice).toBe(1450)
    expect(result.subtotal).toBe(1450)
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
      color: 'Transparent', // null price
      specOptions: specOptions(),
    })
    // 1000 + 0 (color) + 50 + no design/metal
    expect(result.lines[0].unitPrice).toBe(1050)
  })

  it('applies the count-tier discount to the diamond portion only', () => {
    const tiers: SfsPriceTier[] = [{ minCount: 2, maxCount: null, discountRate: 0.1 }]
    const result = computeSfsOrderPricing({
      diamonds: [
        { carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' },
        { carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' },
      ],
      color: 'Natural Color',
      specOptions: specOptions(),
      tiers,
    })
    expect(result.countDiscountRate).toBe(0.1)
    // diamond 1150 * 0.9 = 1035; jewellery 300 unchanged → 1335
    expect(result.lines[0].diamondPart).toBe(1035)
    expect(result.lines[0].jewelleryPart).toBe(300)
    expect(result.lines[0].unitPrice).toBe(1335)
  })

  it('applies the customer discount rate to the final unit price', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire', metal: 'Yellow Gold' }],
      color: 'Natural Color',
      specOptions: specOptions(),
      customerDiscountRate: 0.2,
    })
    // (1150 + 300) * 0.8 = 1160
    expect(result.lines[0].unitPrice).toBe(1160)
  })

  it('prefers a customer price override over the global price', () => {
    const result = computeSfsOrderPricing({
      diamonds: [{ carat: '1.0', shape: 'Round', type: 'Ring', design: 'Solitaire' }],
      color: 'Natural Color',
      specOptions: specOptions(),
      overrides: [
        { category: 'CARAT', value: '1.0', price: 500 },
        { category: 'RING_DESIGN', value: 'Solitaire', price: 1000 },
      ],
    })
    // diamond = 500 + 100 + 50 = 650; jewellery design override 1000 → 1650
    expect(result.lines[0].diamondPart).toBe(650)
    expect(result.lines[0].jewelleryPart).toBe(1000)
    expect(result.lines[0].unitPrice).toBe(1650)
  })

  it('stacks count discount then customer discount with overrides', () => {
    const result = computeSfsOrderPricing({
      diamonds: [
        { carat: '2.0', shape: 'Heart', type: 'Ring', design: 'Halo', metal: 'Platinum' },
        { carat: '2.0', shape: 'Heart', type: 'Ring', design: 'Halo', metal: 'Platinum' },
        { carat: '2.0', shape: 'Heart', type: 'Ring', design: 'Halo', metal: 'Platinum' },
      ],
      color: 'Natural Color',
      specOptions: specOptions(),
      tiers: [{ minCount: 3, maxCount: null, discountRate: 0.1 }],
      customerDiscountRate: 0.5,
    })
    // diamond raw = 2500 + 100 + 200 = 2800; *0.9 = 2520
    // jewellery = design 800 + metal 500 = 1300
    // unit = (2520 + 1300) * 0.5 = 1910
    expect(result.lines[0].unitPrice).toBe(1910)
    expect(result.subtotal).toBe(5730)
  })

  it('returns an empty result for an order with no diamonds', () => {
    const result = computeSfsOrderPricing({ diamonds: [], color: 'Natural Color', specOptions: specOptions() })
    expect(result.lines).toEqual([])
    expect(result.subtotal).toBe(0)
    expect(result.diamondCount).toBe(0)
  })
})
