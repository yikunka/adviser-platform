import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'

export async function GET() {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const companies = await prisma.company.findMany({
    where: buildCompanyAccessWhere(access),
    orderBy: [{ nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      companyCode: true,
    },
  })

  return NextResponse.json({ groups: [], companies })
}
