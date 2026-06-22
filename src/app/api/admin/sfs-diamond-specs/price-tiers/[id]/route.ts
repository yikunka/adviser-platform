import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'

const updateSchema = z.object({
  minCount: z.coerce.number().int().min(1).max(1000).optional(),
  maxCount: z.coerce.number().int().min(1).max(1000).optional().nullable(),
  discountRate: z.coerce.number().min(0).max(1).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const { id } = await params
  const before = await prisma.sfsDiamondPriceTier.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const nextMin = data.minCount ?? before.minCount
  const nextMax = data.maxCount !== undefined ? data.maxCount : before.maxCount
  if (nextMax != null && nextMax < nextMin) {
    return NextResponse.json({ error: 'maxCount must be greater than or equal to minCount' }, { status: 400 })
  }

  const tier = await prisma.sfsDiamondPriceTier.update({
    where: { id },
    data: {
      ...(data.minCount !== undefined ? { minCount: data.minCount } : {}),
      ...(data.maxCount !== undefined ? { maxCount: data.maxCount } : {}),
      ...(data.discountRate !== undefined ? { discountRate: data.discountRate } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  })
  await logAudit(session.user.id, 'UPDATE', 'SfsDiamondPriceTier', tier.id, before, tier)
  return NextResponse.json({ tier })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const { id } = await params
  const before = await prisma.sfsDiamondPriceTier.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.sfsDiamondPriceTier.delete({ where: { id } })
  await logAudit(session.user.id, 'DELETE', 'SfsDiamondPriceTier', id, before, null)
  return NextResponse.json({ success: true })
}
