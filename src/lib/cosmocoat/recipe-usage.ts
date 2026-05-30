import { prisma } from '@/lib/db/prisma'

/**
 * Recipe IDs reachable from factory products: direct links (product_recipes,
 * currentRecipe) plus nested componentRecipeId dependencies (BFS).
 */
export async function computeFactoryLinkedRecipeIds(): Promise<Set<string>> {
  const [productRecipeLinks, factoryProducts, componentRows] = await Promise.all([
    prisma.cosTableProductRecipe.findMany({ select: { recipeId: true } }),
    prisma.cosTableFactoryProduct.findMany({
      where: { currentRecipeId: { not: null } },
      select: { currentRecipeId: true },
    }),
    prisma.cosTableRecipeItem.findMany({
      where: { componentRecipeId: { not: null } },
      select: { recipeId: true, componentRecipeId: true },
    }),
  ])

  const componentsByParent = new Map<string, string[]>()
  for (const row of componentRows) {
    if (!row.componentRecipeId) continue
    const list = componentsByParent.get(row.recipeId) ?? []
    list.push(row.componentRecipeId)
    componentsByParent.set(row.recipeId, list)
  }

  const queue: string[] = []
  for (const link of productRecipeLinks) queue.push(link.recipeId)
  for (const product of factoryProducts) {
    if (product.currentRecipeId) queue.push(product.currentRecipeId)
  }

  const linked = new Set<string>()
  while (queue.length > 0) {
    const recipeId = queue.pop()!
    if (linked.has(recipeId)) continue
    linked.add(recipeId)
    for (const componentId of componentsByParent.get(recipeId) ?? []) {
      if (!linked.has(componentId)) queue.push(componentId)
    }
  }

  return linked
}

/** Recompute and persist formula_is_used for all recipes. */
export async function refreshAllFormulaIsUsedCache(): Promise<void> {
  const linkedIds = await computeFactoryLinkedRecipeIds()

  const recipes = await prisma.cosTableRecipe.findMany({ select: { id: true } })
  const toMarkUsed = recipes.filter(r => linkedIds.has(r.id)).map(r => r.id)
  const toMarkUnused = recipes.filter(r => !linkedIds.has(r.id)).map(r => r.id)

  await prisma.$transaction([
    ...(toMarkUsed.length > 0
      ? [
          prisma.cosTableRecipe.updateMany({
            where: { id: { in: toMarkUsed } },
            data: { formulaIsUsed: true },
          }),
        ]
      : []),
    ...(toMarkUnused.length > 0
      ? [
          prisma.cosTableRecipe.updateMany({
            where: { id: { in: toMarkUnused } },
            data: { formulaIsUsed: false },
          }),
        ]
      : []),
  ])
}
