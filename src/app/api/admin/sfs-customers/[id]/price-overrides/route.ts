import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { resolveSfsCustomerIdFromRowId } from '@/lib/sfs/resolve-customer-row-id'
import { SFS_SPEC_CATEGORIES } from '@/lib/sfs/diamond-spec-options'

const replaceSchema = z.object({
  overrides: z
    .array(
      z.object({
        category: z.enum(SFS_SPEC_CATEGORIES),
        value: z.string().trim().min(1).max(120),
        price: z.coerce.number().finite().min(-1_000_000).max(1_000_000),
      }),
    )
    .max(500),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenus: ['sfsCustomers', 'sfsFactory'] })
  if (error) return error

  const { id } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) return NextResponse.json({ customerId: null, overrides: [] })

  const overrides = await prisma.sfsCustomerPriceOverride.findMany({
    where: { customerId },
    orderBy: [{ category: 'asc' }, { value: 'asc' }],
  })
  return NextResponse.json({ customerId, overrides })
}

/** Full replacement of a customer's price overrides. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsFactory' })
  if (error) return error

  const { id } = await params
  const customerId = await resolveSfsCustomerIdFromRowId(decodeURIComponent(id))
  if (!customerId) {
    return NextResponse.json({ error: 'Save a customer profile before setting price overrides.' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = replaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // De-duplicate on (category, value); the last entry wins.
  const deduped = new Map<string, { category: (typeof parsed.data.overrides)[number]['category']; value: string; price: number }>()
  for (const item of parsed.data.overrides) {
    deduped.set(`${item.category}|${item.value}`, item)
  }

  const before = await prisma.sfsCustomerPriceOverride.findMany({ where: { customerId } })

  const overrides = await prisma.$transaction(async tx => {
    await tx.sfsCustomerPriceOverride.deleteMany({ where: { customerId } })
    if (deduped.size > 0) {
      await tx.sfsCustomerPriceOverride.createMany({
        data: [...deduped.values()].map(item => ({
          customerId,
          category: item.category,
          value: item.value,
          price: item.price,
        })),
      })
    }
    return tx.sfsCustomerPriceOverride.findMany({
      where: { customerId },
      orderBy: [{ category: 'asc' }, { value: 'asc' }],
    })
  })

  await logAudit(session!.user.id, 'UPDATE', 'SfsCustomerPriceOverrides', customerId, before, overrides)
  return NextResponse.json({ customerId, overrides })
}
