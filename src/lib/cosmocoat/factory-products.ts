import { prisma } from '@/lib/db/prisma'

const productInclude = {
  currentRecipe: {
    select: { id: true, code: true, name: true, unitCost: true },
  },
  recipeLinks: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      recipe: {
        select: {
          id: true,
          code: true,
          name: true,
          unitCost: true,
          updatedAt: true,
          category: { select: { code: true, name: true } },
        },
      },
    },
  },
} as const

export async function serializeFactoryProduct(product: {
  id: string
  productCode: string
  name: string
  unit: string
  unitPrice: unknown
  notes: string
  currentRecipeId: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  currentRecipe: { id: string; code: string; name: string; unitCost: unknown } | null
  recipeLinks: Array<{
    id: string
    recipeId: string
    recipe: {
      id: string
      code: string
      name: string
      unitCost: unknown
      updatedAt: Date
      category: { code: string; name: string }
    }
  }>
}) {
  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    unit: product.unit,
    unitPrice: product.unitPrice != null ? Number(product.unitPrice) : null,
    notes: product.notes,
    currentRecipeId: product.currentRecipeId,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    currentRecipe: product.currentRecipe
      ? {
          id: product.currentRecipe.id,
          code: product.currentRecipe.code,
          name: product.currentRecipe.name,
          unitCost: product.currentRecipe.unitCost != null ? Number(product.currentRecipe.unitCost) : null,
        }
      : null,
    recipes: product.recipeLinks.map(link => ({
      linkId: link.id,
      id: link.recipe.id,
      code: link.recipe.code,
      name: link.recipe.name,
      unitCost: link.recipe.unitCost != null ? Number(link.recipe.unitCost) : null,
      updatedAt: link.recipe.updatedAt.toISOString(),
      categoryCode: link.recipe.category.code,
      categoryName: link.recipe.category.name,
      isCurrent: product.currentRecipeId === link.recipe.id,
    })),
  }
}

export async function getFactoryProductById(id: string) {
  const product = await prisma.cosTableFactoryProduct.findUnique({
    where: { id },
    include: productInclude,
  })
  if (!product) return null
  return serializeFactoryProduct(product)
}

export async function syncProductRecipes(productId: string, recipeIds: string[], currentRecipeId?: string | null) {
  const uniqueIds = [...new Set(recipeIds)]
  if (currentRecipeId && !uniqueIds.includes(currentRecipeId)) {
    uniqueIds.push(currentRecipeId)
  }

  if (uniqueIds.length > 0) {
    const found = await prisma.cosTableRecipe.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    })
    if (found.length !== uniqueIds.length) {
      throw new Error('RECIPE_NOT_FOUND')
    }
  }

  await prisma.cosTableProductRecipe.deleteMany({
    where: {
      productId,
      ...(uniqueIds.length > 0 ? { recipeId: { notIn: uniqueIds } } : {}),
    },
  })

  if (uniqueIds.length > 0) {
    const existing = await prisma.cosTableProductRecipe.findMany({
      where: { productId },
      select: { recipeId: true },
    })
    const existingSet = new Set(existing.map(row => row.recipeId))
    const toCreate = uniqueIds.filter(id => !existingSet.has(id))
    if (toCreate.length > 0) {
      await prisma.cosTableProductRecipe.createMany({
        data: toCreate.map(recipeId => ({ productId, recipeId })),
      })
    }
  } else {
    await prisma.cosTableProductRecipe.deleteMany({ where: { productId } })
  }

  const resolvedCurrent = currentRecipeId && uniqueIds.includes(currentRecipeId) ? currentRecipeId : null
  await prisma.cosTableFactoryProduct.update({
    where: { id: productId },
    data: { currentRecipeId: resolvedCurrent },
  })
}

export { productInclude }
