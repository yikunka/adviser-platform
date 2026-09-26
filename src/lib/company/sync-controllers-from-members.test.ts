import { describe, expect, it } from 'vitest'
import {
  controllerCeaseDateFromMovements,
  memberShareInDate,
  sameCalendarDay,
} from './sync-controllers-from-members'

const d = (iso: string) => new Date(`${iso}T12:00:00`)

describe('controller dates follow member share movements', () => {
  it('uses the first movement as the member in date', () => {
    const inDate = memberShareInDate([
      { sharesHeld: 0, transactionDate: d('2026-09-14'), createdAt: d('2026-09-14') },
      { sharesHeld: 10000, transactionDate: d('2020-03-01'), createdAt: d('2020-03-01') },
    ])
    expect(inDate && sameCalendarDay(inDate, d('2020-03-01'))).toBe(true)
  })

  it('uses the zero-share movement as the cease date', () => {
    const outDate = controllerCeaseDateFromMovements([
      { sharesHeld: 10000, transactionDate: d('2020-03-01') },
      { sharesHeld: 0, transactionDate: d('2026-09-14') },
    ], false)
    expect(outDate && sameCalendarDay(outDate, d('2026-09-14'))).toBe(true)
  })

  it('does not treat a single allotment as an out date', () => {
    expect(controllerCeaseDateFromMovements([
      { sharesHeld: 10000, transactionDate: d('2020-03-01') },
    ], false)).toBeNull()
  })

  it('does not cease a member who is still above the threshold', () => {
    expect(controllerCeaseDateFromMovements([
      { sharesHeld: 10000, transactionDate: d('2020-03-01') },
      { sharesHeld: 0, transactionDate: d('2026-09-14') },
    ], true)).toBeNull()
  })

  it('uses the later movement when the holding fell to 25% or below but is not zero', () => {
    const outDate = controllerCeaseDateFromMovements([
      { sharesHeld: 8000, transactionDate: d('2020-03-01') },
      { sharesHeld: 1000, transactionDate: d('2024-06-01') },
    ], false)
    expect(outDate && sameCalendarDay(outDate, d('2024-06-01'))).toBe(true)
  })
})
