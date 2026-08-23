import { type SfsDiamondSpecCategory } from '@prisma/client'
import {
  getDesignOptionGroupsForSettingType,
  type SfsOrderSpecOptions,
  type SfsSpecOption,
} from '@/lib/sfs/diamond-spec-options'

/**
 * SFS Diamond pricing engine.
 *
 * Per diamond in an order (order-level `color` / `sourceType` are shared):
 *   1. caratBase = override(CARAT,carat) ?? global(CARAT,carat)
 *   2. sourceAdj = override(SOURCE,sourceType) ?? global(SOURCE,sourceType)
 *   3. colorAdj  = override(COLOR,color) ?? global(COLOR,color)
 *   4. shapeAdj  = override(SHAPE,shape) ?? global(SHAPE,shape)
 *   5. diamondPart = caratBase + sourceAdj + colorAdj + shapeAdj
 *   6. jewelleryPart = designPrice(by setting type) + metalAdj
 *   7. unitPrice = diamondPart + jewelleryPart
 *
 * Any spec option without a configured price is treated as 0, preserving the legacy
 * "unpriced ⇒ 0" behaviour. Per-customer price overrides still replace matching globals.
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

export type SfsPricedLine = {
  diamondPart: number
  jewelleryPart: number
  unitPrice: number
}

export type SfsPricingResult = {
  lines: SfsPricedLine[]
  diamondCount: number
  subtotal: number
}

export type ComputeSfsOrderPricingInput = {
  diamonds: SfsPricingDiamond[]
  sourceType?: string | null
  color?: string | null
  specOptions: SfsOrderSpecOptions
  overrides?: SfsPriceOverride[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function overrideKey(category: SfsDiamondSpecCategory, value: string): string {
  return `${category}|${value}`
}

export function computeSfsOrderPricing(input: ComputeSfsOrderPricingInput): SfsPricingResult {
  const { diamonds, sourceType, color, specOptions, overrides = [] } = input

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
  const sourceAdj = priced('SOURCE', sourceType, specOptions.sources)
  const colorAdj = priced('COLOR', color, specOptions.colors)

  const lines: SfsPricedLine[] = diamonds.map(diamond => {
    const caratBase = priced('CARAT', diamond.carat, specOptions.carats)
    const shapeAdj = priced('SHAPE', diamond.shape, specOptions.shapes)
    const diamondPart = round2(caratBase + sourceAdj + colorAdj + shapeAdj)
    const jewellery = round2(jewelleryPart(diamond))
    const unitPrice = round2(diamondPart + jewellery)
    return { diamondPart, jewelleryPart: jewellery, unitPrice }
  })

  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice, 0))

  return { lines, diamondCount: count, subtotal }
}
