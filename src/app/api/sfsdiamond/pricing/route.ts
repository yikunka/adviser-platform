import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { applyCustomerOverridesToSpecOptions } from '@/lib/sfs/effective-pricing'
import { getEffectiveMultiDiamondDiscountTiers } from '@/lib/sfs/multi-diamond-discount'

/**
 * GET /api/sfsdiamond/pricing
 * Returns the catalog with effective prices for the current visitor.
 * Logged-in SFS customers with a profile get per-customer overrides applied.
 */
export async function GET() {
  const session = await auth()
  const base = await getSfsOrderSpecOptions()

  let personalized = false
  let customerId: string | null = null
  let overrides: Array<{ category: typeof base.sources[number]['category']; value: string; price: number }> = []

  if (session?.user?.platform === 'SFS_DIAMOND') {
    const customer = await prisma.sfsCustomer.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        priceOverrides: { select: { category: true, value: true, price: true } },
      },
    })
    if (customer) {
      customerId = customer.id
      if (customer.priceOverrides.length > 0) {
        personalized = true
        overrides = customer.priceOverrides.map(row => ({
          category: row.category,
          value: row.value,
          price: Number(row.price),
        }))
      }
    }
  }

  const specOptions = personalized
    ? applyCustomerOverridesToSpecOptions(base, overrides)
    : base

  const { tiers: multiDiamondDiscountTiers, usingCustomerTiers } =
    await getEffectiveMultiDiamondDiscountTiers(customerId)

  return NextResponse.json({
    currency: 'HKD',
    personalized: personalized || usingCustomerTiers,
    specOptions,
    multiDiamondDiscountTiers,
  })
}
