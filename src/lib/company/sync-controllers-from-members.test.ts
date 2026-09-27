import { describe, expect, it } from 'vitest'
import {
  computeMemberControllerDates,
  parseShareCalendarDate,
  sameCalendarDay,
} from './sync-controllers-from-members'

const d = (iso: string) => new Date(`${iso}T12:00:00`)

describe('computeMemberControllerDates', () => {
  it('sets becoming to the date ownership first crossed above 25%, not the first small allotment', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 1000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'b', sharesHeld: 9000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        // A rises from 10% to 40%
        { memberId: 'a', sharesHeld: 4000, transactionDate: d('2024-06-01'), transactionType: 'TRANSFER_IN' },
        { memberId: 'b', sharesHeld: 6000, transactionDate: d('2024-06-01'), transactionType: 'TRANSFER_OUT' },
      ],
      ['a', 'b'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(true)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2024-06-01'))).toBe(true)
    expect(a.cessationDate).toBeNull()
    expect(a.ownershipPercentAtBecoming).toBe(40)
  })

  it('freezes nature % at becoming day even if holding changes later while still above 25%', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 10000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        // A was 100%; after B allotted, A is 50% but still above 25%
        { memberId: 'b', sharesHeld: 10000, transactionDate: d('2024-06-01'), transactionType: 'ALLOTMENT' },
      ],
      ['a', 'b'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(true)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2020-01-01'))).toBe(true)
    expect(a.ownershipPercentAtBecoming).toBe(100)
    const b = dates.get('b')!
    expect(b.currentlyAbove).toBe(true)
    expect(b.ownershipPercentAtBecoming).toBe(50)
  })

  it('sets cessation to the date ownership first fell to 25% or below', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 8000, transactionDate: d('2020-03-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'b', sharesHeld: 2000, transactionDate: d('2020-03-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'a', sharesHeld: 1000, transactionDate: d('2024-06-01'), transactionType: 'TRANSFER_OUT' },
        { memberId: 'b', sharesHeld: 9000, transactionDate: d('2024-06-01'), transactionType: 'TRANSFER_IN' },
      ],
      ['a', 'b'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(false)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2020-03-01'))).toBe(true)
    expect(a.cessationDate && sameCalendarDay(a.cessationDate, d('2024-06-01'))).toBe(true)
  })

  it('uses zero-share transfer date as cessation', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 10000, transactionDate: d('2020-03-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'a', sharesHeld: 0, transactionDate: d('2026-09-14'), transactionType: 'TRANSFER_OUT' },
        { memberId: 'b', sharesHeld: 10000, transactionDate: d('2026-09-14'), transactionType: 'TRANSFER_IN' },
      ],
      ['a', 'b'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(false)
    expect(a.cessationDate && sameCalendarDay(a.cessationDate, d('2026-09-14'))).toBe(true)
    const b = dates.get('b')!
    expect(b.currentlyAbove).toBe(true)
    expect(b.becomingDate && sameCalendarDay(b.becomingDate, d('2026-09-14'))).toBe(true)
    expect(b.ownershipPercentAtBecoming).toBe(100)
  })

  it('ceases on dilution when another member is allotted shares', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 3000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'b', sharesHeld: 7000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        // A was 30%; after C is allotted 10000, A is 15%
        { memberId: 'c', sharesHeld: 10000, transactionDate: d('2025-01-15'), transactionType: 'ALLOTMENT' },
      ],
      ['a', 'b', 'c'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(false)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2020-01-01'))).toBe(true)
    expect(a.cessationDate && sameCalendarDay(a.cessationDate, d('2025-01-15'))).toBe(true)
  })

  it('uses the re-entry date as becoming after a prior cessation', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 6000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'b', sharesHeld: 4000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        // A drops to 20%
        { memberId: 'a', sharesHeld: 2000, transactionDate: d('2022-06-01'), transactionType: 'TRANSFER_OUT' },
        { memberId: 'b', sharesHeld: 8000, transactionDate: d('2022-06-01'), transactionType: 'TRANSFER_IN' },
        // A rises above 25% again
        { memberId: 'a', sharesHeld: 4000, transactionDate: d('2025-03-01'), transactionType: 'TRANSFER_IN' },
        { memberId: 'b', sharesHeld: 6000, transactionDate: d('2025-03-01'), transactionType: 'TRANSFER_OUT' },
      ],
      ['a', 'b'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(true)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2025-03-01'))).toBe(true)
    expect(a.cessationDate).toBeNull()
  })

  it('does not treat a sole allotment that stays above 25% as a cessation', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 10000, transactionDate: d('2020-03-01'), transactionType: 'ALLOTMENT' },
      ],
      ['a'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(true)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2020-03-01'))).toBe(true)
    expect(a.cessationDate).toBeNull()
  })

  it('keeps cessation on the first drop, not a later transfer while already below', () => {
    const dates = computeMemberControllerDates(
      [
        { memberId: 'a', sharesHeld: 8000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'b', sharesHeld: 2000, transactionDate: d('2020-01-01'), transactionType: 'ALLOTMENT' },
        { memberId: 'a', sharesHeld: 2000, transactionDate: d('2023-01-01'), transactionType: 'TRANSFER_OUT' },
        { memberId: 'b', sharesHeld: 8000, transactionDate: d('2023-01-01'), transactionType: 'TRANSFER_IN' },
        { memberId: 'a', sharesHeld: 1000, transactionDate: d('2024-06-01'), transactionType: 'TRANSFER_OUT' },
        { memberId: 'b', sharesHeld: 9000, transactionDate: d('2024-06-01'), transactionType: 'TRANSFER_IN' },
      ],
      ['a', 'b'],
    )
    const a = dates.get('a')!
    expect(a.currentlyAbove).toBe(false)
    expect(a.cessationDate && sameCalendarDay(a.cessationDate, d('2023-01-01'))).toBe(true)
    expect(a.becomingDate && sameCalendarDay(a.becomingDate, d('2020-01-01'))).toBe(true)
  })
})

describe('parseShareCalendarDate', () => {
  it('parses YYYY-MM-DD as local noon without UTC day-shift', () => {
    const parsed = parseShareCalendarDate('2024-06-01')
    expect(parsed.getFullYear()).toBe(2024)
    expect(parsed.getMonth()).toBe(5)
    expect(parsed.getDate()).toBe(1)
    expect(parsed.getHours()).toBe(12)
  })

  it('normalises UTC-midnight Date values to local calendar noon', () => {
    const utcMidnight = new Date('2024-06-01T00:00:00.000Z')
    const parsed = parseShareCalendarDate(utcMidnight)
    expect(sameCalendarDay(parsed, d('2024-06-01'))).toBe(true)
  })
})
