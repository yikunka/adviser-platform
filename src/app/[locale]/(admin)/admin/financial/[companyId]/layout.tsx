import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { UrlBasedCompanyProvider } from '@/components/admin/financial/FinancialCompanyContext'

export const dynamic = 'force-dynamic'

const FINANCIAL_SUB_ROUTES = new Set([
  'accounts',
  'journal',
  'ledger',
  'reports',
  'receivables',
  'payables',
  'parties',
  'banking',
])

export default async function FinancialCompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; companyId: string }>
}) {
  const { locale, companyId } = await params

  if (FINANCIAL_SUB_ROUTES.has(companyId)) {
    redirect(`/${locale}/admin/financial`)
  }

  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/${locale}/admin-login`)
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      nameEn: true,
      companyCode: true,
    },
  })

  if (!company) notFound()

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, company.id))) {
    notFound()
  }

  return (
    <UrlBasedCompanyProvider
      company={{
        id: company.id,
        nameEn: company.nameEn,
        companyCode: company.companyCode,
      }}
    >
      {children}
    </UrlBasedCompanyProvider>
  )
}
