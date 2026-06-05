import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {},
}))

import { serializeRecipeFactoryProductPickerOption } from '@/lib/cosmocoat/recipe-factory-product-picker'

describe('serializeRecipeFactoryProductPickerOption', () => {
  it('coerces decimal unitPrice to number', () => {
    const option = serializeRecipeFactoryProductPickerOption({
      id: 'p1',
      productCode: 'PU-001',
      name: 'Test Product',
      unit: 'kg',
      unitPrice: { toNumber: () => 12.5 },
      notes: 'note',
      category: { id: 'c1', name: 'PU漆' },
    })

    expect(option.unitPrice).toBe(12.5)
    expect(option.productCode).toBe('PU-001')
  })

  it('returns null unitPrice when missing', () => {
    const option = serializeRecipeFactoryProductPickerOption({
      id: 'p2',
      productCode: 'PU-002',
      name: 'No Price',
      unit: 'kg',
      unitPrice: null,
      notes: '',
      category: null,
    })

    expect(option.unitPrice).toBeNull()
  })
})
