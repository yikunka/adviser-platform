import { type SfsDiamondSpecCategory } from '@prisma/client'
import {
  type SfsOrderSpecOptions,
  type SfsSpecOption,
} from '@/lib/sfs/diamond-spec-options'

export type CustomerPriceOverrideRow = {
  category: SfsDiamondSpecCategory
  value: string
  price: number
}

function overrideKey(category: string, value: string) {
  return `${category}|${value}`
}

function applyOverridesToOptions(
  options: SfsSpecOption[],
  overrideMap: Map<string, number>,
): SfsSpecOption[] {
  return options.map(option => {
    const override = overrideMap.get(overrideKey(option.category, option.value))
    if (override == null) return option
    return { ...option, price: override }
  })
}

/** Merge global catalog prices with per-customer overrides (override wins). */
export function applyCustomerOverridesToSpecOptions(
  specOptions: SfsOrderSpecOptions,
  overrides: CustomerPriceOverrideRow[],
): SfsOrderSpecOptions {
  const overrideMap = new Map<string, number>()
  for (const row of overrides) {
    overrideMap.set(overrideKey(row.category, row.value), row.price)
  }
  return {
    sources: applyOverridesToOptions(specOptions.sources, overrideMap),
    colors: applyOverridesToOptions(specOptions.colors, overrideMap),
    carats: applyOverridesToOptions(specOptions.carats, overrideMap),
    shapes: applyOverridesToOptions(specOptions.shapes, overrideMap),
    settingTypes: specOptions.settingTypes,
    ringDesigns: applyOverridesToOptions(specOptions.ringDesigns, overrideMap),
    necklaceDesigns: applyOverridesToOptions(specOptions.necklaceDesigns, overrideMap),
    earringDesigns: applyOverridesToOptions(specOptions.earringDesigns, overrideMap),
    braceletDesigns: applyOverridesToOptions(specOptions.braceletDesigns, overrideMap),
    metals: applyOverridesToOptions(specOptions.metals, overrideMap),
  }
}

const ADDITIVE_CATEGORIES = new Set<SfsDiamondSpecCategory>([
  'SOURCE',
  'COLOR',
  'SHAPE',
  'METAL',
])

export function isAdditiveSfsPriceCategory(category: SfsDiamondSpecCategory): boolean {
  return ADDITIVE_CATEGORIES.has(category)
}

/** Display helper for option cards and price lists. */
export function formatSfsPriceLabel(
  amount: number | null | undefined,
  opts: { additive?: boolean } = {},
): string | null {
  if (amount == null || Number.isNaN(Number(amount))) return null
  const value = Number(amount)
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-HK', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  if (opts.additive) {
    if (value === 0) return '+HK$0'
    return value > 0 ? `+HK$${formatted}` : `−HK$${formatted}`
  }
  return `HK$${formatted}`
}
