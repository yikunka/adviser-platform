import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { resolveSfsCustomerIdFromRowId } from '@/lib/sfs/resolve-customer-row-id'
import {
  getEffectiveMultiDiamondDiscountTiers,
  getGlobalMultiDiamondDiscountTiers,
} from '@/lib/sfs/multi-diamond-discount'

const tierSchema = z.object({
  minDiamondCount: z.coerce.number().int().min(2).max(50),
  discountPercent: z.coerce.number().finite().min(0).max(100),
})

const replaceSchema = z.object({
  tiers: z.array(tierSchema).max(20),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenus: ['sfsCustomers', 'sfsFactory'] })
  if (error) return error

  const { id } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) {
    return NextResponse.json({
      customerId: null,
      usingCustomerTiers: false,
      tiers: await getGlobalMultiDiamondDiscountTiers(),
      globalTiers: await getGlobalMultiDiamondDiscountTiers(),
    })
  }

  const { tiers, usingCustomerTiers } = await getEffectiveMultiDiamondDiscountTiers(customerId)
  const globalTiers = await getGlobalMultiDiamondDiscountTiers()
  return NextResponse.json({ customerId, usingCustomerTiers, tiers, globalTiers })
}

/** Replace customer-specific multi-diamond tiers. Empty array clears overrides (falls back to global). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsFactory' })
  if (error) return error

  const { id } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) {
    return NextResponse.json({ error: 'Save a customer profile before setting multi-diamond discounts.' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = replaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const deduped = new Map<number, number>()
  for (const tier of parsed.data.tiers) {
    deduped.set(tier.minDiamondCount, tier.discountPercent)
  }

  const before = await prisma.sfsCustomerMultiDiamondDiscountTier.findMany({
    where: { customerId },
    orderBy: { minDiamondCount: 'asc' },
  })

  const tiers = await prisma.$transaction(async tx => {
    await tx.sfsCustomerMultiDiamondDiscountTier.deleteMany({ where: { customerId } })
    if (deduped.size > 0) {
      await tx.sfsCustomerMultiDiamondDiscountTier.createMany({
        data: [...deduped.entries()].map(([minDiamondCount, discountPercent]) => ({
          customerId,
          minDiamondCount,
          discountPercent,
        })),
      })
    }
    return tx.sfsCustomerMultiDiamondDiscountTier.findMany({
      where: { customerId },
      orderBy: { minDiamondCount: 'asc' },
    })
  })

  await logAudit(
    session!.user.id,
    'UPDATE',
    'SfsCustomerMultiDiamondDiscountTier',
    customerId,
    before,
    tiers,
  )

  const globalTiers = await getGlobalMultiDiamondDiscountTiers()
  const usingCustomerTiers = tiers.length > 0
  return NextResponse.json({
    customerId,
    usingCustomerTiers,
    tiers: usingCustomerTiers
      ? tiers.map(t => ({
          minDiamondCount: t.minDiamondCount,
          discountPercent: Number(t.discountPercent),
        }))
      : globalTiers,
    globalTiers,
  })
}
