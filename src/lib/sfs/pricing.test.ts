import { describe, expect, it } from 'vitest'
import { computeSfsOrderPricing } from '@/lib/sfs/pricing'
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

  it('returns an empty result for an order with no diamonds', () => {
    const result = computeSfsOrderPricing({ diamonds: [], color: 'Natural Color', specOptions: specOptions() })
    expect(result.lines).toEqual([])
    expect(result.subtotal).toBe(0)
    expect(result.diamondCount).toBe(0)
  })
})
