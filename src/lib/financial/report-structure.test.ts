import { describe, expect, it } from 'vitest'
import {
  PL_REPORT_SECTIONS,
  BS_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
} from './report-structure-shared'
import { suggestReportSectionMappings } from './report-structure'

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
})
