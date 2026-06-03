import type { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  computeItemAmount,
  computeItemPercentage,
  computeRecipeTotals,
} from '@/lib/cosmocoat/recipes'

type CostRefreshClient = Prisma.TransactionClient | PrismaClient

export type RecipeCostRefreshResult = {
  refreshedRecipeIds: string[]
  updatedRecipeIds: string[]
  updatedSemifinishedIds: string[]
}

const DECIMAL_DIGITS = 4
const MAX_RECIPE_REFRESH_PASSES = 20

function roundDecimal(value: number, digits = DECIMAL_DIGITS): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function decimalChanged(current: unknown, next: number | null, digits = DECIMAL_DIGITS): boolean {
  const currentNumber = numberOrNull(current)
  if (currentNumber === null || next === null) return currentNumber !== next
  return roundDecimal(currentNumber, digits) !== roundDecimal(next, digits)
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

async function refreshSingleRecipeCost(
  recipeId: string,
  db: CostRefreshClient,
): Promise<{ exists: boolean; changed: boolean; unitCost: number | null }> {
  const recipe = await db.cosTableRecipe.findUnique({
    where: { id: recipeId },
    include: {
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          rawMaterial: { select: { primaryPricePerKg: true } },
          componentRecipe: { select: { unitCost: true } },
          productSemifinished: { select: { unitPrice: true } },
          factoryProduct: { select: { unitPrice: true } },
        },
      },
    },
  })

  if (!recipe) return { exists: false, changed: false, unitCost: null }

  const batchQuantity = Number(recipe.batchQuantity)
  const totalQuantity = recipe.items.reduce((sum, item) => sum + Number(item.quantity), 0)
  const normalizedItems = recipe.items.map(item => {
    const quantity = Number(item.quantity)
    const sourcePrice = item.componentRecipe
      ? numberOrNull(item.componentRecipe.unitCost)
      : item.productSemifinished
        ? numberOrNull(item.productSemifinished.unitPrice)
        : item.factoryProduct
          ? numberOrNull(item.factoryProduct.unitPrice)
          : numberOrNull(item.rawMaterial?.primaryPricePerKg)
    const unitPrice = sourcePrice == null ? null : roundDecimal(sourcePrice)
    const amount = roundDecimal(computeItemAmount(quantity, unitPrice, totalQuantity, batchQuantity))
    const percentage = roundDecimal(computeItemPercentage(quantity, totalQuantity))
    return { item, quantity, unitPrice, amount, percentage }
  })

  let changed = false
  for (const row of normalizedItems) {
    const shouldUpdate =
      decimalChanged(row.item.unitPrice, row.unitPrice)
      || decimalChanged(row.item.amount, row.amount)
      || decimalChanged(row.item.percentage, row.percentage)

    if (!shouldUpdate) continue

    changed = true
    await db.cosTableRecipeItem.update({
      where: { id: row.item.id },
      data: {
        unitPrice: row.unitPrice,
        amount: row.amount,
        percentage: row.percentage,
      },
    })
  }

  const totals = computeRecipeTotals(
    normalizedItems.map(row => ({
      quantity: row.quantity,
      amount: row.amount,
      unitPrice: row.unitPrice,
    })),
    batchQuantity,
  )
  const unitCost = roundDecimal(totals.unitCost)

  if (decimalChanged(recipe.unitCost, unitCost)) {
    changed = true
  }

  await db.cosTableRecipe.update({
    where: { id: recipeId },
    data: { unitCost },
  })

  return { exists: true, changed, unitCost }
}

async function updateSourceSemifinishedPrices(
  recipeId: string,
  unitCost: number | null,
  db: CostRefreshClient,
): Promise<string[]> {
  const productionOrders = await db.cosTableProductionOrder.findMany({
    where: { recipeId },
    select: { id: true },
  })
  const orderIds = productionOrders.map(order => order.id)
  if (orderIds.length === 0) return []

  const rows = await db.cosTableProductSemifinished.findMany({
    where: { sourceProductionOrderId: { in: orderIds } },
    select: { id: true, unitPrice: true },
  })

  const changedIds: string[] = []
  for (const row of rows) {
    if (!decimalChanged(row.unitPrice, unitCost)) continue
    await db.cosTableProductSemifinished.update({
      where: { id: row.id },
      data: { unitPrice: unitCost },
    })
    changedIds.push(row.id)
  }
  return changedIds
}

async function findParentRecipeIds(recipeId: string, db: CostRefreshClient): Promise<string[]> {
  const rows = await db.cosTableRecipeItem.findMany({
    where: { componentRecipeId: recipeId },
    select: { recipeId: true },
  })
  return unique(rows.map(row => row.recipeId))
}

async function findRecipesUsingSemifinished(
  semifinishedIds: string[],
  db: CostRefreshClient,
): Promise<string[]> {
  if (semifinishedIds.length === 0) return []

  const rows = await db.cosTableRecipeItem.findMany({
    where: { productSemifinishedId: { in: semifinishedIds } },
    select: { recipeId: true },
  })
  return unique(rows.map(row => row.recipeId))
}

export async function refreshRecipeCostsCascade(
  recipeIds: string[],
  db: CostRefreshClient = prisma,
): Promise<RecipeCostRefreshResult> {
  const queue = unique(recipeIds)
  const queued = new Set(queue)
  const passCounts = new Map<string, number>()
  const refreshedRecipeIds = new Set<string>()
  const updatedRecipeIds = new Set<string>()
  const updatedSemifinishedIds = new Set<string>()

  const enqueue = (ids: string[]) => {
    for (const id of unique(ids)) {
      if (queued.has(id)) continue
      queue.push(id)
      queued.add(id)
    }
  }

  while (queue.length > 0) {
    const recipeId = queue.shift()!
    queued.delete(recipeId)

    const passCount = (passCounts.get(recipeId) ?? 0) + 1
    passCounts.set(recipeId, passCount)
    if (passCount > MAX_RECIPE_REFRESH_PASSES) {
      throw new Error('检测到配方成本循环引用，无法完成自动成本刷新')
    }

    const result = await refreshSingleRecipeCost(recipeId, db)
    if (!result.exists) continue

    refreshedRecipeIds.add(recipeId)
    if (result.changed) updatedRecipeIds.add(recipeId)

    const changedSemifinishedIds = await updateSourceSemifinishedPrices(
      recipeId,
      result.unitCost,
      db,
    )
    for (const id of changedSemifinishedIds) updatedSemifinishedIds.add(id)

    if (result.changed || passCount === 1) {
      enqueue(await findParentRecipeIds(recipeId, db))
    }
    if (changedSemifinishedIds.length > 0) {
      enqueue(await findRecipesUsingSemifinished(changedSemifinishedIds, db))
    }
  }

  return {
    refreshedRecipeIds: [...refreshedRecipeIds],
    updatedRecipeIds: [...updatedRecipeIds],
    updatedSemifinishedIds: [...updatedSemifinishedIds],
  }
}

export async function refreshRecipeCostsForRawMaterials(
  rawMaterialIds: string[],
  db: CostRefreshClient = prisma,
): Promise<RecipeCostRefreshResult> {
  const materialIds = unique(rawMaterialIds)
  if (materialIds.length === 0) {
    return { refreshedRecipeIds: [], updatedRecipeIds: [], updatedSemifinishedIds: [] }
  }

  const rows = await db.cosTableRecipeItem.findMany({
    where: { rawMaterialId: { in: materialIds } },
    select: { recipeId: true },
  })

  return refreshRecipeCostsCascade(rows.map(row => row.recipeId), db)
}

export async function refreshRecipeCostsForFactoryProducts(
  factoryProductIds: string[],
  db: CostRefreshClient = prisma,
): Promise<RecipeCostRefreshResult> {
  const productIds = unique(factoryProductIds)
  if (productIds.length === 0) {
    return { refreshedRecipeIds: [], updatedRecipeIds: [], updatedSemifinishedIds: [] }
  }

  const rows = await db.cosTableRecipeItem.findMany({
    where: { factoryProductId: { in: productIds } },
    select: { recipeId: true },
  })

  return refreshRecipeCostsCascade(rows.map(row => row.recipeId), db)
}

