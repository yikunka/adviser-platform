import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import {
  calendarHalfYearRange,
  classifyDdrCompliance,
  dueDateNotifyFrom,
  firstDdrDueDate,
  previousHalfYearRange,
} from '@/lib/docgen/ddr-quarter'

describe('ddr half-year', () => {
  it('maps months to H1 / H2 with Jun 30 and Dec 31 dues', () => {
    const h1 = calendarHalfYearRange(new Date(2026, 3, 15)) // April
    expect(h1.half).toBe(1)
    expect(h1.label).toBe('H1 2026')
    expect(h1.dueDate.getMonth()).toBe(5)
    expect(h1.dueDate.getDate()).toBe(30)

    const h2 = calendarHalfYearRange(new Date(2026, 9, 1)) // October
    expect(h2.half).toBe(2)
    expect(h2.label).toBe('H2 2026')
    expect(h2.dueDate.getMonth()).toBe(11)
    expect(h2.dueDate.getDate()).toBe(31)
  })

  it('notifies one month before due dates', () => {
    expect(dueDateNotifyFrom(new Date(2026, 5, 30)).toDateString()).toBe(new Date(2026, 4, 30).toDateString())
    expect(dueDateNotifyFrom(new Date(2026, 11, 31)).toDateString()).toBe(new Date(2026, 10, 30).toDateString())
  })

  it('computes first due: Apr → Dec 31 same year; Jul → Jun 30 next year', () => {
    const apr = firstDdrDueDate(new Date(2026, 3, 10))
    expect(apr.getFullYear()).toBe(2026)
    expect(apr.getMonth()).toBe(11)
    expect(apr.getDate()).toBe(31)

    const jul = firstDdrDueDate(new Date(2026, 6, 1))
    expect(jul.getFullYear()).toBe(2027)
    expect(jul.getMonth()).toBe(5)
    expect(jul.getDate()).toBe(30)
  })

  it('stays silent until one month before first due', () => {
    // Open April 2026 → first due Dec 31; May is before Nov 30 notify
    expect(classifyDdrCompliance({
      now: new Date(2026, 4, 15),
      subjectSince: new Date(2026, 3, 10),
      lastDdrAt: null,
      hasCurrentQuarterDdr: false,
    })).toBe('ok')
  })

  it('marks due in the first-due notify window', () => {
    expect(classifyDdrCompliance({
      now: new Date(2026, 11, 1), // Dec 1 — after Nov 30
      subjectSince: new Date(2026, 3, 10), // April open
      lastDdrAt: null,
      hasCurrentQuarterDdr: false,
    })).toBe('due')
  })

  it('marks overdue after missing the first due half', () => {
    expect(classifyDdrCompliance({
      now: new Date(2027, 0, 15), // mid-Jan after Dec 31 miss
      subjectSince: new Date(2026, 3, 10),
      lastDdrAt: null,
      hasCurrentQuarterDdr: false,
    })).toBe('overdue')
  })

  it('July open: first due Jun 30 next year; silent through Dec of open year', () => {
    expect(classifyDdrCompliance({
      now: new Date(2026, 11, 15),
      subjectSince: new Date(2026, 6, 1),
      lastDdrAt: null,
      hasCurrentQuarterDdr: false,
    })).toBe('ok')

    expect(classifyDdrCompliance({
      now: new Date(2027, 5, 1), // Jun 1 2027 — in notify window
      subjectSince: new Date(2026, 6, 1),
      lastDdrAt: null,
      hasCurrentQuarterDdr: false,
    })).toBe('due')
  })

  it('current-half DDR clears obligation', () => {
    expect(classifyDdrCompliance({
      now: new Date(2026, 11, 1),
      subjectSince: new Date(2024, 0, 1),
      lastDdrAt: new Date(2026, 10, 1),
      hasCurrentQuarterDdr: true,
    })).toBe('ok')
  })

  it('previous half helper steps from H2 to H1', () => {
    const prev = previousHalfYearRange(new Date(2026, 7, 1)) // Aug → H2; previous H1
    expect(prev.half).toBe(1)
    expect(prev.year).toBe(2026)
  })
})
