import { describe, expect, it } from 'vitest'
import { attachBalanceSheetChildren } from './balance-sheet-line-hierarchy'

describe('attachBalanceSheetChildren', () => {
  it('nests descendant rows under their level-1 parent', () => {
    const level1Map = new Map([
      ['child-2', 'parent-1'],
      ['child-3', 'parent-1'],
      ['parent-1', 'parent-1'],
    ])

    const lines = [
      { accountId: 'parent-1', code: '1000', name: 'Assets', type: 'ASSET' as const, level: 1, amount: 300 },
      { accountId: 'child-2', code: '1001', name: 'Cash', type: 'ASSET' as const, level: 2, amount: 100 },
      { accountId: 'child-3', code: '1002', name: 'Bank', type: 'ASSET' as const, level: 3, amount: 200 },
      { accountId: 'leaf-1', code: '2000', name: 'Payables', type: 'LIABILITY' as const, level: 1, amount: 50 },
    ]

    const result = attachBalanceSheetChildren(
      lines.filter(line => line.level === 1),
      lines,
      level1Map,
    )

    expect(result).toHaveLength(2)
    expect(result[0]?.children?.map(child => child.code)).toEqual(['1001', '1002'])
    expect(result[1]?.children).toBeUndefined()
  })
})
