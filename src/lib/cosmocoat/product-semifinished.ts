import type { Prisma } from '@prisma/client'

export const DEFAULT_SEMIFINISHED_CATEGORY = 'Sol.'

export function serializeProductSemifinished(row: {
  id: string
  code: string
  name: string
  description: string
  category: string
  stock: unknown
  unit: string
  unitPrice: unknown
  sourceProductionOrderId: string | null
  createdAt: Date
  updatedAt: Date
  sourceProductionOrder?: {
    id: string
    code: string
    batchNo: string
  } | null
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    stock: Number(row.stock),
    unit: row.unit,
    unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
    sourceProductionOrderId: row.sourceProductionOrderId,
    sourceProductionOrder: row.sourceProductionOrder
      ? {
          id: row.sourceProductionOrder.id,
          code: row.sourceProductionOrder.code,
          batchNo: row.sourceProductionOrder.batchNo,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type SerializedProductSemifinished = ReturnType<typeof serializeProductSemifinished>

export const productSemifinishedListInclude = {
  sourceProductionOrder: {
    select: { id: true, code: true, batchNo: true },
  },
} satisfies Prisma.CosTableProductSemifinishedInclude
