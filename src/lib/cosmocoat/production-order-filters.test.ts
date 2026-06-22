import { describe, expect, it } from 'vitest'
import { buildProductionOrderWhere } from './production-order-filters'

describe('buildProductionOrderWhere', () => {
  it('combines search, product, and created date range filters', () => {
    expect(buildProductionOrderWhere({
      q: 'PO-001',
      factoryProductId: 'product-1',
      createdFrom: '2026-06-01',
      createdTo: '2026-06-30',
    })).toEqual({
      AND: [
        {
          OR: [
            { code: { contains: 'PO-001', mode: 'insensitive' } },
            { batchNo: { contains: 'PO-001', mode: 'insensitive' } },
            { factoryProduct: { name: { contains: 'PO-001', mode: 'insensitive' } } },
            { factoryProduct: { productCode: { contains: 'PO-001', mode: 'insensitive' } } },
            { recipe: { code: { contains: 'PO-001', mode: 'insensitive' } } },
          ],
        },
        { factoryProductId: 'product-1' },
        {
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.999Z'),
          },
        },
      ],
    })
  })
})
