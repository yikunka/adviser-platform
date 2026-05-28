import { prisma } from '@/lib/db/prisma'
import { computeRecipeTotals } from '@/lib/cosmocoat/recipes'

function serializeRecipeItem(item: {
  id: string
  sortOrder: number
  quantity: unknown
  unitPrice: unknown
  amount: unknown
  percentage?: unknown
  notes: string
  rawMaterial: {
    id: string
    productionCode: string
    name: string
    attributeCode: string
    category: string
    primaryPackageKg: unknown
    primaryPricePerKg: unknown
    primaryNotes: string
  } | null
  componentRecipe: {
    id: string
    code: string
    name: string
    batchQuantity: unknown
    unitCost: unknown
    notes: string
    category: { id: string; code: string; name: string }
  } | null
  productSemifinished: {
    id: string
    code: string
    name: string
    description: string
    category: string
    stock: unknown
    unit: string
    unitPrice: unknown
    sourceProductionOrder: {
      id: string
      code: string
      batchNo: string
    } | null
  } | null
}) {
  const base = {
    id: item.id,
    sortOrder: item.sortOrder,
    quantity: Number(item.quantity),
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
    amount: item.amount != null ? Number(item.amount) : null,
    percentage: item.percentage != null ? Number(item.percentage) : null,
    notes: item.notes,
  }

  if (item.componentRecipe) {
    return {
      ...base,
      itemType: 'recipe' as const,
      recipe: {
        id: item.componentRecipe.id,
        code: item.componentRecipe.code,
        name: item.componentRecipe.name,
        batchQuantity: Number(item.componentRecipe.batchQuantity),
        unitCost: item.componentRecipe.unitCost != null ? Number(item.componentRecipe.unitCost) : null,
        notes: item.componentRecipe.notes,
        category: item.componentRecipe.category,
      },
      productSemifinished: null,
      rawMaterial: null,
    }
  }

  if (item.productSemifinished) {
    return {
      ...base,
      itemType: 'product_semifinished' as const,
      productSemifinished: {
        id: item.productSemifinished.id,
        code: item.productSemifinished.code,
        name: item.productSemifinished.name,
        description: item.productSemifinished.description,
        category: item.productSemifinished.category,
        stock: Number(item.productSemifinished.stock),
        unit: item.productSemifinished.unit,
        unitPrice: item.productSemifinished.unitPrice != null
          ? Number(item.productSemifinished.unitPrice)
          : null,
        sourceProductionOrder: item.productSemifinished.sourceProductionOrder
          ? {
              id: item.productSemifinished.sourceProductionOrder.id,
              code: item.productSemifinished.sourceProductionOrder.code,
              batchNo: item.productSemifinished.sourceProductionOrder.batchNo,
            }
          : null,
      },
      recipe: null,
      rawMaterial: null,
    }
  }

  if (!item.rawMaterial) {
    throw new Error(`Recipe item ${item.id} has no material, component recipe, or product semifinished`)
  }

  return {
    ...base,
    itemType: 'raw_material' as const,
    rawMaterial: {
      id: item.rawMaterial.id,
      productionCode: item.rawMaterial.productionCode,
      name: item.rawMaterial.name,
      attributeCode: item.rawMaterial.attributeCode,
      category: item.rawMaterial.category,
      packageKg: item.rawMaterial.primaryPackageKg != null ? Number(item.rawMaterial.primaryPackageKg) : null,
      pricePerKg: item.rawMaterial.primaryPricePerKg != null ? Number(item.rawMaterial.primaryPricePerKg) : null,
      notes: item.rawMaterial.primaryNotes,
    },
    recipe: null,
    productSemifinished: null,
  }
}

export async function serializeFullRecipe(recipeId: string) {
  const recipe = await prisma.cosTableRecipe.findUnique({
    where: { id: recipeId },
    include: {
      category: true,
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          rawMaterial: true,
          componentRecipe: { include: { category: true } },
          productSemifinished: {
            include: {
              sourceProductionOrder: { select: { id: true, code: true, batchNo: true } },
            },
          },
        },
      },
    },
  })
  if (!recipe) return null

  const items = recipe.items.map(serializeRecipeItem)
  const batchQuantity = Number(recipe.batchQuantity)
  const totals = computeRecipeTotals(
    items.map(item => ({ quantity: item.quantity, amount: item.amount ?? 0 })),
    batchQuantity,
  )

  return {
    id: recipe.id,
    categoryId: recipe.categoryId,
    code: recipe.code,
    name: recipe.name,
    batchQuantity,
    unitCost: recipe.unitCost != null ? Number(recipe.unitCost) : totals.unitCost,
    notes: recipe.notes,
    stirringRequirements: recipe.stirringRequirements,
    packagingRequirements: recipe.packagingRequirements,
    productionNotes: recipe.productionNotes,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
    category: {
      id: recipe.category.id,
      code: recipe.category.code,
      name: recipe.category.name,
    },
    items,
    totals,
  }
}

export type FullRecipe = NonNullable<Awaited<ReturnType<typeof serializeFullRecipe>>>
