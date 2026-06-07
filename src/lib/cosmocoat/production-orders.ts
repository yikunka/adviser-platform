import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  buildProductionOrderItems,
  productionOrderItemKey,
  recipeItemsForProduction,
  recipeToOrderRequirements,
} from '@/lib/cosmocoat/recipes'

export type { ProductionOrderItemDraft } from '@/lib/cosmocoat/recipes'
export {
  buildProductionOrderItems,
  computeRequiredWeight,
  formatWeight,
  productionOrderItemKey,
  recipeItemsForProduction,
} from '@/lib/cosmocoat/recipes'

const recipeItemsInclude = {
  orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  include: {
    rawMaterial: true,
    componentRecipe: true,
    productSemifinished: true,
  },
}

export const orderInclude = {
  factoryProduct: {
    select: { id: true, productCode: true, name: true, unit: true },
  },
  recipe: {
    select: {
      id: true,
      code: true,
      name: true,
      productionSpeedRequirements: true,
      productionTimeRequirements: true,
      packagingRequirements: true,
      productionNotes: true,
      qcTestStandard: true,
      qcTestItems: true,
      qcResult: true,
      viscosity: true,
      viscosityUnit: true,
    },
  },
  items: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      rawMaterial: {
        select: { id: true, productionCode: true, name: true, attributeCode: true },
      },
      componentRecipe: {
        select: { id: true, code: true, name: true },
      },
      productSemifinished: {
        select: { id: true, code: true, name: true },
      },
    },
  },
} satisfies Prisma.CosTableProductionOrderInclude

export async function generateProductionOrderCode(): Promise<string> {
  const now = new Date()
  const prefix = `SC${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const count = await prisma.cosTableProductionOrder.count({
    where: { code: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(3, '0')}`
}

export async function loadRecipeForProduction(recipeId: string) {
  return prisma.cosTableRecipe.findUnique({
    where: { id: recipeId },
    include: {
      items: recipeItemsInclude,
    },
  })
}

export async function resolveProductCurrentRecipe(factoryProductId: string) {
  const product = await prisma.cosTableFactoryProduct.findUnique({
    where: { id: factoryProductId },
    include: {
      currentRecipe: {
        select: {
          id: true,
          code: true,
          name: true,
          productionSpeedRequirements: true,
          productionTimeRequirements: true,
          packagingRequirements: true,
          productionNotes: true,
          qcTestStandard: true,
          qcTestItems: true,
          qcResult: true,
          viscosity: true,
          viscosityUnit: true,
          items: recipeItemsInclude,
        },
      },
    },
  })
  if (!product) return { error: 'PRODUCT_NOT_FOUND' as const }
  if (!product.currentRecipe) return {
    error: 'NO_CURRENT_RECIPE' as const,
    product: {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      unit: product.unit,
    },
  }
  const requirements = recipeToOrderRequirements(product.currentRecipe)
  return {
    product: {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      unit: product.unit,
      ...requirements,
    },
    recipe: product.currentRecipe,
  }
}

function serializeOrderItem(item: {
  id: string
  sortOrder: number
  productionCode: string
  materialName: string
  percentage: unknown
  requiredWeight: unknown
  actualWeight: unknown
  notes: string
  rawMaterial: { id: string; productionCode: string; name: string; attributeCode: string } | null
  componentRecipe: { id: string; code: string; name: string } | null
  productSemifinished: { id: string; code: string; name: string } | null
}) {
  const itemType = item.componentRecipe
    ? 'component_recipe' as const
    : item.productSemifinished
      ? 'product_semifinished' as const
      : 'raw_material' as const
  return {
    id: item.id,
    itemType,
    sortOrder: item.sortOrder,
    productionCode: item.productionCode,
    materialName: item.materialName,
    percentage: Number(item.percentage),
    requiredWeight: Number(item.requiredWeight),
    actualWeight: item.actualWeight != null ? Number(item.actualWeight) : null,
    notes: item.notes,
    rawMaterial: item.rawMaterial,
    componentRecipe: item.componentRecipe,
    productSemifinished: item.productSemifinished,
  }
}

export function serializeProductionOrder(order: {
  id: string
  code: string
  factoryProductId: string
  recipeId: string
  totalWeight: unknown
  batchNo: string
  startedAt: Date | null
  finishedAt: Date | null
  productionNotes: string
  qualityNotes: string
  packagingNotes: string
  productionRequirements: string
  qualityCheckRequirements: string
  packagingRequirements: string
  status: string
  createdAt: Date
  updatedAt: Date
  factoryProduct: { id: string; productCode: string; name: string; unit: string }
  recipe: { id: string; code: string; name: string }
  items: Array<Parameters<typeof serializeOrderItem>[0]>
}) {
  const items = order.items.map(serializeOrderItem)
  const requiredTotal = items.reduce((sum, item) => sum + item.requiredWeight, 0)

  return {
    id: order.id,
    code: order.code,
    factoryProductId: order.factoryProductId,
    recipeId: order.recipeId,
    totalWeight: Number(order.totalWeight),
    batchNo: order.batchNo,
    startedAt: order.startedAt?.toISOString() ?? null,
    finishedAt: order.finishedAt?.toISOString() ?? null,
    productionNotes: order.productionNotes,
    qualityNotes: order.qualityNotes,
    packagingNotes: order.packagingNotes,
    productionRequirements: order.productionRequirements,
    qualityCheckRequirements: order.qualityCheckRequirements,
    packagingRequirements: order.packagingRequirements,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    factoryProduct: order.factoryProduct,
    recipe: order.recipe,
    items,
    requiredTotal,
  }
}

function orderItemDraftToCreateData(
  orderId: string,
  item: ReturnType<typeof buildProductionOrderItems>[number],
  actualWeight: number | null,
) {
  return {
    orderId,
    rawMaterialId: item.rawMaterialId ?? null,
    componentRecipeId: item.componentRecipeId ?? null,
    productSemifinishedId: item.productSemifinishedId ?? null,
    sortOrder: item.sortOrder,
    productionCode: item.productionCode,
    materialName: item.materialName,
    percentage: item.percentage,
    requiredWeight: item.requiredWeight,
    actualWeight,
    notes: item.notes,
  }
}

/** Rebuilds order line items from the linked recipe when rows are missing (e.g. legacy orders). */
export async function syncProductionOrderItemsFromRecipe(
  orderId: string,
  recipeId: string,
  totalWeight: number,
  currentItems: Array<{
    rawMaterialId: string | null
    componentRecipeId: string | null
    productSemifinishedId: string | null
    actualWeight: unknown
    notes: string
  }>,
) {
  const recipe = await loadRecipeForProduction(recipeId)
  if (!recipe) return false

  const expectedDrafts = buildProductionOrderItems(
    recipeItemsForProduction(recipe.items),
    totalWeight,
  )
  if (expectedDrafts.length === 0) return false

  const currentKeys = new Set(
    currentItems.map(item => productionOrderItemKey({
      itemType: item.componentRecipeId
        ? 'component_recipe'
        : item.productSemifinishedId
          ? 'product_semifinished'
          : 'raw_material',
      rawMaterialId: item.rawMaterialId ?? undefined,
      componentRecipeId: item.componentRecipeId ?? undefined,
      productSemifinishedId: item.productSemifinishedId ?? undefined,
    })),
  )
  const expectedKeys = new Set(expectedDrafts.map(productionOrderItemKey))
  const needsSync = expectedKeys.size !== currentKeys.size
    || [...expectedKeys].some(key => !currentKeys.has(key))

  if (!needsSync) return false

  const actualByKey = new Map<string, number | null>()
  for (const item of currentItems) {
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

  await prisma.cosTableProductionOrderItem.deleteMany({ where: { orderId } })
  await prisma.cosTableProductionOrderItem.createMany({
    data: expectedDrafts.map(item => orderItemDraftToCreateData(
      orderId,
      item,
      actualByKey.get(productionOrderItemKey(item)) ?? null,
    )),
  })

  return true
}

export async function getProductionOrderById(id: string) {
  const order = await prisma.cosTableProductionOrder.findUnique({
    where: { id },
    include: orderInclude,
  })
  if (!order) return null

  await syncProductionOrderItemsFromRecipe(
    order.id,
    order.recipeId,
    Number(order.totalWeight),
    order.items,
  )

  const synced = await prisma.cosTableProductionOrder.findUnique({
    where: { id },
    include: orderInclude,
  })
  if (!synced) return null
  return serializeProductionOrder(synced as Parameters<typeof serializeProductionOrder>[0])
}

export function createOrderItemRows(
  itemDrafts: ReturnType<typeof buildProductionOrderItems>,
  inputByKey: Map<string, { actualWeight?: number | null; notes?: string }>,
) {
  return itemDrafts.map(item => {
    const input = inputByKey.get(productionOrderItemKey(item))
    return {
      rawMaterialId: item.rawMaterialId ?? null,
      componentRecipeId: item.componentRecipeId ?? null,
      productSemifinishedId: item.productSemifinishedId ?? null,
      sortOrder: item.sortOrder,
      productionCode: item.productionCode,
      materialName: item.materialName,
      percentage: item.percentage,
      requiredWeight: item.requiredWeight,
      actualWeight: input?.actualWeight ?? item.actualWeight,
      notes: input?.notes ?? item.notes,
    }
  })
}
