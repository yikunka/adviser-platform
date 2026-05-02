import { auth } from '@/lib/auth/auth'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { UserRole } from '@prisma/client'

const ROLE_RANK: Record<UserRole, number> = {
  CLIENT: 0,
  STAFF: 1,
  COMPLIANCE: 2,
  SUPER_ADMIN: 3,
}

type RBACResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse }

export async function requireRole(minRole: UserRole): Promise<RBACResult> {
  const session = await auth()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minRole]) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session: session as Session, error: null }
}
