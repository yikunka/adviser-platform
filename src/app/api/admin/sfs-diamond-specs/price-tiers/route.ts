import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'

const createSchema = z
  .object({
    minCount: z.coerce.number().int().min(1).max(1000),
    maxCount: z.coerce.number().int().min(1).max(1000).optional().nullable(),
    discountRate: z.coerce.number().min(0).max(1),
    sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .refine(data => data.maxCount == null || data.maxCount >= data.minCount, {
    message: 'maxCount must be greater than or equal to minCount',
    path: ['maxCount'],
  })

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const tiers = await prisma.sfsDiamondPriceTier.findMany({
    orderBy: [{ sortOrder: 'asc' }, { minCount: 'asc' }],
  })
  return NextResponse.json({ tiers })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const tier = await prisma.sfsDiamondPriceTier.create({
    data: {
      minCount: parsed.data.minCount,
      maxCount: parsed.data.maxCount ?? null,
      discountRate: parsed.data.discountRate,
      sortOrder: parsed.data.sortOrder,
      createdById: session.user.id,
    },
  })
  await logAudit(session.user.id, 'CREATE', 'SfsDiamondPriceTier', tier.id, null, tier)
  return NextResponse.json({ tier }, { status: 201 })
}
