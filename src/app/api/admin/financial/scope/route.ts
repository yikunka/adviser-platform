import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { computeEffectivePermissions, hasPermission } from '@/lib/auth/permissions'

const FINANCIAL_WRITE_PERMS = [
  'financialJournal.create', 'financialJournal.edit', 'financialJournal.approve',
  'financialAccounts.create', 'financialAccounts.edit', 'financialAccounts.delete',
]

export async function GET() {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const [access, userRow] = await Promise.all([
    resolveCompanyAccess(session!.user.id, session!.user.role),
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: {
        role: true,
        adminMenuKeys: true,
        adminPlatforms: true,
        adminRoles: { select: { role: { select: { permissions: true } } } },
      },
    }),
  ])

  const effectivePerms = computeEffectivePermissions(
    userRow
      ? { ...userRow, adminRoles: userRow.adminRoles.map(r => r.role) }
      : { role: session!.user.role, adminMenuKeys: [], adminPlatforms: [] }
  )
  const financialReadOnly = effectivePerms !== 'all' && !FINANCIAL_WRITE_PERMS.some(p => hasPermission(effectivePerms, p))
  const companies = await prisma.company.findMany({
    where: {
      financialEnabled: true,
      ...(buildCompanyAccessWhere(access) ?? {}),
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
    financialReadOnly,
    financialManagerName:
      managerNameByCompanyId.get(company.id)
      ?? company.financialManager?.nameEn
      ?? null,
  }))

  return NextResponse.json({ groups: [], companies: companiesWithManager })
}
