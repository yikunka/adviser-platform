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
  }
}) {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    quantity: Number(item.quantity),
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
    amount: item.amount != null ? Number(item.amount) : null,
    percentage: item.percentage != null ? Number(item.percentage) : null,
    notes: item.notes,
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
  }
}

export async function serializeFullRecipe(recipeId: string) {
  const recipe = await prisma.cosTableRecipe.findUnique({
    where: { id: recipeId },
    include: {
      category: true,
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { rawMaterial: true },
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
