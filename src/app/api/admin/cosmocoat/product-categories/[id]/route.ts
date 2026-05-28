import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { serializeProductCategory, validateParentCategory } from '@/lib/cosmocoat/product-categories'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  parentCategoryId: z.string().trim().min(1).nullable().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  image: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableProductCategory.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '类别不存在' }, { status: 404 })

  const parentCategoryId =
    parsed.data.parentCategoryId !== undefined ? parsed.data.parentCategoryId : current.parentCategoryId

  if ('parentCategoryId' in parsed.data) {
    const parentCheck = await validateParentCategory({ categoryId: id, parentCategoryId })
    if (!parentCheck.ok) {
      return NextResponse.json({ error: parentCheck.error }, { status: 400 })
    }
  }

  if (parsed.data.slug && parsed.data.slug !== current.slug) {
    const conflict = await prisma.cosTableProductCategory.findUnique({ where: { slug: parsed.data.slug } })
    if (conflict) return NextResponse.json({ error: 'slug 已存在' }, { status: 409 })
  }

  try {
    const category = await prisma.cosTableProductCategory.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true, factoryProducts: true } },
      },
    })
    return NextResponse.json({ category: serializeProductCategory(category) })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '产品类别表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableProductCategory.findUnique({
    where: { id },
    include: { _count: { select: { children: true, factoryProducts: true } } },
  })
  if (!current) return NextResponse.json({ error: '类别不存在' }, { status: 404 })

  if (current._count.children > 0) {
    return NextResponse.json({ error: '请先删除或移动子类别' }, { status: 409 })
  }

  if (current._count.factoryProducts > 0) {
    return NextResponse.json({ error: '该类别下仍有工厂产品，请先移除或重新分类' }, { status: 409 })
  }

  await prisma.cosTableProductCategory.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
