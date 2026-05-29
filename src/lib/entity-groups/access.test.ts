import { describe, expect, it } from 'vitest'
import {
  buildCompanyGroupWhere,
  buildGroupWhere,
  groupIdsFromAccess,
} from '@/lib/entity-groups/access'

describe('entity group access helpers', () => {
  it('buildGroupWhere returns undefined for full access', () => {
    expect(buildGroupWhere({ kind: 'all' })).toBeUndefined()
  })

  it('buildGroupWhere restricts to assigned group ids', () => {
    expect(buildGroupWhere({ kind: 'restricted', groupIds: ['g1', 'g2'] })).toEqual({
      id: { in: ['g1', 'g2'] },
    })
  })

  it('buildCompanyGroupWhere maps to company groupId filter', () => {
    expect(buildCompanyGroupWhere({ kind: 'restricted', groupIds: ['g1'] })).toEqual({
      groupId: { in: ['g1'] },
    })
  })

  it('groupIdsFromAccess returns null for full access', () => {
    expect(groupIdsFromAccess({ kind: 'all' })).toBeNull()
  })

  it('groupIdsFromAccess returns ids for restricted access', () => {
    expect(groupIdsFromAccess({ kind: 'restricted', groupIds: ['a'] })).toEqual(['a'])
  })
})
