import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveEntityGroupAccess,
} from '@/lib/entity-groups/access'

export const dynamic = 'force-dynamic'

const FINANCIAL_SUB_ROUTES = new Set(['accounts', 'journal', 'ledger', 'reports'])

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
      group: { select: { id: true, name: true } },
    },
  })

  if (!company) notFound()

  const access = await resolveEntityGroupAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, company.id))) {
    notFound()
  }

  return <>{children}</>
}
