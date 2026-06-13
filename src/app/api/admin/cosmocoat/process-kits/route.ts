import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  generateProcessKitCode,
  getProcessKitById,
  kitInclude,
  serializeProcessKit,
} from '@/lib/cosmocoat/process-kits'
import { normalizePerformanceStandards } from '@/lib/cosmocoat/process-kit-standards'
import {
  deriveProcessFlowItemsFromLegacy,
  normalizeProcessFlowItems,
  processFlowItemsForDb,
  remapProcessFlowProductIds,
  type ProcessFlowItem,
} from '@/lib/cosmocoat/process-flow'

const processParameterSchema = z.preprocess(
  value => (value === undefined || value === null ? value : String(value)),
  z.string().trim().max(64).nullable().optional(),
)

const optionalIdSchema = z.preprocess(
  value => {
    if (value === undefined || value === null) return value
    const trimmed = String(value).trim()
    return trimmed || null
  },
  z.string().min(1).nullable().optional(),
)

const optionalTextSchema = (max: number) => z.preprocess(
  value => (value === undefined || value === null ? value : String(value)),
  z.string().trim().max(max).nullable().optional(),
)

const processBlockSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(2000),
})

const processFlowItemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().trim().min(1).max(80),
    type: z.literal('product'),
    kitProductId: z.string().trim().min(1),
  }),
  z.object({
    id: z.string().trim().min(1).max(80),
    type: z.literal('process'),
    text: z.string().trim().min(1).max(2000),
  }),
])

const kitSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160),
  description: optionalTextSchema(2000),
  materials: z.array(z.string()).optional().default([]),
  performanceStandards: z.array(z.string()).optional().default([]),
  otherNote: optionalTextSchema(500),
  processDescription: optionalTextSchema(2000),
  processFlowNote: optionalTextSchema(2000),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().default('DRAFT'),
  products: z.array(z.object({
    clientId: z.string().trim().min(1).max(80).optional(),
    productId: z.string().trim().min(1),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    quantityRatio: optionalTextSchema(64),
    usageMethod: optionalTextSchema(2000),
    hardenerProductId: optionalIdSchema,
    hardenerRatio: optionalTextSchema(64),
    thinnerProductId: optionalIdSchema,
    thinnerRatio: optionalTextSchema(64),
    irMinutes: processParameterSchema,
    irTemperature: processParameterSchema,
    uvEnergy: processParameterSchema,
    filmThickness: processParameterSchema,
    sprayViscosity: processParameterSchema,
    notes: optionalTextSchema(2000),
    processBlocks: z.array(processBlockSchema).max(50).optional().default([]),
  })).max(100).optional().default([]),
  processFlowItems: z.array(processFlowItemSchema).max(200).optional().default([]),
})

function isMissingSchema(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2021' || error.code === 'P2022')
}

async function resolveProductRows(products: z.infer<typeof kitSchema>['products']) {
  if (products.length === 0) return []

  const productIds = [...new Set(products.flatMap(product => [
    product.productId,
    product.hardenerProductId,
    product.thinnerProductId,
  ].filter((id): id is string => Boolean(id))))]
  const factoryProducts = await prisma.cosTableFactoryProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, productCode: true, name: true },
  })
  const productNameById = new Map(factoryProducts.map(product => [product.id, `${product.productCode} · ${product.name}`]))

  if (productNameById.size !== productIds.length) {
    throw new Error('FACTORY_PRODUCT_NOT_FOUND')
  }

  return products.map((product, index) => ({
    clientId: product.clientId?.trim() || `${product.sortOrder ?? index}`,
    productId: product.productId,
    productName: productNameById.get(product.productId)!,
    sortOrder: product.sortOrder ?? index,
    quantityRatio: product.quantityRatio || null,
    usageMethod: product.usageMethod || '',
    hardenerProductId: product.hardenerProductId || null,
    hardenerProductName: product.hardenerProductId ? productNameById.get(product.hardenerProductId)! : null,
    hardenerRatio: product.hardenerProductId ? (product.hardenerRatio || null) : null,
    thinnerProductId: product.thinnerProductId || null,
    thinnerProductName: product.thinnerProductId ? productNameById.get(product.thinnerProductId)! : null,
    thinnerRatio: product.thinnerProductId ? (product.thinnerRatio || null) : null,
    irMinutes: product.irMinutes || null,
    irTemperature: product.irTemperature || null,
    uvEnergy: product.uvEnergy || null,
    filmThickness: product.filmThickness || null,
    sprayViscosity: product.sprayViscosity || null,
    notes: product.notes || null,
    processBlocks: product.processBlocks,
  }))
}

function buildInitialProcessFlowItems(
  productRows: Awaited<ReturnType<typeof resolveProductRows>>,
  createdProducts: { id: string; sortOrder: number }[],
  requestedItems: ProcessFlowItem[],
): ProcessFlowItem[] {
  const idMap = new Map<string, string>()
  productRows.forEach((row, index) => {
    const created = createdProducts.find(product => product.sortOrder === (row.sortOrder ?? index))
      ?? createdProducts[index]
    if (created) idMap.set(row.clientId, created.id)
  })

  const normalizedRequested = normalizeProcessFlowItems(requestedItems)
  if (normalizedRequested.length > 0) {
    return remapProcessFlowProductIds(normalizedRequested, idMap)
  }

  const legacyProducts = productRows.map((row, index) => ({
    id: createdProducts[index]?.id ?? row.clientId,
    productName: row.productName,
    processBlocks: row.processBlocks,
  }))
  return deriveProcessFlowItemsFromLegacy(legacyProducts)
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const status = req.nextUrl.searchParams.get('status')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosProcessKitWhereInput = {
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status && ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)
      ? { status: status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }
      : {}),
  }

  try {
    const [total, items] = await Promise.all([
      prisma.cosProcessKit.count({ where }),
      prisma.cosProcessKit.findMany({
        where,
        include: kitInclude,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      items: items.map(kit => serializeProcessKit(kit)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingSchema(err)) {
      return NextResponse.json({ error: '工艺书表结构未同步，请先运行数据库迁移' }, { status: 503 })
    }
    console.error('[process-kits GET]', err)
    return NextResponse.json({ error: '加载工艺书列表失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = kitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const code = parsed.data.code?.trim() || await generateProcessKitCode()
    const existing = await prisma.cosProcessKit.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '工艺书编号已存在' }, { status: 409 })
    const productRows = await resolveProductRows(parsed.data.products)
    const requestedFlowItems = normalizeProcessFlowItems(parsed.data.processFlowItems)

    const kit = await prisma.cosProcessKit.create({
      data: {
        code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        materials: parsed.data.materials ?? [],
        performanceStandards: normalizePerformanceStandards(parsed.data.performanceStandards ?? []),
        otherNote: parsed.data.otherNote || null,
        processDescription: parsed.data.processDescription || null,
        processFlowNote: parsed.data.processFlowNote || null,
        status: parsed.data.status,
        createdBy: session!.user.id,
        createdByName: session!.user.name ?? session!.user.email ?? null,
        ...(productRows.length > 0
          ? {
              products: {
                create: productRows.map(({ clientId: _clientId, ...row }) => row),
              },
            }
          : {}),
      },
      include: {
        products: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, sortOrder: true },
        },
      },
    })

    const processFlowItems = buildInitialProcessFlowItems(
      productRows,
      kit.products,
      requestedFlowItems,
    )

    if (processFlowItems.length > 0) {
      await prisma.cosProcessKit.update({
        where: { id: kit.id },
        data: { processFlowItems: processFlowItemsForDb(processFlowItems) },
      })
    }

    const full = await getProcessKitById(kit.id)
    return NextResponse.json({ kit: full }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'FACTORY_PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: '工厂产品不存在' }, { status: 400 })
    }
    if (isMissingSchema(err)) {
      return NextResponse.json({ error: '工艺书表结构未同步，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
