import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildProductionOrderItems,
  createOrderItemRows,
  generateProductionOrderCode,
  getProductionOrderById,
  orderInclude,
  productionOrderItemKey,
  recipeItemsForProduction,
  resolveProductCurrentRecipe,
  serializeProductionOrder,
} from '@/lib/cosmocoat/production-orders'
import { buildProductionOrderWhere } from '@/lib/cosmocoat/production-order-filters'

const itemInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  itemType: z.enum(['raw_material', 'component_recipe', 'product_semifinished', 'manual']).optional(),
  rawMaterialId: z.string().trim().min(1).optional(),
  componentRecipeId: z.string().trim().min(1).optional(),
  productSemifinishedId: z.string().trim().min(1).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  productionCode: z.string().trim().max(100).optional(),
  materialName: z.string().trim().max(200).optional(),
  percentage: z.coerce.number().min(0).optional(),
  requiredWeight: z.coerce.number().min(0).optional(),
  actualWeight: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((data, ctx) => {
  const sourceCount = [
    Boolean(data.rawMaterialId),
    Boolean(data.componentRecipeId),
    Boolean(data.productSemifinishedId),
  ].filter(Boolean).length
  if (sourceCount > 1) {
    ctx.addIssue({ code: 'custom', message: 'Each item can reference at most one material source' })
  }
  if (sourceCount === 0 && (!data.productionCode?.trim() || !data.materialName?.trim())) {
    ctx.addIssue({ code: 'custom', message: 'Manual item requires production code and material name' })
  }
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
  productionRequirements: z.string().trim().max(2000).optional().default(''),
  qualityCheckRequirements: z.string().trim().max(2000).optional().default(''),
  packagingRequirements: z.string().trim().max(2000).optional().default(''),
  productionEmployeeId: z.union([z.string().trim().min(1), z.literal(''), z.null()]).optional(),
  status: z.enum(['draft', 'completed']).optional().default('draft'),
  items: z.array(itemInputSchema).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function manualOrderItemRows(items: z.infer<typeof itemInputSchema>[]) {
  return items
    .filter(item => !item.rawMaterialId && !item.componentRecipeId && !item.productSemifinishedId)
    .map((item, index) => ({
      rawMaterialId: null,
      componentRecipeId: null,
      productSemifinishedId: null,
      sortOrder: item.sortOrder ?? 1000 + index,
      productionCode: item.productionCode!.trim(),
      materialName: item.materialName!.trim(),
      percentage: item.percentage ?? 0,
      requiredWeight: item.requiredWeight ?? 0,
      actualWeight: item.actualWeight ?? null,
      notes: item.notes ?? '',
    }))
}

async function resolveProductionEmployeeId(raw: string | null | undefined) {
  const id = (raw ?? '').trim()
  if (!id) return null
  const employee = await prisma.cosEmployee.findUnique({
    where: { id },
    select: { id: true, employeeType: true, isActive: true },
  })
  if (!employee) throw new Error('PRODUCTION_EMPLOYEE_NOT_FOUND')
  if (employee.employeeType !== 'PRODUCTION') throw new Error('NOT_PRODUCTION_EMPLOYEE')
  if (!employee.isActive) throw new Error('PRODUCTION_EMPLOYEE_INACTIVE')
  return employee.id
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const factoryProductId = req.nextUrl.searchParams.get('factoryProductId')?.trim() ?? ''
  const createdFrom = req.nextUrl.searchParams.get('createdFrom')?.trim() ?? ''
  const createdTo = req.nextUrl.searchParams.get('createdTo')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where = buildProductionOrderWhere({ q, factoryProductId, createdFrom, createdTo })

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
      recipeItemsForProduction(recipe.items),
      parsed.data.totalWeight,
    )

    const manualRows = manualOrderItemRows(parsed.data.items ?? [])

    if (itemDrafts.length === 0 && manualRows.length === 0) {
      return NextResponse.json({ error: '当前配方没有可投料明细，无法创建生产单' }, { status: 400 })
    }

    const inputByKey = new Map(
      (parsed.data.items ?? []).map(item => [
        productionOrderItemKey({
          itemType: item.componentRecipeId
            ? 'component_recipe'
            : item.productSemifinishedId
              ? 'product_semifinished'
              : 'raw_material',
          rawMaterialId: item.rawMaterialId,
          componentRecipeId: item.componentRecipeId,
          productSemifinishedId: item.productSemifinishedId,
        }),
        item,
      ]),
    )

    let productionEmployeeId: string | null = null
    if (parsed.data.productionEmployeeId !== undefined) {
      productionEmployeeId = await resolveProductionEmployeeId(parsed.data.productionEmployeeId)
    }

    const order = await prisma.cosTableProductionOrder.create({
      data: {
        code,
        factoryProductId: product.id,
        recipeId: recipe.id,
        productionEmployeeId,
        totalWeight: parsed.data.totalWeight,
        batchNo: parsed.data.batchNo,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
        finishedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : null,
        productionNotes: parsed.data.productionNotes,
        qualityNotes: parsed.data.qualityNotes,
        packagingNotes: parsed.data.packagingNotes,
        productionRequirements: parsed.data.productionRequirements || product.productionRequirements,
        qualityCheckRequirements: parsed.data.qualityCheckRequirements || product.qualityCheckRequirements,
        packagingRequirements: parsed.data.packagingRequirements || product.packagingRequirements,
        status: parsed.data.status,
        items: {
          create: [
            ...createOrderItemRows(itemDrafts, inputByKey),
            ...manualRows,
          ],
        },
      },
    })

    const full = await getProductionOrderById(order.id)
    return NextResponse.json({ order: full }, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCTION_EMPLOYEE_NOT_FOUND') {
        return NextResponse.json({ error: '所选生产人员不存在' }, { status: 400 })
      }
      if (err.message === 'NOT_PRODUCTION_EMPLOYEE') {
        return NextResponse.json({ error: '仅可关联「生产人员」类型的员工' }, { status: 400 })
      }
      if (err.message === 'PRODUCTION_EMPLOYEE_INACTIVE') {
        return NextResponse.json({ error: '所选生产人员已停用' }, { status: 400 })
      }
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '生产单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
