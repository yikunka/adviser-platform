import type { CompanyAccess } from '@/lib/company-access'
import { assertCompanyAccessible } from '@/lib/company-access'
import { prisma } from '@/lib/db/prisma'

export async function resolveFinancialReportScope(
  access: CompanyAccess,
  {
    companyId,
  }: {
    companyId?: string
  },
) {
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
