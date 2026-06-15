import type { CompanyAccess } from '@/lib/company-access'
import { assertCompanyAccessible } from '@/lib/company-access'
import { prisma } from '@/lib/db/prisma'
import { resolveReportGroupCompanyIds } from '@/lib/financial/report-groups'

export async function resolveFinancialReportScope(
  access: CompanyAccess,
  {
    companyId,
    reportGroupId,
  }: {
    companyId?: string
    reportGroupId?: string
  },
) {
  if (reportGroupId) {
    return {
      companyIds: await resolveReportGroupCompanyIds(reportGroupId, access),
    }
  }

  if (!companyId) return {}

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, financialEnabled: true },
  })

  if (!company || !company.financialEnabled) {
    throw new Error('Financial company not found')
  }
  if (!(await assertCompanyAccessible(access, company.id))) {
    throw new Error('Forbidden')
  }

  return { companyId: company.id }
}
