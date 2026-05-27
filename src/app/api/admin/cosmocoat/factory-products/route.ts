import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getFactoryProductById, productInclude, serializeFactoryProduct, syncProductRecipes } from '@/lib/cosmocoat/factory-products'

const productSchema = z.object({
  productCode: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(160),
  unit: z.string().trim().min(1).max(16).optional().default('kg'),
  unitPrice: z.coerce.number().min(0).nullable().optional().default(null),
  notes: z.string().trim().max(1000).optional().default(''),
  productionRequirements: z.string().trim().max(2000).optional().default(''),
  qualityCheckRequirements: z.string().trim().max(2000).optional().default(''),
  packagingRequirements: z.string().trim().max(2000).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  recipeIds: z.array(z.string().trim().min(1)).optional().default([]),
  currentRecipeId: z.string().trim().min(1).nullable().optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosTableFactoryProductWhereInput = q
    ? {
        OR: [
          { productCode: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  try {
    const [total, items] = await Promise.all([
      prisma.cosTableFactoryProduct.count({ where }),
      prisma.cosTableFactoryProduct.findMany({
        where,
        include: productInclude,
        orderBy: [{ sortOrder: 'asc' }, { productCode: 'asc' }],
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      items: await Promise.all(items.map(serializeFactoryProduct)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const existing = await prisma.cosTableFactoryProduct.findUnique({
      where: { productCode: parsed.data.productCode },
    })
    if (existing) return NextResponse.json({ error: '产品编号已存在' }, { status: 409 })

    const product = await prisma.cosTableFactoryProduct.create({
      data: {
        productCode: parsed.data.productCode,
        name: parsed.data.name,
        unit: parsed.data.unit,
        unitPrice: parsed.data.unitPrice,
        notes: parsed.data.notes,
        productionRequirements: parsed.data.productionRequirements,
        qualityCheckRequirements: parsed.data.qualityCheckRequirements,
        packagingRequirements: parsed.data.packagingRequirements,
        sortOrder: parsed.data.sortOrder,
      },
    })

    try {
      await syncProductRecipes(product.id, parsed.data.recipeIds, parsed.data.currentRecipeId ?? null)
    } catch (e) {
      await prisma.cosTableFactoryProduct.delete({ where: { id: product.id } })
      if (e instanceof Error && e.message === 'RECIPE_NOT_FOUND') {
        return NextResponse.json({ error: '关联的配方不存在' }, { status: 400 })
      }
      throw e
    }

    const full = await getFactoryProductById(product.id)
    return NextResponse.json({ product: full }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
