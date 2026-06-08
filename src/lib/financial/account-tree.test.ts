import { describe, expect, it } from 'vitest'
import { flattenAccountHierarchy, formatAccountOptionLabel } from '@/lib/financial/account-tree'

describe('formatAccountOptionLabel', () => {
  it('formats code and name without indentation characters', () => {
    expect(formatAccountOptionLabel('1001', '现金')).toBe('1001 - 现金')
  })
})

describe('flattenAccountHierarchy', () => {
  it('returns readable labels and preserves hierarchy levels', () => {
    const rows = flattenAccountHierarchy([
      { id: 'a1', code: '1000', name: '资产', parentId: null, level: 1, sortOrder: 0 },
      { id: 'a2', code: '1001', name: '现金', parentId: 'a1', level: 2, sortOrder: 0 },
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe('1000 - 资产')
    expect(rows[1].label).toBe('1001 - 现金')
    expect(rows[1].level).toBe(2)
    expect(rows[0]).not.toHaveProperty('children')
  })
})
