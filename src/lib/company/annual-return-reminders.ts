import { prisma } from '@/lib/db/prisma'
import {
  ANNUAL_RETURN_SOFT_REMINDER_DAYS,
  daysBetweenUtc,
  isHongKongCompanyForAnnualReturn,
  nextAnniversaryPlus42Deadline,
  type AnnualReturnReminderItem,
} from '@/lib/company/annual-return-deadline'

export type { AnnualReturnReminderItem }

/**
 * Soft reminders: ACTIVE Hong Kong companies whose next anniversary+42 deadline
 * falls within the next `withinDays` days (inclusive of today). Skips companies
 * that already have a FILED annual filing in the deadline's calendar year.
 */
export async function listAnnualReturnSoftReminders(
  asOf: Date = new Date(),
  withinDays: number = ANNUAL_RETURN_SOFT_REMINDER_DAYS,
): Promise<AnnualReturnReminderItem[]> {
  const companies = await prisma.company.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      dateOfIncorporation: { not: null },
    },
    select: {
      id: true,
      companyCode: true,
      nameEn: true,
      companyType: true,
      dateOfIncorporation: true,
    },
  })

  const candidates: Omit<AnnualReturnReminderItem, 'id'>[] = []
  for (const company of companies) {
    if (!company.dateOfIncorporation || !isHongKongCompanyForAnnualReturn(company)) continue
    const deadline = nextAnniversaryPlus42Deadline(company.dateOfIncorporation, asOf)
    const daysRemaining = daysBetweenUtc(asOf, deadline)
    if (daysRemaining < 0 || daysRemaining > withinDays) continue
    candidates.push({
      companyId: company.id,
      companyCode: company.companyCode,
      nameEn: company.nameEn,
      deadline,
      daysRemaining,
      href: `/admin/companies/${company.id}`,
    })
  }

  if (candidates.length === 0) return []

  const years = [...new Set(candidates.map(c => c.deadline.getUTCFullYear()))]
  const yearFilters = years.map(year => {
    const start = new Date(Date.UTC(year, 0, 1))
    const end = new Date(Date.UTC(year + 1, 0, 1))
    return {
      companyId: { in: candidates.map(c => c.companyId) },
      status: 'FILED' as const,
      OR: [
        { filingDeadline: { gte: start, lt: end } },
        { annualReturnDate: { gte: start, lt: end } },
      ],
    }
  })

  const filed = await prisma.annualFiling.findMany({
    where: { OR: yearFilters },
    select: {
      companyId: true,
      filingDeadline: true,
      annualReturnDate: true,
    },
  })

  const filedKeys = new Set(
    filed.flatMap(row => {
      const keys: string[] = []
      if (row.filingDeadline) keys.push(`${row.companyId}:${row.filingDeadline.getUTCFullYear()}`)
      if (row.annualReturnDate) keys.push(`${row.companyId}:${row.annualReturnDate.getUTCFullYear()}`)
      return keys
    }),
  )

  return candidates
    .filter(c => !filedKeys.has(`${c.companyId}:${c.deadline.getUTCFullYear()}`))
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime() || a.nameEn.localeCompare(b.nameEn))
    .map(c => ({
      ...c,
      id: `ar-${c.companyId}-${c.deadline.toISOString().slice(0, 10)}`,
    }))
}
