import type { Prisma } from '@prisma/client'
import type { RecipeItemInput } from '@/lib/cosmocoat/recipes'

export function recipeItemToPrismaCreate(
  recipeId: string,
  item: RecipeItemInput & { amount: number; percentage: number },
): Prisma.CosTableRecipeItemCreateManyInput {
  if (item.recipeId) {
    return {
      recipeId,
      componentRecipeId: item.recipeId,
      sortOrder: item.sortOrder,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      percentage: item.percentage,
      notes: item.notes,
    }
  }
  if (item.productSemifinishedId) {
    return {
      recipeId,
      productSemifinishedId: item.productSemifinishedId,
      sortOrder: item.sortOrder,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      percentage: item.percentage,
      notes: item.notes,
    }
  }
  if (item.factoryProductId) {
    return {
      recipeId,
      factoryProductId: item.factoryProductId,
      sortOrder: item.sortOrder,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      percentage: item.percentage,
      notes: item.notes,
    }
  }
  return {
    recipeId,
    rawMaterialId: item.rawMaterialId!,
    sortOrder: item.sortOrder,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount,
    percentage: item.percentage,
    notes: item.notes,
  }
}
