import { prisma } from '@/lib/db/prisma'
import type { RecipeItemInput } from '@/lib/cosmocoat/recipes'

const SEMI_FINISHED_CATEGORY_MATCH = '半成品'

export function isSemiFinishedCategoryName(name: string): boolean {
  return name.includes(SEMI_FINISHED_CATEGORY_MATCH)
}

export class RecipeItemValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeItemValidationError'
  }
}

function countItemRefs(item: RecipeItemInput): number {
  return [
    Boolean(item.rawMaterialId),
    Boolean(item.recipeId),
    Boolean(item.productSemifinishedId),
    Boolean(item.factoryProductId),
  ].filter(Boolean).length
}

/** Validates recipe line items and fills unitPrice from source records when omitted. */
export async function validateAndEnrichRecipeItems(
  items: RecipeItemInput[],
  parentRecipeId?: string,
): Promise<RecipeItemInput[]> {
  const rawMaterialIds = items
    .map(item => item.rawMaterialId)
    .filter((id): id is string => Boolean(id))
  const componentRecipeIds = items
    .map(item => item.recipeId)
    .filter((id): id is string => Boolean(id))
  const productSemifinishedIds = items
    .map(item => item.productSemifinishedId)
    .filter((id): id is string => Boolean(id))
  const factoryProductIds = items
    .map(item => item.factoryProductId)
    .filter((id): id is string => Boolean(id))

  if (parentRecipeId && componentRecipeIds.includes(parentRecipeId)) {
    throw new RecipeItemValidationError('配方不能引用自身作为半成品')
  }

  const [rawMaterials, componentRecipes, productSemifinished, factoryProducts] = await Promise.all([
    rawMaterialIds.length > 0
      ? prisma.cosTableRawMaterial.findMany({
          where: { id: { in: rawMaterialIds } },
          select: { id: true, primaryPricePerKg: true },
        })
      : Promise.resolve([]),
    componentRecipeIds.length > 0
      ? prisma.cosTableRecipe.findMany({
          where: { id: { in: componentRecipeIds } },
          select: {
            id: true,
            code: true,
            unitCost: true,
            category: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    productSemifinishedIds.length > 0
      ? prisma.cosTableProductSemifinished.findMany({
          where: { id: { in: productSemifinishedIds } },
          select: { id: true, code: true, unitPrice: true },
        })
      : Promise.resolve([]),
    factoryProductIds.length > 0
      ? prisma.cosTableFactoryProduct.findMany({
          where: { id: { in: factoryProductIds } },
          select: { id: true, productCode: true, unitPrice: true },
        })
      : Promise.resolve([]),
  ])

  const rawMap = new Map(rawMaterials.map(m => [m.id, m]))
  const recipeMap = new Map(componentRecipes.map(r => [r.id, r]))
  const semifinishedMap = new Map(productSemifinished.map(s => [s.id, s]))
  const factoryProductMap = new Map(factoryProducts.map(p => [p.id, p]))

  return items.map(item => {
    if (countItemRefs(item) !== 1) {
      throw new RecipeItemValidationError('每条配料须指定原材料、半成品配方、库存半成品或成品之一')
    }

    if (item.rawMaterialId) {
      const material = rawMap.get(item.rawMaterialId)
      if (!material) {
        throw new RecipeItemValidationError(`原材料不存在: ${item.rawMaterialId}`)
      }
      const unitPrice = item.unitPrice ?? (
        material.primaryPricePerKg != null ? Number(material.primaryPricePerKg) : null
      )
      return { ...item, unitPrice }
    }

    if (item.recipeId) {
      const component = recipeMap.get(item.recipeId)
      if (!component) {
        throw new RecipeItemValidationError(`半成品配方不存在: ${item.recipeId}`)
      }
      if (!isSemiFinishedCategoryName(component.category.name)) {
        throw new RecipeItemValidationError(
          `「${component.code}」不属于半成品目录，不能作为配料引用`,
        )
      }
      const unitPrice = item.unitPrice ?? (
        component.unitCost != null ? Number(component.unitCost) : null
      )
      return { ...item, unitPrice }
    }

    if (item.productSemifinishedId) {
      const semifinished = semifinishedMap.get(item.productSemifinishedId)
      if (!semifinished) {
        throw new RecipeItemValidationError(`库存半成品不存在: ${item.productSemifinishedId}`)
      }
      const unitPrice = item.unitPrice ?? (
        semifinished.unitPrice != null ? Number(semifinished.unitPrice) : null
      )
      return { ...item, unitPrice }
    }

    if (item.factoryProductId) {
      const product = factoryProductMap.get(item.factoryProductId)
      if (!product) {
        throw new RecipeItemValidationError(`成品不存在: ${item.factoryProductId}`)
      }
      const unitPrice = item.unitPrice ?? (
        product.unitPrice != null ? Number(product.unitPrice) : null
      )
      return { ...item, unitPrice }
    }

    throw new RecipeItemValidationError('每条配料须指定原材料、半成品配方、库存半成品或成品之一')
  })
}
