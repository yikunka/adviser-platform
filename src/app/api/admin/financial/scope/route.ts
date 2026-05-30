import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildCompanyGroupWhere,
  buildGroupWhere,
  resolveEntityGroupAccess,
} from '@/lib/entity-groups/access'

export async function GET() {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  const [groups, companies] = await Promise.all([
    prisma.clientEntityGroup.findMany({
      where: buildGroupWhere(access),
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.company.findMany({
      where: buildCompanyGroupWhere(access),
      orderBy: [{ groupId: 'asc' }, { nameEn: 'asc' }],
      select: {
        id: true,
        nameEn: true,
        companyCode: true,
        groupId: true,
        group: { select: { id: true, name: true } },
      },
    }),
  ])

  return NextResponse.json({ groups, companies })
}
