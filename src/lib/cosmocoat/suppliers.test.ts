import { describe, expect, it, vi } from 'vitest'
import { supplierListOrderBy } from './supplier-list-order'
import { serializeSupplier } from './suppliers'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {},
}))

describe('supplierListOrderBy', () => {
  it('sorts supplier list by supplier code ascending', () => {
    expect(supplierListOrderBy()).toEqual([{ code: 'asc' }, { id: 'asc' }])
  })
})

describe('serializeSupplier', () => {
  it('includes the dedicated contact person field', () => {
    const now = new Date('2026-06-22T00:00:00.000Z')

    expect(serializeSupplier({
      id: 'supplier-1',
      code: 'SC0001',
      name: 'Demo Supplier',
      contactPerson: 'Alex Chan',
      contactInfo: 'alex@example.com',
      address: 'Hong Kong',
      createdById: 'user-1',
      createdAt: now,
      updatedAt: now,
    })).toMatchObject({
      contactPerson: 'Alex Chan',
    })
  })
})
