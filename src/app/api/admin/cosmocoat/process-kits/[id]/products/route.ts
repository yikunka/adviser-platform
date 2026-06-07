import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'
import {
  appendProductFlowItem,
  processFlowItemsForDb,
  removeProductFlowItems,
  resolveProcessFlowItems,
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

const productSchema = z.object({
  productId: z.string().trim().min(1),
  productName: z.string().trim().min(1).max(160).optional(),
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
})

const deleteSchema = z.object({
  id: z.string().trim().min(1),
})

const updateSchema = z.object({
  id: z.string().trim().min(1),
  irMinutes: processParameterSchema,
  irTemperature: processParameterSchema,
  uvEnergy: processParameterSchema,
  filmThickness: processParameterSchema,
  notes: optionalTextSchema(2000),
  processBlocks: z.array(processBlockSchema).max(50).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

async function resolveProductName(productId: string, productName?: string) {
  if (productName?.trim()) return productName.trim()
  const factoryProduct = await prisma.cosTableFactoryProduct.findUnique({
    where: { id: productId },
    select: { productCode: true, name: true },
  })
  if (factoryProduct) return `${factoryProduct.productCode} · ${factoryProduct.name}`
  return null
}

async function resolveAccessoryProducts(productIds: string[]) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map<string, string>()

  const products = await prisma.cosTableFactoryProduct.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, productCode: true, name: true },
  })
  if (products.length !== uniqueIds.length) {
    throw new Error('FACTORY_PRODUCT_NOT_FOUND')
  }
  return new Map(products.map(product => [product.id, `${product.productCode} · ${product.name}`]))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const resolvedName = await resolveProductName(parsed.data.productId, parsed.data.productName)
    if (!resolvedName) {
      return NextResponse.json({ error: '产品不存在，请提供有效的产品 ID 或产品名称' }, { status: 400 })
    }
    const accessoryNames = await resolveAccessoryProducts([
      parsed.data.hardenerProductId ?? '',
      parsed.data.thinnerProductId ?? '',
    ])

    const maxSort = await prisma.cosProcessKitProduct.aggregate({
      where: { kitId },
      _max: { sortOrder: true },
    })
    const sortOrder = parsed.data.sortOrder ?? ((maxSort._max.sortOrder ?? -1) + 1)

    const created = await prisma.cosProcessKitProduct.create({
      data: {
        kitId,
        productId: parsed.data.productId,
        productName: resolvedName,
        sortOrder,
        quantityRatio: parsed.data.quantityRatio || null,
        usageMethod: parsed.data.usageMethod || '',
        hardenerProductId: parsed.data.hardenerProductId || null,
        hardenerProductName: parsed.data.hardenerProductId ? accessoryNames.get(parsed.data.hardenerProductId)! : null,
        hardenerRatio: parsed.data.hardenerProductId ? (parsed.data.hardenerRatio || null) : null,
        thinnerProductId: parsed.data.thinnerProductId || null,
        thinnerProductName: parsed.data.thinnerProductId ? accessoryNames.get(parsed.data.thinnerProductId)! : null,
        thinnerRatio: parsed.data.thinnerProductId ? (parsed.data.thinnerRatio || null) : null,
        irMinutes: parsed.data.irMinutes || null,
        irTemperature: parsed.data.irTemperature || null,
        uvEnergy: parsed.data.uvEnergy || null,
        filmThickness: parsed.data.filmThickness || null,
        sprayViscosity: parsed.data.sprayViscosity || null,
        notes: parsed.data.notes || null,
        processBlocks: parsed.data.processBlocks,
      },
    })

    const currentKit = await prisma.cosProcessKit.findUnique({
      where: { id: kitId },
      include: { products: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    })
    if (currentKit) {
      const currentItems = resolveProcessFlowItems(
        currentKit.processFlowItems,
        currentKit.products.map(product => ({
          id: product.id,
          productName: product.productName,
          processBlocks: product.processBlocks,
        })),
      )
      const nextItems = appendProductFlowItem(currentItems, created.id)
      await prisma.cosProcessKit.update({
        where: { id: kitId },
        data: { processFlowItems: processFlowItemsForDb(nextItems) },
      })
    }

    const full = await getProcessKitById(kitId)
    return NextResponse.json({ kit: full }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'FACTORY_PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: '固化剂或稀释剂产品不存在' }, { status: 400 })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.cosProcessKitProduct.findFirst({
    where: { id: parsed.data.id, kitId },
  })
  if (!product) return NextResponse.json({ error: '产品明细不存在' }, { status: 404 })

  await prisma.cosProcessKitProduct.update({
    where: { id: parsed.data.id },
    data: {
      irMinutes: parsed.data.irMinutes !== undefined ? (parsed.data.irMinutes || null) : undefined,
      irTemperature: parsed.data.irTemperature !== undefined ? (parsed.data.irTemperature || null) : undefined,
      uvEnergy: parsed.data.uvEnergy !== undefined ? (parsed.data.uvEnergy || null) : undefined,
      filmThickness: parsed.data.filmThickness !== undefined ? (parsed.data.filmThickness || null) : undefined,
      notes: parsed.data.notes !== undefined ? (parsed.data.notes || null) : undefined,
      processBlocks: parsed.data.processBlocks,
    },
  })

  const full = await getProcessKitById(kitId)
  return NextResponse.json({ kit: full })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.cosProcessKitProduct.findFirst({
    where: { id: parsed.data.id, kitId },
  })
  if (!product) return NextResponse.json({ error: '产品明细不存在' }, { status: 404 })

  await prisma.cosProcessKitProduct.delete({ where: { id: parsed.data.id } })

  const currentKit = await prisma.cosProcessKit.findUnique({
    where: { id: kitId },
    include: { products: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  })
  if (currentKit) {
    const currentItems = resolveProcessFlowItems(
      currentKit.processFlowItems,
      currentKit.products.map(item => ({
        id: item.id,
        productName: item.productName,
        processBlocks: item.processBlocks,
      })),
    )
    const nextItems = removeProductFlowItems(currentItems, parsed.data.id)
    await prisma.cosProcessKit.update({
      where: { id: kitId },
      data: { processFlowItems: processFlowItemsForDb(nextItems) },
    })
  }

  const full = await getProcessKitById(kitId)
  return NextResponse.json({ kit: full })
}
