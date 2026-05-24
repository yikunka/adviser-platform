import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type { ProductionOrderItemDraft } from '@/lib/cosmocoat/recipes'
export {
  buildProductionOrderItems,
  computeRequiredWeight,
  formatWeight,
} from '@/lib/cosmocoat/recipes'

export const orderInclude = {
  factoryProduct: {
    select: { id: true, productCode: true, name: true, unit: true },
  },
  recipe: {
    select: { id: true, code: true, name: true },
  },
  items: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      rawMaterial: {
        select: { id: true, productionCode: true, name: true, attributeCode: true },
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
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { rawMaterial: true },
      },
    },
  })
}

export async function resolveProductCurrentRecipe(factoryProductId: string) {
  const product = await prisma.cosTableFactoryProduct.findUnique({
    where: { id: factoryProductId },
    include: {
      currentRecipe: {
        include: {
          items: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: { rawMaterial: true },
          },
        },
      },
    },
  })
  if (!product) return { error: 'PRODUCT_NOT_FOUND' as const }
  if (!product.currentRecipe) return { error: 'NO_CURRENT_RECIPE' as const, product }
  return { product, recipe: product.currentRecipe }
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
  rawMaterial: { id: string; productionCode: string; name: string; attributeCode: string }
}) {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    productionCode: item.productionCode,
    materialName: item.materialName,
    percentage: Number(item.percentage),
    requiredWeight: Number(item.requiredWeight),
    actualWeight: item.actualWeight != null ? Number(item.actualWeight) : null,
    notes: item.notes,
    rawMaterial: item.rawMaterial,
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
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    factoryProduct: order.factoryProduct,
    recipe: order.recipe,
    items,
    requiredTotal,
  }
}

export async function getProductionOrderById(id: string) {
  const order = await prisma.cosTableProductionOrder.findUnique({
    where: { id },
    include: orderInclude,
  })
  if (!order) return null
  return serializeProductionOrder(order as Parameters<typeof serializeProductionOrder>[0])
}

