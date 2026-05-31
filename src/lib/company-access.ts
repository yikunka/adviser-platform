import type { Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type CompanyAccess = { kind: 'all' } | { kind: 'restricted'; companyIds: string[] }

const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'COMPLIANCE']

/** SUPER_ADMIN / COMPLIANCE see all companies; staff with assigned companies see those; legacy staff see all. */
export async function resolveCompanyAccess(userId: string, role: UserRole): Promise<CompanyAccess> {
  if (ADMIN_ROLES.includes(role)) return { kind: 'all' }

  const companies = await prisma.company.findMany({
    where: { assignedStaffId: userId },
    select: { id: true },
  })

  if (companies.length === 0) return { kind: 'all' }

  return { kind: 'restricted', companyIds: companies.map(company => company.id) }
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
