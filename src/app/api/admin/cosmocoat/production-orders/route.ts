import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildProductionOrderItems,
  generateProductionOrderCode,
  getProductionOrderById,
  orderInclude,
  resolveProductCurrentRecipe,
  serializeProductionOrder,
} from '@/lib/cosmocoat/production-orders'

const itemInputSchema = z.object({
  rawMaterialId: z.string().trim().min(1),
  actualWeight: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
})

const orderSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  factoryProductId: z.string().trim().min(1),
  totalWeight: z.coerce.number().min(0.001),
  batchNo: z.string().trim().max(64).optional().default(''),
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  productionNotes: z.string().trim().max(2000).optional().default(''),
  qualityNotes: z.string().trim().max(2000).optional().default(''),
  packagingNotes: z.string().trim().max(2000).optional().default(''),
  status: z.enum(['draft', 'completed']).optional().default('draft'),
  items: z.array(itemInputSchema).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosTableProductionOrderWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { batchNo: { contains: q, mode: 'insensitive' } },
          { factoryProduct: { name: { contains: q, mode: 'insensitive' } } },
          { factoryProduct: { productCode: { contains: q, mode: 'insensitive' } } },
          { recipe: { code: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {}

  try {
    const [total, items] = await Promise.all([
      prisma.cosTableProductionOrder.count({ where }),
      prisma.cosTableProductionOrder.findMany({
        where,
        include: orderInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      items: items.map(serializeProductionOrder),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '生产单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const resolved = await resolveProductCurrentRecipe(parsed.data.factoryProductId)
    if ('error' in resolved) {
      if (resolved.error === 'PRODUCT_NOT_FOUND') {
        return NextResponse.json({ error: '产品不存在' }, { status: 404 })
      }
      return NextResponse.json({ error: '该产品未设置当前配方，请先在工厂产品中指定当前配方' }, { status: 400 })
    }

    const { product, recipe } = resolved
    const code = parsed.data.code?.trim() || await generateProductionOrderCode()

    const existing = await prisma.cosTableProductionOrder.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '生产单编号已存在' }, { status: 409 })

    const itemDrafts = buildProductionOrderItems(
      recipe.items.map(item => ({
        sortOrder: item.sortOrder,
        quantity: Number(item.quantity),
        percentage: item.percentage != null ? Number(item.percentage) : null,
        notes: item.notes,
        rawMaterial: {
          id: item.rawMaterial.id,
          productionCode: item.rawMaterial.productionCode,
          name: item.rawMaterial.name,
        },
      })),
      parsed.data.totalWeight,
    )

    if (itemDrafts.length === 0) {
      return NextResponse.json({ error: '当前配方没有原料明细，无法创建生产单' }, { status: 400 })
    }

    const inputByMaterial = new Map(
      (parsed.data.items ?? []).map(item => [item.rawMaterialId, item]),
    )

    const order = await prisma.cosTableProductionOrder.create({
      data: {
        code,
        factoryProductId: product.id,
        recipeId: recipe.id,
        totalWeight: parsed.data.totalWeight,
        batchNo: parsed.data.batchNo,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
        finishedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : null,
        productionNotes: parsed.data.productionNotes,
        qualityNotes: parsed.data.qualityNotes,
        packagingNotes: parsed.data.packagingNotes,
        status: parsed.data.status,
        items: {
          create: itemDrafts.map(item => {
            const input = inputByMaterial.get(item.rawMaterialId)
            return {
              rawMaterialId: item.rawMaterialId,
              sortOrder: item.sortOrder,
              productionCode: item.productionCode,
              materialName: item.materialName,
              percentage: item.percentage,
              requiredWeight: item.requiredWeight,
              actualWeight: input?.actualWeight ?? item.actualWeight,
              notes: input?.notes ?? item.notes,
            }
          }),
        },
      },
    })

    const full = await getProductionOrderById(order.id)
    return NextResponse.json({ order: full }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '生产单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
