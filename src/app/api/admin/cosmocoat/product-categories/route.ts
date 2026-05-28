import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildCategoryTree,
  listProductCategories,
  serializeProductCategory,
  validateParentCategory,
} from '@/lib/cosmocoat/product-categories'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(''),
  parentCategoryId: z.string().trim().min(1).nullable().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只能包含小写字母、数字和连字符'),
  image: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function missingTableResponse() {
  return NextResponse.json(
    {
      error: '产品类别表不存在，请先运行数据库迁移',
      migration: '20260528120000_add_cos_table_product_categories',
    },
    { status: 503 },
  )
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const tree = req.nextUrl.searchParams.get('tree') === '1'
  const activeOnly = req.nextUrl.searchParams.get('activeOnly') === '1'

  try {
    const categories = await listProductCategories()
    if (!tree) {
      return NextResponse.json({ categories })
    }

    const treeData = buildCategoryTree(
      categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parentCategoryId: c.parentCategoryId,
        isActive: c.isActive,
      })),
      { activeOnly },
    )
    return NextResponse.json({ categories, tree: treeData })
  } catch (err) {
    if (isMissingTable(err)) return missingTableResponse()
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const parentCategoryId = parsed.data.parentCategoryId ?? null
  const parentCheck = await validateParentCategory({ parentCategoryId })
  if (!parentCheck.ok) {
    return NextResponse.json({ error: parentCheck.error }, { status: 400 })
  }

  try {
    const slugConflict = await prisma.cosTableProductCategory.findUnique({
      where: { slug: parsed.data.slug },
    })
    if (slugConflict) {
      return NextResponse.json({ error: 'slug 已存在' }, { status: 409 })
    }

    const created = await prisma.cosTableProductCategory.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        parentCategoryId,
        slug: parsed.data.slug,
        image: parsed.data.image ?? null,
        isActive: parsed.data.isActive,
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true, factoryProducts: true } },
      },
    })

    return NextResponse.json({ category: serializeProductCategory(created) }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) return missingTableResponse()
    throw err
  }
}
