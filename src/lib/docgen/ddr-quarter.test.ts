import { describe, expect, it } from 'vitest'
import { calendarQuarterRange, classifyDdrCompliance, previousCalendarQuarterRange } from '@/lib/docgen/ddr-quarter'

describe('ddr-quarter', () => {
  it('maps months to calendar quarters', () => {
    expect(calendarQuarterRange(new Date(2026, 0, 15)).quarter).toBe(1)
    expect(calendarQuarterRange(new Date(2026, 3, 1)).quarter).toBe(2)
    expect(calendarQuarterRange(new Date(2026, 8, 30)).quarter).toBe(3)
    expect(calendarQuarterRange(new Date(2026, 11, 31)).quarter).toBe(4)
  })

  it('classifies current-quarter DDR as ok', () => {
    const now = new Date(2026, 4, 10) // May → Q2
    const { start } = calendarQuarterRange(now)
    expect(classifyDdrCompliance({
      now,
      subjectSince: new Date(2025, 0, 1),
      lastDdrAt: start,
      hasCurrentQuarterDdr: true,
    })).toBe('ok')
  })

  it('marks new subjects this quarter as due when missing DDR', () => {
    const now = new Date(2026, 4, 10)
    const { start } = calendarQuarterRange(now)
    expect(classifyDdrCompliance({
      now,
      subjectSince: start,
      lastDdrAt: null,
      hasCurrentQuarterDdr: false,
    })).toBe('due')
  })

  it('marks older subjects with stale DDR as overdue', () => {
    const now = new Date(2026, 4, 10)
    const prev = previousCalendarQuarterRange(now)
    const stale = new Date(prev.start)
    stale.setMonth(stale.getMonth() - 1)
    expect(classifyDdrCompliance({
      now,
      subjectSince: new Date(2024, 0, 1),
      lastDdrAt: stale,
      hasCurrentQuarterDdr: false,
    })).toBe('overdue')
  })

  it('marks subjects with previous-quarter DDR as due for current quarter', () => {
    const now = new Date(2026, 4, 10)
    const prev = previousCalendarQuarterRange(now)
    expect(classifyDdrCompliance({
      now,
      subjectSince: new Date(2024, 0, 1),
      lastDdrAt: prev.start,
      hasCurrentQuarterDdr: false,
    })).toBe('due')
  })
})
