import { prisma } from '@/lib/db/prisma'
import type { SfsMultiDiamondDiscountTier } from '@/lib/sfs/pricing'

function mapTiers(
  rows: Array<{ minDiamondCount: number; discountPercent: { toString(): string } | number }>,
): SfsMultiDiamondDiscountTier[] {
  return rows
    .map(row => ({
      minDiamondCount: row.minDiamondCount,
      discountPercent: Number(row.discountPercent),
    }))
    .sort((a, b) => a.minDiamondCount - b.minDiamondCount)
}

export async function getGlobalMultiDiamondDiscountTiers(): Promise<SfsMultiDiamondDiscountTier[]> {
  const rows = await prisma.sfsMultiDiamondDiscountTier.findMany({
    orderBy: { minDiamondCount: 'asc' },
  })
  return mapTiers(rows)
}

/**
 * Customer-specific tiers when any exist; otherwise global tiers.
 * `usingCustomerTiers` is true only when the customer has their own rows.
 */
export async function getEffectiveMultiDiamondDiscountTiers(customerId?: string | null): Promise<{
  tiers: SfsMultiDiamondDiscountTier[]
  usingCustomerTiers: boolean
}> {
  if (customerId) {
    const customerRows = await prisma.sfsCustomerMultiDiamondDiscountTier.findMany({
      where: { customerId },
      orderBy: { minDiamondCount: 'asc' },
    })
    if (customerRows.length > 0) {
      return { tiers: mapTiers(customerRows), usingCustomerTiers: true }
    }
  }
  return { tiers: await getGlobalMultiDiamondDiscountTiers(), usingCustomerTiers: false }
}
