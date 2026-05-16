import { auth } from '@/lib/auth/auth'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { adminMenusAllow, computeEffectiveAdminMenus, type AdminMenuKey } from '@/lib/auth/admin-access'

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
}

export async function requireRole(minRole: UserRole, opts?: RequireRoleOptions): Promise<RBACResult> {
  const session = await auth()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minRole]) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if (opts?.adminMenu && ROLE_RANK[session.user.role] >= ROLE_RANK.STAFF) {
    if (session.user.role !== 'SUPER_ADMIN') {
      const row = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, adminMenuKeys: true, adminPlatforms: true },
      })
      if (!row) {
        return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
      }
      const menus = computeEffectiveAdminMenus(row)
      if (!adminMenusAllow(menus, opts.adminMenu)) {
        return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
      }
    }
  }

  return { session: session as Session, error: null }
}
