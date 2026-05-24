import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const patchSchema = z.object({
  code: z.string().trim().min(1).max(16).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableRecipeCategory.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '目录不存在' }, { status: 404 })

  if (parsed.data.code && parsed.data.code !== current.code) {
    const conflict = await prisma.cosTableRecipeCategory.findUnique({ where: { code: parsed.data.code } })
    if (conflict) return NextResponse.json({ error: '目录编号已存在' }, { status: 409 })
  }

  const category = await prisma.cosTableRecipeCategory.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ category })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableRecipeCategory.findUnique({
    where: { id },
    include: { _count: { select: { recipes: true } } },
  })
  if (!current) return NextResponse.json({ error: '目录不存在' }, { status: 404 })

  await prisma.cosTableRecipeCategory.delete({ where: { id } })
  return NextResponse.json({ success: true, deletedRecipes: current._count.recipes })
}
