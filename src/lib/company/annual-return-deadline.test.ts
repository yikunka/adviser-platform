import { describe, expect, it } from 'vitest'
import {
  anniversaryPlus42Deadline,
  annualReturnDeadlineMonthDay,
  nextAnniversaryPlus42Deadline,
} from './annual-return-deadline'

describe('anniversaryPlus42Deadline', () => {
  it('adds 42 days after the incorporation anniversary in that year', () => {
    const doi = new Date(Date.UTC(2020, 2, 15)) // 15 Mar
    const deadline = anniversaryPlus42Deadline(doi, 2026)
    expect(deadline.toISOString().slice(0, 10)).toBe('2026-04-26')
  })
})

describe('nextAnniversaryPlus42Deadline', () => {
  it('returns this year’s deadline when still upcoming', () => {
    const doi = new Date(Date.UTC(2020, 2, 15))
    const asOf = new Date(Date.UTC(2026, 3, 1)) // 1 Apr 2026
    expect(nextAnniversaryPlus42Deadline(doi, asOf).toISOString().slice(0, 10)).toBe('2026-04-26')
  })

  it('rolls to next year when this year’s deadline has passed', () => {
    const doi = new Date(Date.UTC(2020, 2, 15))
    const asOf = new Date(Date.UTC(2026, 3, 27)) // 27 Apr 2026
    expect(nextAnniversaryPlus42Deadline(doi, asOf).toISOString().slice(0, 10)).toBe('2027-04-26')
  })

  it('includes today when deadline is today', () => {
    const doi = new Date(Date.UTC(2020, 2, 15))
    const asOf = new Date(Date.UTC(2026, 3, 26))
    expect(nextAnniversaryPlus42Deadline(doi, asOf).toISOString().slice(0, 10)).toBe('2026-04-26')
  })
})

describe('annualReturnDeadlineMonthDay', () => {
  it('formats the recurring MM-DD used on the company list', () => {
    expect(annualReturnDeadlineMonthDay(new Date(Date.UTC(2020, 2, 15)))).toBe('04-26')
  })
})
