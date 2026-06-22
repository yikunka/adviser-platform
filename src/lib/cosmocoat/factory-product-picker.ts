import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type FactoryProductPickerOption = {
  id: string
  productCode: string
  name: string
  unit: string
  currentRecipe: {
    id: string
    code: string
    name: string
  } | null
}

const pickerInclude = {
  currentRecipe: {
    select: { id: true, code: true, name: true },
  },
} as const

export function matchesFuzzyQuery(text: string, query: string): boolean {
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  if (normalizedText.includes(normalizedQuery)) return true

  let fromIndex = 0
  for (const char of normalizedQuery) {
    const nextIndex = normalizedText.indexOf(char, fromIndex)
    if (nextIndex === -1) return false
    fromIndex = nextIndex + 1
  }
  return true
}

export function buildFactoryProductPickerWhere(params: {
  q?: string
  recipeId?: string
  requireCurrentRecipe?: boolean
}): Prisma.CosTableFactoryProductWhereInput {
  const q = params.q?.trim() ?? ''
  const recipeId = params.recipeId?.trim() ?? ''

  const filters: Prisma.CosTableFactoryProductWhereInput[] = []

  if (recipeId) {
    filters.push({ currentRecipeId: recipeId })
  }

  if (params.requireCurrentRecipe) {
    filters.push({ currentRecipeId: { not: null } })
  }

  if (q) {
    filters.push({
      OR: [
        { productCode: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { currentRecipe: { code: { contains: q, mode: 'insensitive' } } },
        { currentRecipe: { name: { contains: q, mode: 'insensitive' } } },
      ],
    })
  }

  if (filters.length === 0) return {}
  if (filters.length === 1) return filters[0]!
  return { AND: filters }
}

export async function listFactoryProductPickerOptions(params: {
  q?: string
  recipeId?: string
  id?: string
  requireCurrentRecipe?: boolean
  limit?: number
}): Promise<FactoryProductPickerOption[]> {
  const limit = Math.min(500, Math.max(1, params.limit ?? 50))
  const q = params.q?.trim() ?? ''
  const id = params.id?.trim() ?? ''

  if (id) {
    const product = await prisma.cosTableFactoryProduct.findUnique({
      where: { id },
      include: pickerInclude,
    })
    if (!product) return []
    return [{
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      unit: product.unit,
      currentRecipe: product.currentRecipe,
    }]
  }

  const products = await prisma.cosTableFactoryProduct.findMany({
    where: buildFactoryProductPickerWhere(params),
    include: pickerInclude,
    orderBy: [{ sortOrder: 'asc' }, { productCode: 'asc' }],
    take: limit,
  })

  const mapped = products.map(product => ({
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    unit: product.unit,
    currentRecipe: product.currentRecipe,
  }))

  if (!q) return mapped

  return mapped.filter(product => {
    const haystack = [
      product.productCode,
      product.name,
      product.currentRecipe?.code ?? '',
      product.currentRecipe?.name ?? '',
    ].join(' ')
    return matchesFuzzyQuery(haystack, q)
  })
}
