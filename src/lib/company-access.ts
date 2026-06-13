import type { Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type CompanyAccess = { kind: 'all' } | { kind: 'restricted'; companyIds: string[] }

const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'COMPLIANCE']

/** SUPER_ADMIN / COMPLIANCE see all companies; staff with assigned companies see those; legacy staff see all. */
export async function resolveCompanyAccess(userId: string, role: UserRole): Promise<CompanyAccess> {
  if (ADMIN_ROLES.includes(role)) return { kind: 'all' }

  const [assignedCompanies, staffAssignments, financialManagedCompanies] = await Promise.all([
    prisma.company.findMany({
      where: { assignedStaffId: userId },
      select: { id: true },
    }),
    prisma.companyStaffAssignment.findMany({
      where: { userId },
      select: { companyId: true },
    }),
    prisma.company.findMany({
      where: { financialManagerId: userId },
      select: { id: true },
    }),
  ])

  const companyIds = Array.from(new Set([
    ...assignedCompanies.map(company => company.id),
    ...staffAssignments.map(assignment => assignment.companyId),
    ...financialManagedCompanies.map(company => company.id),
  ]))

  if (companyIds.length === 0) return { kind: 'all' }

  return { kind: 'restricted', companyIds }
}

export function buildCompanyAccessWhere(access: CompanyAccess): Prisma.CompanyWhereInput | undefined {
  if (access.kind === 'all') return undefined
  return { id: { in: access.companyIds } }
}

export async function assertCompanyAccessible(
  access: CompanyAccess,
  companyId: string,
): Promise<boolean> {
  if (access.kind === 'all') return true
  return access.companyIds.includes(companyId)
}
