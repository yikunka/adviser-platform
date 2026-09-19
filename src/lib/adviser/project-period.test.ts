import { describe, expect, it } from 'vitest'
import { defaultRenewalWindow, periodEndOneYearAfter } from './project-period'

describe('periodEndOneYearAfter', () => {
  it('ends the day before the anniversary', () => {
    expect(periodEndOneYearAfter('2026-05-18')).toBe('2027-05-17')
    expect(periodEndOneYearAfter('2026-01-01')).toBe('2026-12-31')
  })

  it('returns an empty string for a blank start date', () => {
    expect(periodEndOneYearAfter('')).toBe('')
  })
})

describe('defaultRenewalWindow', () => {
  it('starts the day after the previous end and ends the day before the next anniversary', () => {
    const { startDate, endDate } = defaultRenewalWindow(new Date('2027-05-17T00:00:00.000Z'))
    expect(startDate.toISOString().slice(0, 10)).toBe('2027-05-18')
    expect(endDate.toISOString().slice(0, 10)).toBe('2028-05-17')
  })
})
