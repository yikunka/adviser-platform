import { type SfsDiamondSpecCategory } from '@prisma/client'
import {
  getDesignOptionGroupsForSettingType,
  type SfsOrderSpecOptions,
  type SfsSpecOption,
} from '@/lib/sfs/diamond-spec-options'
import { isSfsCustomDesign } from '@/lib/sfs/design-uploads'

/**
 * SFS Diamond pricing engine.
 *
 * Per diamond in an order (order-level `color` / `sourceType` are shared):
 *   1. caratBase = override(CARAT,carat) ?? global(CARAT,carat)
 *   2. sourceAdj = override(SOURCE,sourceType) ?? global(SOURCE,sourceType)
 *   3. colorAdj  = override(COLOR,color) ?? global(COLOR,color)
 *   4. shapeAdj  = override(SHAPE,shape) ?? global(SHAPE,shape)
 *   5. diamondPart = caratBase + sourceAdj + colorAdj + shapeAdj
 *   6. designPrice = design catalog/override (0 when no design / Diamond only / Custom)
 *   7. metalPct   = override(METAL,metal) ?? global(METAL,metal)  // 10 ⇒ +10%
 *   8. jewelleryPart = designPrice × (1 + metalPct/100)          // metal applies only when designPrice > 0
 *      Custom designs are staff-quoted; jewelleryPart stays 0 in the live estimate
 *   9. unitPriceGross = diamondPart + jewelleryPart
 *
 * Order-level multi-diamond discount (optional tiers):
 *  10. discountPct from tiers by diamondCount (customer tiers override global when present)
 *  11. discount applies ONLY to diamondPart: diamondNet = diamondGross × (1 − discountPct/100)
 *  12. jewellery stays full price; subtotal = diamondNet + jewelleryTotal
 *  13. per-line unitPrice allocates the diamond discount evenly by that line's diamondPart share
 */

export type SfsPricingDiamond = {
  carat?: string | null
  shape?: string | null
  type?: string | null // setting type
  design?: string | null
  metal?: string | null
}

export type SfsPriceOverride = {
  category: SfsDiamondSpecCategory
  value: string
  price: number
}

export type SfsMultiDiamondDiscountTier = {
  minDiamondCount: number
  discountPercent: number
}

export type SfsPricedLine = {
  diamondPart: number
  jewelleryPart: number
  /** Before multi-diamond diamond-portion discount. */
  unitPriceGross: number
  /** After allocating diamond-portion discount. */
  unitPrice: number
}

export type SfsPricingResult = {
  lines: SfsPricedLine[]
  diamondCount: number
  diamondGross: number
  diamondNet: number
  jewelleryTotal: number
  discountPct: number
  discountAmount: number
  subtotalGross: number
  subtotal: number
}

export type ComputeSfsOrderPricingInput = {
  diamonds: SfsPricingDiamond[]
  sourceType?: string | null
  color?: string | null
  specOptions: SfsOrderSpecOptions
  overrides?: SfsPriceOverride[]
  /** Effective tiers (already resolved: customer overrides or global). Empty ⇒ 0% discount. */
  multiDiamondDiscountTiers?: SfsMultiDiamondDiscountTier[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function overrideKey(category: SfsDiamondSpecCategory, value: string): string {
  return `${category}|${value}`
}

/** Pick the highest minDiamondCount tier that applies to `count`. */
export function resolveMultiDiamondDiscountPct(
  count: number,
  tiers: SfsMultiDiamondDiscountTier[] | null | undefined,
): number {
  if (!tiers?.length || count <= 0) return 0
  const sorted = [...tiers]
    .filter(t => Number.isFinite(t.minDiamondCount) && t.minDiamondCount >= 1)
    .sort((a, b) => b.minDiamondCount - a.minDiamondCount)
  const match = sorted.find(t => count >= t.minDiamondCount)
  if (!match) return 0
  const pct = Number(match.discountPercent)
  if (!Number.isFinite(pct) || pct <= 0) return 0
  return Math.min(100, pct)
}

export function computeSfsOrderPricing(input: ComputeSfsOrderPricingInput): SfsPricingResult {
  const {
    diamonds,
    sourceType,
    color,
    specOptions,
    overrides = [],
    multiDiamondDiscountTiers = [],
  } = input

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

  const designPrice = (diamond: SfsPricingDiamond): number => {
    if (!diamond.design || isSfsCustomDesign(diamond.design)) return 0
    const settingType = diamond.type ?? ''
    const groups = getDesignOptionGroupsForSettingType(settingType, specOptions)
    for (const group of groups) {
      const matched = group.options.find(option => option.value === diamond.design)
      if (matched) {
        const override = overrideMap.get(overrideKey(matched.category, matched.value))
        return override != null ? override : (matched.price ?? 0)
      }
    }
    return 0
  }

  const jewelleryPart = (diamond: SfsPricingDiamond): number => {
    const design = designPrice(diamond)
    // No design / Diamond only → metal contributes 0
    if (design <= 0) return 0
    const metalPct = priced('METAL', diamond.metal, specOptions.metals)
    return round2(design * (1 + metalPct / 100))
  }

  const count = diamonds.length
  const sourceAdj = priced('SOURCE', sourceType, specOptions.sources)
  const colorAdj = priced('COLOR', color, specOptions.colors)

  const grossLines = diamonds.map(diamond => {
    const caratBase = priced('CARAT', diamond.carat, specOptions.carats)
    const shapeAdj = priced('SHAPE', diamond.shape, specOptions.shapes)
    const diamondPart = round2(caratBase + sourceAdj + colorAdj + shapeAdj)
    const jewellery = jewelleryPart(diamond)
    const unitPriceGross = round2(diamondPart + jewellery)
    return { diamondPart, jewelleryPart: jewellery, unitPriceGross }
  })

  const diamondGross = round2(grossLines.reduce((sum, line) => sum + line.diamondPart, 0))
  const jewelleryTotal = round2(grossLines.reduce((sum, line) => sum + line.jewelleryPart, 0))
  const discountPct = resolveMultiDiamondDiscountPct(count, multiDiamondDiscountTiers)
  const diamondNet = round2(diamondGross * (1 - discountPct / 100))
  const discountAmount = round2(diamondGross - diamondNet)
  const subtotalGross = round2(diamondGross + jewelleryTotal)
  const subtotal = round2(diamondNet + jewelleryTotal)

  const lines: SfsPricedLine[] = grossLines.map(line => {
    const discountedDiamond =
      diamondGross > 0
        ? round2(line.diamondPart * (diamondNet / diamondGross))
        : 0
    return {
      diamondPart: line.diamondPart,
      jewelleryPart: line.jewelleryPart,
      unitPriceGross: line.unitPriceGross,
      unitPrice: round2(discountedDiamond + line.jewelleryPart),
    }
  })

  return {
    lines,
    diamondCount: count,
    diamondGross,
    diamondNet,
    jewelleryTotal,
    discountPct,
    discountAmount,
    subtotalGross,
    subtotal,
  }
}
