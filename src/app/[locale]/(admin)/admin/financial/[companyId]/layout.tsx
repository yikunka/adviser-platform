import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { UrlBasedCompanyProvider } from '@/components/admin/financial/FinancialCompanyContext'
import { computeEffectivePermissions, hasPermission } from '@/lib/auth/permissions'

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

// Any financial write action grants non-readonly mode
const FINANCIAL_WRITE_PERMS = [
  'financialJournal.create', 'financialJournal.edit', 'financialJournal.approve',
  'financialReceivables.create', 'financialReceivables.edit', 'financialReceivables.approve',
  'financialPayables.create', 'financialPayables.edit', 'financialPayables.approve',
  'financialAccounts.create', 'financialAccounts.edit', 'financialAccounts.delete',
  'financialBanking.create', 'financialBanking.edit',
  'financialParties.create', 'financialParties.edit', 'financialParties.delete',
]

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

  const [company, userRow] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, nameEn: true, companyCode: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        adminMenuKeys: true,
        adminPlatforms: true,
        adminRole: { select: { permissions: true } },
      },
    }),
  ])

  if (!company) notFound()

  const access = await resolveCompanyAccess(session.user.id, session.user.role)
  if (!(await assertCompanyAccessible(access, company.id))) {
    notFound()
  }

  const effectivePerms = computeEffectivePermissions(userRow ?? { role: session.user.role, adminMenuKeys: [], adminPlatforms: [] })
  const financialReadOnly = effectivePerms !== 'all' && !FINANCIAL_WRITE_PERMS.some(p => hasPermission(effectivePerms, p))

  return (
    <UrlBasedCompanyProvider
      company={{
        id: company.id,
        nameEn: company.nameEn,
        companyCode: company.companyCode,
        financialReadOnly,
      }}
    >
      {children}
    </UrlBasedCompanyProvider>
  )
}
