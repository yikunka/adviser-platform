import type { Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type EntityGroupAccess = { kind: 'all' } | { kind: 'restricted'; groupIds: string[] }

const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'COMPLIANCE']

/** SUPER_ADMIN / COMPLIANCE see all groups; staff with memberships see only those; legacy staff (no memberships) see all. */
export async function resolveEntityGroupAccess(userId: string, role: UserRole): Promise<EntityGroupAccess> {
  if (ADMIN_ROLES.includes(role)) return { kind: 'all' }

  const memberships = await prisma.clientEntityGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })

  if (memberships.length === 0) return { kind: 'all' }

  return { kind: 'restricted', groupIds: memberships.map(m => m.groupId) }
}

export function groupIdsFromAccess(access: EntityGroupAccess): string[] | null {
  if (access.kind === 'all') return null
  return access.groupIds
}

export function buildGroupWhere(access: EntityGroupAccess): Prisma.ClientEntityGroupWhereInput | undefined {
  if (access.kind === 'all') return undefined
  return { id: { in: access.groupIds } }
}

export function buildCompanyGroupWhere(access: EntityGroupAccess): Prisma.CompanyWhereInput | undefined {
  if (access.kind === 'all') return undefined
  return { groupId: { in: access.groupIds } }
}

export async function assertGroupAccessible(
  access: EntityGroupAccess,
  groupId: string | null | undefined,
): Promise<boolean> {
  if (!groupId) return true
  if (access.kind === 'all') return true
  return access.groupIds.includes(groupId)
}

export async function assertCompanyAccessible(
  access: EntityGroupAccess,
  companyId: string,
): Promise<boolean> {
  if (access.kind === 'all') return true

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { groupId: true },
  })
  if (!company?.groupId) return false
  return access.groupIds.includes(company.groupId)
}
