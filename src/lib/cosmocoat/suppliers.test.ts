import { describe, expect, it } from 'vitest'
import { supplierListOrderBy } from './supplier-list-order'

describe('supplierListOrderBy', () => {
  it('sorts supplier list by supplier code ascending', () => {
    expect(supplierListOrderBy()).toEqual([{ code: 'asc' }, { id: 'asc' }])
  })
})
