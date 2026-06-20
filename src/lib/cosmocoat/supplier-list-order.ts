import type { Prisma } from '@prisma/client'

export function supplierListOrderBy(): Prisma.CosSupplierOrderByWithRelationInput[] {
  return [{ code: 'asc' }, { id: 'asc' }]
}
