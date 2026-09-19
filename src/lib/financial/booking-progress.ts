import { prisma } from '@/lib/db/prisma'
import {
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import type { UserRole } from '@prisma/client'

export type BookingProgressRow = {
  id: string
  nameEn: string
  companyCode: string | null
  financialManagerName: string | null
  lastBookedPeriod: string | null
}

export function previousCalendarMonth(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatBookedPeriod(period: string) {
  const [year, month] = period.split('-')
  return `${year}年${month}月`
}

export function monthsBehindPeriod(period: string | null, duePeriod: string) {
  if (!period) return null
  const [year, month] = period.split('-').map(Number)
  const [dueYear, dueMonth] = duePeriod.split('-').map(Number)
  return (dueYear - year) * 12 + (dueMonth - month)
}

export async function listFinancialBookingProgress(
  userId: string,
  role: UserRole,
): Promise<BookingProgressRow[]> {
  const access = await resolveCompanyAccess(userId, role)
  const companies = await prisma.company.findMany({
    where: {
      financialEnabled: true,
      deletedAt: null,
      ...(buildCompanyAccessWhere(access) ?? {}),
    },
    orderBy: [{ companyCode: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      companyCode: true,
      financialManagerId: true,
      financialManager: { select: { nameEn: true } },
    },
  })
  if (companies.length === 0) return []

  const managerPairs = companies.flatMap(company =>
    company.financialManagerId
      ? [{ companyId: company.id, userId: company.financialManagerId }]
      : [],
  )
  const [booked, managerAssignments] = await Promise.all([
    prisma.journalEntry.groupBy({
      by: ['companyId'],
      where: {
        status: 'POSTED',
        companyId: { in: companies.map(company => company.id) },
      },
      _max: { period: true },
    }),
    managerPairs.length > 0
      ? prisma.companyStaffAssignment.findMany({
          where: { OR: managerPairs },
          select: { companyId: true, user: { select: { nameEn: true } } },
        })
      : Promise.resolve([]),
  ])

  const periodByCompanyId = new Map(
    booked
      .filter(row => row.companyId && row._max.period && /^\d{4}-\d{2}$/.test(row._max.period))
      .map(row => [row.companyId as string, row._max.period as string]),
  )
  const managerNameByCompanyId = new Map(
    managerAssignments.map(assignment => [assignment.companyId, assignment.user.nameEn]),
  )

  return companies
    .map(company => ({
      id: company.id,
      nameEn: company.nameEn,
      companyCode: company.companyCode,
      financialManagerName:
        managerNameByCompanyId.get(company.id)
        ?? company.financialManager?.nameEn
        ?? null,
      lastBookedPeriod: periodByCompanyId.get(company.id) ?? null,
    }))
    .sort((a, b) => {
      if (!a.lastBookedPeriod && b.lastBookedPeriod) return -1
      if (a.lastBookedPeriod && !b.lastBookedPeriod) return 1
      if (a.lastBookedPeriod && b.lastBookedPeriod && a.lastBookedPeriod !== b.lastBookedPeriod) {
        return a.lastBookedPeriod.localeCompare(b.lastBookedPeriod)
      }
      return (a.companyCode ?? a.nameEn).localeCompare(b.companyCode ?? b.nameEn)
    })
}
