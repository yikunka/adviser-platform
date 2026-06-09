import { describe, expect, it } from 'vitest'
import type { TrialBalanceRow } from '@/lib/financial/reports'
import { filterTrialBalanceRowsByLevel } from './trial-balance-level-filter'

function row(overrides: Partial<TrialBalanceRow> & Pick<TrialBalanceRow, 'accountId' | 'level'>): TrialBalanceRow {
  return {
    code: overrides.code ?? '1000',
    name: overrides.name ?? 'Test',
    type: overrides.type ?? 'ASSET',
    sortOrder: overrides.sortOrder ?? 0,
    periodDebit: 0,
    periodCredit: 0,
    closingDebit: 0,
    closingCredit: 0,
    ...overrides,
  }
}

describe('filterTrialBalanceRowsByLevel', () => {
  const rows: TrialBalanceRow[] = [
    row({ accountId: 's1', level: 1, isSummary: true, code: '1000', name: 'Assets summary' }),
    row({ accountId: 'd2', level: 2, code: '1001', name: 'Cash' }),
    row({ accountId: 'd3', level: 3, code: '100101', name: 'Petty cash' }),
    row({ accountId: 'd1', level: 1, code: '2000', name: 'Leaf level 1' }),
    row({ accountId: 'computed', level: 1, isComputed: true, code: '——', name: 'Profit' }),
  ]

  it('returns all rows when filter is all', () => {
    expect(filterTrialBalanceRowsByLevel(rows, 'all')).toHaveLength(5)
  })

  it('shows level-1 summaries, leaf level-1 rows, and computed rows for level 1 filter', () => {
    const filtered = filterTrialBalanceRowsByLevel(rows, '1')
    expect(filtered.map(r => r.accountId)).toEqual(['s1', 'd1', 'computed'])
  })

  it('shows rows up to level 2 for two-level filter', () => {
    const filtered = filterTrialBalanceRowsByLevel(rows, '2')
    expect(filtered.map(r => r.accountId)).toEqual(['s1', 'd2', 'd1', 'computed'])
  })
})
