import { describe, expect, it } from 'vitest'
import { computeInvoiceDueDate } from './due-date-presets'

describe('computeInvoiceDueDate', () => {
  it('uses the issue date itself for cash terms', () => {
    expect(computeInvoiceDueDate('CASH', '2026-05-18')).toBe('2026-05-18')
    expect(computeInvoiceDueDate('CASH', '', new Date(2026, 1, 5))).toBe('2026-02-05')
  })

  it('returns the end of the reference month for month-end terms', () => {
    expect(computeInvoiceDueDate('MONTH_END', '2026-06-15')).toBe('2026-06-30')
  })

  it('adds 30 days after month end for month-end 30 terms', () => {
    expect(computeInvoiceDueDate('MONTH_END_30', '2026-06-15')).toBe('2026-07-30')
  })

  it('adds 60 days after month end for month-end 60 terms', () => {
    expect(computeInvoiceDueDate('MONTH_END_60', '2026-06-15')).toBe('2026-08-29')
  })

  it('falls back to the provided fallback date when the reference date is empty', () => {
    expect(computeInvoiceDueDate('MONTH_END', '', new Date(2026, 1, 5))).toBe('2026-02-28')
  })

  it('ignores invalid reference dates and uses the fallback date', () => {
    expect(computeInvoiceDueDate('MONTH_END_30', '2026-02-31', new Date(2026, 0, 10))).toBe('2026-03-02')
  })
})
