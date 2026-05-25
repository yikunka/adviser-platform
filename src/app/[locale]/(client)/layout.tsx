import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import ClientShell from '@/components/layout/ClientShell'
import { claimPendingCompaniesForUser } from '@/lib/company/claim-pending-client'

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  const { locale } = await params

  if (!session) redirect(`/${locale}/login`)

  // Staff / admin accounts go to the admin portal
  const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])
  if (ADMIN_ROLES.has(session.user.role)) redirect(`/${locale}/admin/dashboard`)

  if (session.user.role === 'CLIENT') {
    if (!session.user.id) redirect(`/${locale}/login`)
    const email =
      session.user.email ||
      (await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      }))?.email
    if (email) await claimPendingCompaniesForUser(session.user.id, email)
  }

  return (
    <ClientShell userName={session.user.name ?? session.user.email}>
      {children}
    </ClientShell>
  )
}
