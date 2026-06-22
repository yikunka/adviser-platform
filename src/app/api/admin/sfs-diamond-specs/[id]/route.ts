import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { SFS_SPEC_CATEGORIES } from '@/lib/sfs/diamond-spec-options'

const updateSchema = z.object({
  category: z.enum(SFS_SPEC_CATEGORIES).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  value: z.string().trim().max(120).optional(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  price: z.coerce.number().finite().min(-1_000_000).max(1_000_000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
})

function uniqueMessage(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    ? '同一分类下已存在相同 value 的规格选项'
    : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const { id } = await params
  const before = await prisma.sfsDiamondSpecOption.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  try {
    const option = await prisma.sfsDiamondSpecOption.update({
      where: { id },
      data: {
        ...(data.category ? { category: data.category } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.value !== undefined ? { value: data.value.trim() || (data.label ?? before.label) } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl?.trim() || null } : {}),
        ...(data.price !== undefined ? { price: data.price ?? null } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    await logAudit(session.user.id, 'UPDATE', 'SfsDiamondSpecOption', option.id, before, option)
    return NextResponse.json({ option })
  } catch (err) {
    const message = uniqueMessage(err)
    if (message) return NextResponse.json({ error: message }, { status: 409 })
    console.error('[admin/sfs-diamond-specs] update failed', err)
    return NextResponse.json({ error: 'Failed to update spec option' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsDiamondSpecs' })
  if (error) return error

  const { id } = await params
  const before = await prisma.sfsDiamondSpecOption.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.sfsDiamondSpecOption.delete({ where: { id } })
  await logAudit(session.user.id, 'DELETE', 'SfsDiamondSpecOption', id, before, null)
  return NextResponse.json({ success: true })
}
