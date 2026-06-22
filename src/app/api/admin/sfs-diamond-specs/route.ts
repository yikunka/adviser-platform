import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { SFS_SPEC_CATEGORIES } from '@/lib/sfs/diamond-spec-options'

const createSchema = z.object({
  category: z.enum(SFS_SPEC_CATEGORIES),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().max(120).optional(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  // Price meaning depends on category; COLOR/SHAPE/METAL may be negative adjustments.
  price: z.coerce.number().finite().min(-1_000_000).max(1_000_000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
})

function toUniqueConstraintMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2002'
  ) {
    return '同一分类下已存在相同 value 的规格选项'
  }
  return null
}

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const options = await prisma.sfsDiamondSpecOption.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ options })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const value = parsed.data.value?.trim() || parsed.data.label

  try {
    const option = await prisma.sfsDiamondSpecOption.create({
      data: {
        category: parsed.data.category,
        label: parsed.data.label,
        value,
        imageUrl: parsed.data.imageUrl?.trim() || null,
        price: parsed.data.price ?? null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        createdById: session.user.id,
      },
    })
    await logAudit(session.user.id, 'CREATE', 'SfsDiamondSpecOption', option.id, null, option)
    return NextResponse.json({ option }, { status: 201 })
  } catch (err) {
    const message = toUniqueConstraintMessage(err)
    if (message) return NextResponse.json({ error: message }, { status: 409 })
    console.error('[admin/sfs-diamond-specs] create failed', err)
    return NextResponse.json({ error: 'Failed to create spec option' }, { status: 500 })
  }
}
