import { describe, expect, it } from 'vitest'
import {
  buildAccountByIdMap,
  buildAccountLevelChain,
  formatAccountLevelCell,
  formatJournalLineAccountLevels,
  type AccountHierarchyNode,
} from './account-hierarchy'

function account(input: Partial<AccountHierarchyNode> & Pick<AccountHierarchyNode, 'id' | 'code' | 'name' | 'parentId' | 'level'>): AccountHierarchyNode {
  return input
}

describe('buildAccountLevelChain', () => {
  it('returns a single level for level-1 leaf accounts', () => {
    const accounts = [
      account({ id: 'capital', code: '3000', name: 'Capital', parentId: null, level: 1 }),
    ]
    const byId = buildAccountByIdMap(accounts)

    expect(buildAccountLevelChain(accounts[0], byId)).toEqual([
      { level: 1, code: '3000', name: 'Capital' },
    ])
  })

  it('returns full chain for level-3 accounts', () => {
    const accounts = [
      account({ id: 'asset', code: '1000', name: '流动资产', parentId: null, level: 1 }),
      account({ id: 'bank', code: '1020', name: '银行存款', parentId: 'asset', level: 2 }),
      account({ id: 'hsbc', code: '102001', name: '汇丰银行', parentId: 'bank', level: 3 }),
    ]
    const byId = buildAccountByIdMap(accounts)

    expect(buildAccountLevelChain(accounts[2], byId)).toEqual([
      { level: 1, code: '1000', name: '流动资产' },
      { level: 2, code: '1020', name: '银行存款' },
      { level: 3, code: '102001', name: '汇丰银行' },
    ])
  })
})

describe('formatAccountLevelCell', () => {
  it('formats the requested level and uses dash when missing', () => {
    const chain = buildAccountLevelChain(
      account({ id: 'hsbc', code: '102001', name: '汇丰银行', parentId: 'bank', level: 3 }),
      buildAccountByIdMap([
        account({ id: 'asset', code: '1000', name: '流动资产', parentId: null, level: 1 }),
        account({ id: 'bank', code: '1020', name: '银行存款', parentId: 'asset', level: 2 }),
        account({ id: 'hsbc', code: '102001', name: '汇丰银行', parentId: 'bank', level: 3 }),
      ]),
    )

    expect(formatAccountLevelCell(chain, 1)).toBe('1000 流动资产')
    expect(formatAccountLevelCell(chain, 2)).toBe('1020 银行存款')
    expect(formatAccountLevelCell(chain, 3)).toBe('102001 汇丰银行')
    expect(formatAccountLevelCell(chain, 4)).toBe('-')
  })
})

describe('formatJournalLineAccountLevels', () => {
  it('falls back to the leaf account column when levelChain is missing', () => {
    expect(formatJournalLineAccountLevels({ code: '102001', name: '汇丰银行', level: 3 })).toEqual({
      level1: '-',
      level2: '-',
      level3: '102001 汇丰银行',
    })
  })
})
