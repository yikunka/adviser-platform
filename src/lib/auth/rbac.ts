import { auth } from '@/lib/auth/auth'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { adminMenusAllow, computeEffectiveAdminMenus, type AdminMenuKey } from '@/lib/auth/admin-access'
import { computeEffectivePermissions, hasPermission } from '@/lib/auth/permissions'

const ROLE_RANK: Record<UserRole, number> = {
  CLIENT: 0,
  STAFF: 1,
  COMPLIANCE: 2,
  SUPER_ADMIN: 3,
}

type RBACResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse }

export type RequireRoleOptions = {
  /** When set, staff (non–super-admin) must have this Admin Console menu permission. */
  adminMenu?: AdminMenuKey
  /** When set, staff must have at least one of these menu permissions. */
  adminMenus?: AdminMenuKey[]
}

const userPermSelect = {
  role: true,
  adminMenuKeys: true,
  adminPlatforms: true,
  adminRoles: { select: { role: { select: { permissions: true } } } },
} as const

export async function requireRole(minRole: UserRole, opts?: RequireRoleOptions): Promise<RBACResult> {
  const session = await auth()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minRole]) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if ((opts?.adminMenu || opts?.adminMenus?.length) && ROLE_RANK[session.user.role] >= ROLE_RANK.STAFF) {
    if (session.user.role !== 'SUPER_ADMIN') {
      const row = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: userPermSelect,
      })
      if (!row) {
        return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
      }
      const menus = computeEffectiveAdminMenus({
        ...row,
        adminRolesPermissions: row.adminRoles.map(r => r.role.permissions),
      })
      const required = [
        ...(opts.adminMenu ? [opts.adminMenu] : []),
        ...(opts.adminMenus ?? []),
      ]
      const allowed = required.some(key => adminMenusAllow(menus, key))
      if (!allowed) {
        return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
      }
    }
  }

  return { session: session as Session, error: null }
}

/**
 * Checks a specific permission string (page key OR action key like 'sfsOrders.create').
 * Use this for granular button-level API protection.
 */
export async function requirePermission(perm: string, minRole: UserRole = 'STAFF'): Promise<RBACResult> {
  const session = await auth()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minRole]) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (session.user.role === 'SUPER_ADMIN') {
    return { session: session as Session, error: null }
  }

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: userPermSelect,
  })
  if (!row) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const perms = computeEffectivePermissions({
    ...row,
    adminRoles: row.adminRoles.map(r => r.role),
  })
  if (!hasPermission(perms, perm)) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session: session as Session, error: null }
}
