import { type SfsDiamondSpecCategory } from '@prisma/client'
import {
  getDesignOptionGroupsForSettingType,
  type SfsOrderSpecOptions,
  type SfsSpecOption,
} from '@/lib/sfs/diamond-spec-options'

/**
 * SFS Diamond two-tier pricing engine (#360).
 *
 * Per diamond in an order (order-level `color` is shared):
 *   1. caratBase = override(CARAT,carat) ?? global(CARAT,carat)
 *   2. sourceAdj = override(SOURCE,sourceType) ?? global(SOURCE,sourceType)
 *   3. colorAdj  = override(COLOR,color) ?? global(COLOR,color)
 *   4. shapeAdj  = override(SHAPE,shape) ?? global(SHAPE,shape)
 *   5. diamondPart = (caratBase + sourceAdj + colorAdj + shapeAdj) × (1 − countTierDiscount)
 *        — the count-based tier discount applies to the diamond price portion only,
 *          keyed on the order's total diamond count.
 *   6. jewelleryPart = designPrice(by setting type) + metalAdj   (no count discount)
 *   7. unitPrice = (diamondPart + jewelleryPart) × (1 − customerDiscountRate)
 *
 * Any spec option without a configured price is treated as 0, preserving the legacy
 * "unpriced ⇒ 0" behaviour.
 */

export type SfsPricingDiamond = {
  carat?: string | null
  shape?: string | null
  type?: string | null // setting type
  design?: string | null
  metal?: string | null
}

export type SfsPriceTier = {
  minCount: number
  maxCount: number | null
  discountRate: number // 0..1
}

export type SfsPriceOverride = {
  category: SfsDiamondSpecCategory
  value: string
  price: number
}

export type SfsPricedLine = {
  diamondPart: number
  jewelleryPart: number
  unitPrice: number
}

export type SfsPricingResult = {
  lines: SfsPricedLine[]
  diamondCount: number
  countDiscountRate: number
  customerDiscountRate: number
  subtotal: number
}

export type ComputeSfsOrderPricingInput = {
  diamonds: SfsPricingDiamond[]
  sourceType?: string | null
  color?: string | null
  specOptions: SfsOrderSpecOptions
  tiers?: SfsPriceTier[]
  customerDiscountRate?: number | null
  overrides?: SfsPriceOverride[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function clampRate(rate: number | null | undefined): number {
  if (rate == null || Number.isNaN(rate)) return 0
  if (rate < 0) return 0
  if (rate > 1) return 1
  return rate
}

function overrideKey(category: SfsDiamondSpecCategory, value: string): string {
  return `${category}|${value}`
}

/**
 * Picks the discount rate for a given order diamond count. When multiple tiers match,
 * the most specific one (highest `minCount`) wins; no match ⇒ 0.
 */
export function selectCountDiscountTier(count: number, tiers: SfsPriceTier[]): number {
  let rate = 0
  let bestMin = -1
  for (const tier of tiers) {
    const withinLower = count >= tier.minCount
    const withinUpper = tier.maxCount == null || count <= tier.maxCount
    if (withinLower && withinUpper && tier.minCount > bestMin) {
      bestMin = tier.minCount
      rate = clampRate(tier.discountRate)
    }
  }
  return rate
}

export function computeSfsOrderPricing(input: ComputeSfsOrderPricingInput): SfsPricingResult {
  const { diamonds, sourceType, color, specOptions, tiers = [], overrides = [] } = input

  const overrideMap = new Map<string, number>()
  for (const override of overrides) {
    overrideMap.set(overrideKey(override.category, override.value), override.price)
  }

  const priced = (
    category: SfsDiamondSpecCategory,
    value: string | null | undefined,
    options: SfsSpecOption[],
  ): number => {
    if (!value) return 0
    const override = overrideMap.get(overrideKey(category, value))
    if (override != null) return override
    const option = options.find(item => item.value === value)
    return option?.price ?? 0
  }

  const jewelleryPart = (diamond: SfsPricingDiamond): number => {
    let total = 0
    const settingType = diamond.type ?? ''
    if (diamond.design) {
      const groups = getDesignOptionGroupsForSettingType(settingType, specOptions)
      let matched: SfsSpecOption | undefined
      for (const group of groups) {
        matched = group.options.find(option => option.value === diamond.design)
        if (matched) break
      }
      if (matched) {
        const override = overrideMap.get(overrideKey(matched.category, matched.value))
        total += override != null ? override : (matched.price ?? 0)
      }
    }
    total += priced('METAL', diamond.metal, specOptions.metals)
    return total
  }

  const count = diamonds.length
  const countDiscountRate = selectCountDiscountTier(count, tiers)
  const customerDiscountRate = clampRate(input.customerDiscountRate)
  const sourceAdj = priced('SOURCE', sourceType, specOptions.sources)
  const colorAdj = priced('COLOR', color, specOptions.colors)

  const lines: SfsPricedLine[] = diamonds.map(diamond => {
    const caratBase = priced('CARAT', diamond.carat, specOptions.carats)
    const shapeAdj = priced('SHAPE', diamond.shape, specOptions.shapes)
    const diamondPart = round2((caratBase + sourceAdj + colorAdj + shapeAdj) * (1 - countDiscountRate))
    const jewellery = round2(jewelleryPart(diamond))
    const unitPrice = round2((diamondPart + jewellery) * (1 - customerDiscountRate))
    return { diamondPart, jewelleryPart: jewellery, unitPrice }
  })

  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice, 0))

  return { lines, diamondCount: count, countDiscountRate, customerDiscountRate, subtotal }
}
