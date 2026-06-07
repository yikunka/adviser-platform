import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildProductionOrderItems,
  getProductionOrderById,
  loadRecipeForProduction,
  productionOrderItemKey,
  recipeItemsForProduction,
} from '@/lib/cosmocoat/production-orders'

const itemPatchSchema = z.object({
  id: z.string().trim().min(1).optional(),
  actualWeight: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
})

const patchSchema = z.object({
  totalWeight: z.coerce.number().min(0.001).optional(),
  batchNo: z.string().trim().max(64).optional(),
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  productionNotes: z.string().trim().max(2000).optional(),
  qualityNotes: z.string().trim().max(2000).optional(),
  packagingNotes: z.string().trim().max(2000).optional(),
  productionRequirements: z.string().trim().max(2000).optional(),
  qualityCheckRequirements: z.string().trim().max(2000).optional(),
  packagingRequirements: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'completed']).optional(),
  items: z.array(itemPatchSchema).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const { id } = await params
  try {
    const order = await getProductionOrderById(id)
    if (!order) return NextResponse.json({ error: '生产单不存在' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '生产单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableProductionOrder.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!current) return NextResponse.json({ error: '生产单不存在' }, { status: 404 })

  try {
    const totalWeight = parsed.data.totalWeight ?? Number(current.totalWeight)
    const totalWeightChanged =
      parsed.data.totalWeight != null
      && Math.abs(parsed.data.totalWeight - Number(current.totalWeight)) > 1e-9

    if (totalWeightChanged) {
      const recipe = await loadRecipeForProduction(current.recipeId)
      if (!recipe) return NextResponse.json({ error: '关联配方不存在' }, { status: 404 })

      const actualByKey = new Map<string, number | null>()
      for (const item of current.items) {
        actualByKey.set(
          productionOrderItemKey({
            itemType: item.componentRecipeId
              ? 'component_recipe'
              : item.productSemifinishedId
                ? 'product_semifinished'
                : 'raw_material',
            rawMaterialId: item.rawMaterialId ?? undefined,
            componentRecipeId: item.componentRecipeId ?? undefined,
            productSemifinishedId: item.productSemifinishedId ?? undefined,
          }),
          item.actualWeight != null ? Number(item.actualWeight) : null,
        )
      }
      if (parsed.data.items?.length) {
        for (const patch of parsed.data.items) {
          if (!patch.id || patch.actualWeight === undefined) continue
          const row = current.items.find(item => item.id === patch.id)
          if (!row) continue
          actualByKey.set(
            productionOrderItemKey({
              itemType: row.componentRecipeId
                ? 'component_recipe'
                : row.productSemifinishedId
                  ? 'product_semifinished'
                  : 'raw_material',
              rawMaterialId: row.rawMaterialId ?? undefined,
              componentRecipeId: row.componentRecipeId ?? undefined,
              productSemifinishedId: row.productSemifinishedId ?? undefined,
            }),
            patch.actualWeight,
          )
        }
      }

      const itemDrafts = buildProductionOrderItems(
        recipeItemsForProduction(recipe.items),
        totalWeight,
      )

      await prisma.cosTableProductionOrderItem.deleteMany({ where: { orderId: id } })
      if (itemDrafts.length > 0) {
        await prisma.cosTableProductionOrderItem.createMany({
          data: itemDrafts.map(item => ({
            orderId: id,
            rawMaterialId: item.rawMaterialId ?? null,
            componentRecipeId: item.componentRecipeId ?? null,
            productSemifinishedId: item.productSemifinishedId ?? null,
            sortOrder: item.sortOrder,
            productionCode: item.productionCode,
            materialName: item.materialName,
            percentage: item.percentage,
            requiredWeight: item.requiredWeight,
            actualWeight: actualByKey.get(productionOrderItemKey(item)) ?? null,
            notes: item.notes,
          })),
        })
      }
    }

    if (parsed.data.items?.length) {
      for (const patch of parsed.data.items) {
        if (!patch.id) continue
        await prisma.cosTableProductionOrderItem.updateMany({
          where: { id: patch.id, orderId: id },
          data: {
            ...(patch.actualWeight !== undefined ? { actualWeight: patch.actualWeight } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          },
        })
      }
    }

    await prisma.cosTableProductionOrder.update({
      where: { id },
      data: {
        totalWeight: parsed.data.totalWeight,
        batchNo: parsed.data.batchNo,
        startedAt: parsed.data.startedAt !== undefined
          ? (parsed.data.startedAt ? new Date(parsed.data.startedAt) : null)
          : undefined,
        finishedAt: parsed.data.finishedAt !== undefined
          ? (parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : null)
          : undefined,
        productionNotes: parsed.data.productionNotes,
        qualityNotes: parsed.data.qualityNotes,
        packagingNotes: parsed.data.packagingNotes,
        productionRequirements: parsed.data.productionRequirements,
        qualityCheckRequirements: parsed.data.qualityCheckRequirements,
        packagingRequirements: parsed.data.packagingRequirements,
        status: parsed.data.status,
      },
    })

    const order = await getProductionOrderById(id)
    return NextResponse.json({ order })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '生产单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProductionOrders' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableProductionOrder.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '生产单不存在' }, { status: 404 })

  await prisma.cosTableProductionOrder.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
