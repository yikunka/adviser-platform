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
    where: {
      financialEnabled: true,
      ...(buildCompanyAccessWhere(access) ?? {}),
      ...(session!.user.role === 'SUPER_ADMIN'
        ? {}
        : { financialManagerId: session!.user.id }),
    },
    orderBy: [{ nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      companyCode: true,
      financialManagerId: true,
      financialManager: { select: { nameEn: true } },
    },
  })

  const managerPairs = companies.flatMap(company =>
    company.financialManagerId
      ? [{ companyId: company.id, userId: company.financialManagerId }]
      : [],
  )

  const managerAssignments = managerPairs.length > 0
    ? await prisma.companyStaffAssignment.findMany({
        where: { OR: managerPairs },
        select: {
          companyId: true,
          user: { select: { nameEn: true } },
        },
      })
    : []

  const managerNameByCompanyId = new Map(
    managerAssignments.map(assignment => [assignment.companyId, assignment.user.nameEn]),
  )

  const companiesWithManager = companies.map(company => ({
    id: company.id,
    nameEn: company.nameEn,
    companyCode: company.companyCode,
    financialReadOnly: session!.user.role === 'STAFF',
    financialManagerName:
      managerNameByCompanyId.get(company.id)
      ?? company.financialManager?.nameEn
      ?? null,
  }))

  return NextResponse.json({ groups: [], companies: companiesWithManager })
}
