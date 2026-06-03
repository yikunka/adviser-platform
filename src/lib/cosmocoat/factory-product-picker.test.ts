import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {},
}))

import { matchesFuzzyQuery } from '@/lib/cosmocoat/factory-product-picker'

describe('matchesFuzzyQuery', () => {
  it('matches substring search', () => {
    expect(matchesFuzzyQuery('PU-001 高光面漆', '001')).toBe(true)
  })

  it('matches out-of-order characters', () => {
    expect(matchesFuzzyQuery('PU-001 高光面漆', 'pu面')).toBe(true)
  })

  it('returns true for empty query', () => {
    expect(matchesFuzzyQuery('PU-001', '')).toBe(true)
  })

  it('returns false when characters are missing', () => {
    expect(matchesFuzzyQuery('PU-001', 'xyz')).toBe(false)
  })
})
