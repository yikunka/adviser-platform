import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { getGlobalMultiDiamondDiscountTiers } from '@/lib/sfs/multi-diamond-discount'

const tierSchema = z.object({
  minDiamondCount: z.coerce.number().int().min(2).max(50),
  discountPercent: z.coerce.number().finite().min(0).max(100),
})

const replaceSchema = z.object({
  tiers: z.array(tierSchema).max(20),
})

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenus: ['sfsFactory', 'sfsOrders'] })
  if (error) return error

  const tiers = await getGlobalMultiDiamondDiscountTiers()
  return NextResponse.json({ tiers })
}

/** Full replacement of global multi-diamond discount tiers. */
export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsFactory' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = replaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const deduped = new Map<number, number>()
  for (const tier of parsed.data.tiers) {
    deduped.set(tier.minDiamondCount, tier.discountPercent)
  }

  const before = await prisma.sfsMultiDiamondDiscountTier.findMany({
    orderBy: { minDiamondCount: 'asc' },
  })

  const tiers = await prisma.$transaction(async tx => {
    await tx.sfsMultiDiamondDiscountTier.deleteMany()
    if (deduped.size > 0) {
      await tx.sfsMultiDiamondDiscountTier.createMany({
        data: [...deduped.entries()].map(([minDiamondCount, discountPercent]) => ({
          minDiamondCount,
          discountPercent,
        })),
      })
    }
    return tx.sfsMultiDiamondDiscountTier.findMany({ orderBy: { minDiamondCount: 'asc' } })
  })

  await logAudit(
    session!.user.id,
    'UPDATE',
    'SfsMultiDiamondDiscountTier',
    'global',
    before,
    tiers,
  )

  return NextResponse.json({
    tiers: tiers.map(t => ({
      minDiamondCount: t.minDiamondCount,
      discountPercent: Number(t.discountPercent),
    })),
  })
}
