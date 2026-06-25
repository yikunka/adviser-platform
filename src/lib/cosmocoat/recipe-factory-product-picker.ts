import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type RecipeFactoryProductPickerOption = {
  id: string
  productCode: string
  name: string
  unit: string
  unitPrice: number | null
  notes: string
  category: { id: string; name: string } | null
}

export function serializeRecipeFactoryProductPickerOption(product: {
  id: string
  productCode: string
  name: string
  unit: string
  unitPrice: unknown
  currentRecipe: { unitCost: unknown } | null
  notes: string
  category: { id: string; name: string } | null
}): RecipeFactoryProductPickerOption {
  let unitPrice: number | null = null
  const sourceUnitCost = product.currentRecipe?.unitCost ?? null
  if (sourceUnitCost != null) {
    if (typeof sourceUnitCost === 'number') {
      unitPrice = sourceUnitCost
    } else if (
      typeof sourceUnitCost === 'object' &&
      'toNumber' in sourceUnitCost &&
      typeof sourceUnitCost.toNumber === 'function'
    ) {
      unitPrice = sourceUnitCost.toNumber()
    } else {
      unitPrice = Number(sourceUnitCost)
    }
  }

  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    unit: product.unit,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    notes: product.notes,
    category: product.category,
  }
}

export async function listRecipeFactoryProductPickerOptions(params: {
  q?: string
  categoryId?: string
  limit?: number
}): Promise<RecipeFactoryProductPickerOption[]> {
  const q = params.q?.trim() ?? ''
  const categoryId = params.categoryId?.trim() ?? ''
  const limit = Math.min(500, Math.max(1, params.limit ?? 200))

  const where: Prisma.CosTableFactoryProductWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { productCode: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const products = await prisma.cosTableFactoryProduct.findMany({
    where,
    select: {
      id: true,
      productCode: true,
      name: true,
      unit: true,
      unitPrice: true,
      currentRecipe: { select: { unitCost: true } },
      notes: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { productCode: 'asc' }],
    take: limit,
  })

  return products.map(serializeRecipeFactoryProductPickerOption)
}

export async function listRecipeFactoryProductPickerCategories(): Promise<
  Array<{ id: string; name: string }>
> {
  const rows = await prisma.cosTableFactoryProduct.findMany({
    where: { categoryId: { not: null } },
    select: {
      sortOrder: true,
      productCode: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { productCode: 'asc' }],
  })

  const seen = new Set<string>()
  const categories: Array<{ id: string; name: string }> = []
  for (const row of rows) {
    if (!row.category || seen.has(row.category.id)) continue
    seen.add(row.category.id)
    categories.push(row.category)
  }
  return categories
}
