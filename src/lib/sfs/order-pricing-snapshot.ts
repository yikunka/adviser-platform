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

/** Per-diamond line frozen at order submit / partner edit. */
export type SfsOrderPricingSnapshotLine = {
  carat?: string | null
  shape?: string | null
  type?: string | null
  design?: string | null
  metal?: string | null
  diamondPart: number
  jewelleryPart: number
  unitPriceGross: number
  unitPrice: number
  customJewellery: boolean
  /** Present on snapshots captured after breakdown support was added. */
  caratBase?: number
  sourceAdj?: number
  colorAdj?: number
  shapeAdj?: number
  designPrice?: number
  metalPct?: number
}

/** Frozen catalog estimate at order submit / partner edit — matches what the client saw. */
export type SfsOrderPricingSnapshot = {
  currency: 'HKD'
  capturedAt: string
  personalized: boolean
  hasCustomJewellery: boolean
  lines: SfsOrderPricingSnapshotLine[]
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
    lines: result.lines.map((line, index) => {
      const diamond = diamonds[index]
      return {
        carat: diamond?.carat ?? null,
        shape: diamond?.shape ?? null,
        type: diamond?.type ?? null,
        design: diamond?.design ?? null,
        metal: diamond?.metal ?? null,
        diamondPart: line.diamondPart,
        jewelleryPart: line.jewelleryPart,
        unitPriceGross: line.unitPriceGross,
        unitPrice: line.unitPrice,
        customJewellery: isSfsCustomDesign(diamond?.design),
        caratBase: line.caratBase,
        sourceAdj: line.sourceAdj,
        colorAdj: line.colorAdj,
        shapeAdj: line.shapeAdj,
        designPrice: line.designPrice,
        metalPct: line.metalPct,
      }
    }),
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

function isSnapshotLine(value: unknown): value is SfsOrderPricingSnapshotLine {
  if (!value || typeof value !== 'object') return false
  const line = value as Record<string, unknown>
  return typeof line.diamondPart === 'number'
    && typeof line.jewelleryPart === 'number'
    && typeof line.unitPrice === 'number'
}

export function parseSfsOrderPricingSnapshot(value: unknown): SfsOrderPricingSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.subtotal !== 'number' || !Array.isArray(record.lines)) return null
  if (!record.lines.every(isSnapshotLine)) return null
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
