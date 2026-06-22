import type { Prisma } from '@prisma/client'

function startOfUtcDate(value: string) {
  const text = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfUtcDate(value: string) {
  const text = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T23:59:59.999Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildProductionOrderWhere(params: {
  q?: string
  factoryProductId?: string
  createdFrom?: string
  createdTo?: string
}): Prisma.CosTableProductionOrderWhereInput {
  const filters: Prisma.CosTableProductionOrderWhereInput[] = []
  const q = params.q?.trim() ?? ''
  const factoryProductId = params.factoryProductId?.trim() ?? ''
  const createdFrom = params.createdFrom ? startOfUtcDate(params.createdFrom) : null
  const createdTo = params.createdTo ? endOfUtcDate(params.createdTo) : null

  if (q) {
    filters.push({
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { batchNo: { contains: q, mode: 'insensitive' } },
        { factoryProduct: { name: { contains: q, mode: 'insensitive' } } },
        { factoryProduct: { productCode: { contains: q, mode: 'insensitive' } } },
        { recipe: { code: { contains: q, mode: 'insensitive' } } },
      ],
    })
  }

  if (factoryProductId) {
    filters.push({ factoryProductId })
  }

  if (createdFrom || createdTo) {
    filters.push({
      createdAt: {
        ...(createdFrom ? { gte: createdFrom } : {}),
        ...(createdTo ? { lte: createdTo } : {}),
      },
    })
  }

  if (filters.length === 0) return {}
  if (filters.length === 1) return filters[0]!
  return { AND: filters }
}
