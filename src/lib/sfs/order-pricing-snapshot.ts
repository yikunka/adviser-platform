import { prisma } from '@/lib/db/prisma'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { applyCustomerOverridesToSpecOptions } from '@/lib/sfs/effective-pricing'
import { isSfsCustomDesign } from '@/lib/sfs/design-upload-shared'
import { getEffectiveMultiDiamondDiscountTiers } from '@/lib/sfs/multi-diamond-discount'
import {
  computeSfsOrderPricing,
  type SfsPricingDiamond,
  type SfsPricingResult,
} from '@/lib/sfs/pricing'

/** Frozen catalog estimate at order submit / partner edit — matches what the client saw. */
export type SfsOrderPricingSnapshot = {
  currency: 'HKD'
  capturedAt: string
  personalized: boolean
  hasCustomJewellery: boolean
  lines: Array<{
    diamondPart: number
    jewelleryPart: number
    unitPriceGross: number
    unitPrice: number
    customJewellery: boolean
  }>
  diamondGross: number
  diamondNet: number
  jewelleryTotal: number
  discountPct: number
  discountAmount: number
  subtotal: number
}

export type CaptureSfsOrderPricingInput = {
  diamonds: SfsPricingDiamond[]
  sourceType?: string | null
  color?: string | null
  customerId?: string | null
}

function toSnapshot(
  result: SfsPricingResult,
  diamonds: SfsPricingDiamond[],
  personalized: boolean,
): SfsOrderPricingSnapshot {
  return {
    currency: 'HKD',
    capturedAt: new Date().toISOString(),
    personalized,
    hasCustomJewellery: diamonds.some(d => isSfsCustomDesign(d.design)),
    lines: result.lines.map((line, index) => ({
      diamondPart: line.diamondPart,
      jewelleryPart: line.jewelleryPart,
      unitPriceGross: line.unitPriceGross,
      unitPrice: line.unitPrice,
      customJewellery: isSfsCustomDesign(diamonds[index]?.design),
    })),
    diamondGross: result.diamondGross,
    diamondNet: result.diamondNet,
    jewelleryTotal: result.jewelleryTotal,
    discountPct: result.discountPct,
    discountAmount: result.discountAmount,
    subtotal: result.subtotal,
  }
}

/** Build a pricing snapshot using current catalog + customer overrides/tiers. */
export async function captureSfsOrderPricingSnapshot(
  input: CaptureSfsOrderPricingInput,
): Promise<SfsOrderPricingSnapshot> {
  const base = await getSfsOrderSpecOptions()
  let personalized = false
  let overrides: Array<{ category: (typeof base.sources)[number]['category']; value: string; price: number }> = []

  if (input.customerId) {
    const customer = await prisma.sfsCustomer.findUnique({
      where: { id: input.customerId },
      select: {
        priceOverrides: { select: { category: true, value: true, price: true } },
      },
    })
    if (customer && customer.priceOverrides.length > 0) {
      personalized = true
      overrides = customer.priceOverrides.map(row => ({
        category: row.category,
        value: row.value,
        price: Number(row.price),
      }))
    }
  }

  const { tiers, usingCustomerTiers } = await getEffectiveMultiDiamondDiscountTiers(input.customerId ?? null)
  const specOptions = personalized ? applyCustomerOverridesToSpecOptions(base, overrides) : base
  const result = computeSfsOrderPricing({
    diamonds: input.diamonds,
    sourceType: input.sourceType,
    color: input.color,
    specOptions,
    multiDiamondDiscountTiers: tiers,
  })

  return toSnapshot(result, input.diamonds, personalized || usingCustomerTiers)
}

export function parseSfsOrderPricingSnapshot(value: unknown): SfsOrderPricingSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.subtotal !== 'number' || !Array.isArray(record.lines)) return null
  return value as SfsOrderPricingSnapshot
}

/** Prefer stored snapshot; otherwise recompute from current catalog (legacy orders). */
export async function resolveSfsOrderPricingEstimate(input: {
  pricingSnapshot: unknown
  diamonds: SfsPricingDiamond[]
  sourceType?: string | null
  color?: string | null
  customerId?: string | null
}): Promise<SfsOrderPricingSnapshot | null> {
  const stored = parseSfsOrderPricingSnapshot(input.pricingSnapshot)
  if (stored) return stored
  if (!input.diamonds.length) return null
  try {
    return await captureSfsOrderPricingSnapshot(input)
  } catch {
    return null
  }
}
