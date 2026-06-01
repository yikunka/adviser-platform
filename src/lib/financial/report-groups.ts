import type { CompanyAccess } from '@/lib/company-access'
import { prisma } from '@/lib/db/prisma'

export function assertCompaniesAccessible(access: CompanyAccess, companyIds: string[]) {
  if (access.kind === 'all') return true
  const allowed = new Set(access.companyIds)
  return companyIds.every(companyId => allowed.has(companyId))
}

export async function resolveReportGroupCompanyIds(reportGroupId: string, access: CompanyAccess) {
  const group = await prisma.financialReportGroup.findUnique({
    where: { id: reportGroupId },
    include: {
      companies: {
        orderBy: { sortOrder: 'asc' },
        include: {
          company: {
            select: { id: true, financialEnabled: true },
          },
        },
      },
    },
  })

  if (!group) throw new Error('Report group not found')

  const companyIds = group.companies
    .filter(member => member.company.financialEnabled)
    .map(member => member.company.id)

  if (companyIds.length === 0) throw new Error('Report group has no financial companies')
  if (!assertCompaniesAccessible(access, companyIds)) throw new Error('Forbidden')

  return companyIds
}
