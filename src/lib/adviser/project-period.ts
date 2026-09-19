/** Local calendar date as YYYY-MM-DD. */
export function localDateIso(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Inclusive one-year period end.
 * 2026-05-18 → 2027-05-17.
 */
export function periodEndOneYearAfter(start: string): string {
  const [year, month, day] = start.split('-').map(Number)
  if (!year || !month || !day) return ''
  const end = new Date(year + 1, month - 1, day)
  end.setDate(end.getDate() - 1)
  return localDateIso(end)
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

/**
 * Next period starts the day after the previous end, and ends the day before
 * that start date's anniversary. 2027-05-17 → 2027-05-18 .. 2028-05-17.
 * Uses UTC calendar parts so a date-only UTC midnight does not shift.
 */
export function defaultRenewalWindow(fromEndDate: Date): { startDate: Date; endDate: Date } {
  const startDate = utcDate(
    fromEndDate.getUTCFullYear(),
    fromEndDate.getUTCMonth(),
    fromEndDate.getUTCDate() + 1,
  )
  const endDate = utcDate(
    startDate.getUTCFullYear() + 1,
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  )
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  return { startDate, endDate }
}
