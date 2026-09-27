import { describe, expect, it } from 'vitest'
import {
  PL_REPORT_SECTIONS,
  BS_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
} from './report-structure-shared'
import {
  resolvePlClassificationForAccount,
  suggestReportSectionMappings,
} from './report-structure'

describe('financial report structure', () => {
  it('exposes labelled P&L and balance-sheet sections', () => {
    expect(PL_REPORT_SECTIONS).toContain('PL_REVENUE')
    expect(BS_REPORT_SECTIONS).toContain('BS_CURRENT_ASSETS')
    for (const section of [...PL_REPORT_SECTIONS, ...BS_REPORT_SECTIONS]) {
      expect(REPORT_SECTION_LABELS[section].length).toBeGreaterThan(0)
    }
  })

  it('suggests mappings from standard chart heuristics', () => {
    const suggestions = suggestReportSectionMappings([
      { id: 'a1', companyId: 'c1', parentId: null, code: '05', name: '收入', type: 'REVENUE', level: 1 },
      { id: 'a2', companyId: 'c1', parentId: null, code: '06', name: '成本', type: 'CGS', level: 1 },
      { id: 'a3', companyId: 'c1', parentId: null, code: '01', name: '现金与银行', type: 'ASSET', level: 1 },
      { id: 'a4', companyId: 'c1', parentId: null, code: '04', name: '权益', type: 'EQUITY', level: 1 },
    ])
    expect(suggestions.some(row => row.section === 'PL_REVENUE' && row.accountId === 'a1')).toBe(true)
    expect(suggestions.some(row => row.section === 'PL_COST_OF_SALES' && row.accountId === 'a2')).toBe(true)
    expect(suggestions.some(row => row.section === 'BS_CURRENT_ASSETS' && row.accountId === 'a3')).toBe(true)
    expect(suggestions.some(row => row.section === 'BS_EQUITY' && row.accountId === 'a4')).toBe(true)
  })

  it('does not apply P&L structure mappings to balance-sheet account types', () => {
    const index = {
      plConfigured: true,
      bsConfigured: false,
      plByAccountId: new Map([
        ['a1801', { statementType: 'EXPENSE' as const, expenseCategory: 'administrative' as const }],
        ['a5602', { statementType: 'EXPENSE' as const, expenseCategory: 'administrative' as const }],
      ]),
      bsByAccountId: new Map(),
    }

    expect(resolvePlClassificationForAccount(index, {
      accountId: 'a1801',
      sourceAccountIds: ['a1801'],
      code: '1801',
      name: '长期待摊费用',
      type: 'ASSET',
    })).toBeNull()

    expect(resolvePlClassificationForAccount(index, {
      accountId: 'a5602',
      sourceAccountIds: ['a5602'],
      code: '5602',
      name: '管理费用',
      type: 'EXPENSE',
    })).toEqual({ statementType: 'EXPENSE', expenseCategory: 'administrative' })
  })
})
