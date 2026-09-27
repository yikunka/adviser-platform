import { describe, expect, it } from 'vitest'
import {
  isSyntheticReportAccountId,
  parseSyntheticReportAccountId,
  periodsThroughSelected,
} from './report-drill-down'

describe('report drill-down helpers', () => {
  it('detects synthetic consolidated account ids', () => {
    expect(isSyntheticReportAccountId('ASSET:01')).toBe(true)
    expect(isSyntheticReportAccountId('clyx123abc')).toBe(false)
  })

  it('parses type and code from synthetic ids', () => {
    expect(parseSyntheticReportAccountId('REVENUE:05')).toEqual({ type: 'REVENUE', code: '05' })
  })

  it('builds year-to-date period lists through the selected month', () => {
    expect(periodsThroughSelected('2026-05')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ])
  })
})
