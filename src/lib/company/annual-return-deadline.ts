/** HK Companies Ordinance: annual return due within 42 days after the incorporation anniversary. */
export const ANNUAL_RETURN_DAYS_AFTER_ANNIVERSARY = 42

/** Soft reminder window on the admin dashboard (days before the deadline). */
export const ANNUAL_RETURN_SOFT_REMINDER_DAYS = 14

export type AnnualReturnReminderItem = {
  id: string
  companyId: string
  companyCode: string | null
  nameEn: string
  deadline: Date
  daysRemaining: number
  href: string
}

function utcCalendarDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function daysBetweenUtc(from: Date, to: Date): number {
  const ms = utcCalendarDate(to).getTime() - utcCalendarDate(from).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

/**
 * Anniversary of incorporation in `year`, then +42 calendar days (UTC date parts).
 * Matches the MM-DD shown on the company list / detail overview.
 */
export function anniversaryPlus42Deadline(dateOfIncorporation: Date, year: number): Date {
  const anniversary = new Date(Date.UTC(
    year,
    dateOfIncorporation.getUTCMonth(),
    dateOfIncorporation.getUTCDate(),
  ))
  return new Date(Date.UTC(
    anniversary.getUTCFullYear(),
    anniversary.getUTCMonth(),
    anniversary.getUTCDate() + ANNUAL_RETURN_DAYS_AFTER_ANNIVERSARY,
  ))
}

/** Next anniversary+42 deadline on or after `asOf` (UTC calendar day). */
export function nextAnniversaryPlus42Deadline(dateOfIncorporation: Date, asOf: Date = new Date()): Date {
  const asOfDay = utcCalendarDate(asOf)
  let candidate = anniversaryPlus42Deadline(dateOfIncorporation, asOfDay.getUTCFullYear())
  if (candidate.getTime() < asOfDay.getTime()) {
    candidate = anniversaryPlus42Deadline(dateOfIncorporation, asOfDay.getUTCFullYear() + 1)
  }
  return candidate
}

/** MM-DD label for the recurring anniversary+42 deadline (independent of year). */
export function annualReturnDeadlineMonthDay(dateOfIncorporation: Date | string | null | undefined): string | null {
  if (!dateOfIncorporation) return null
  const date = typeof dateOfIncorporation === 'string' ? new Date(dateOfIncorporation) : dateOfIncorporation
  if (Number.isNaN(date.getTime())) return null
  const deadline = anniversaryPlus42Deadline(date, date.getUTCFullYear())
  return `${String(deadline.getUTCMonth() + 1).padStart(2, '0')}-${String(deadline.getUTCDate()).padStart(2, '0')}`
}

export function isHongKongCompanyForAnnualReturn(company: {
  companyType: string | null
  companyCode: string | null
}): boolean {
  if (company.companyType === 'HONG_KONG') return true
  // Legacy rows without jurisdiction still use AA##### codes for HK.
  return !!company.companyCode?.toUpperCase().startsWith('AA')
}
