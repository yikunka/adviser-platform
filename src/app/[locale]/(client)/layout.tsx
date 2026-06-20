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
  const user = session?.user

  if (!user?.id || !user.role) redirect(`/${locale}/login`)

  // Staff / admin accounts go to the admin portal
  const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])
  if (ADMIN_ROLES.has(user.role)) redirect(`/${locale}/admin/dashboard`)

  if (user.role === 'CLIENT') {
    const email =
      user.email ||
      (await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      }))?.email
    if (email) await claimPendingCompaniesForUser(user.id, email)
  }

  return (
    <ClientShell userName={user.name ?? user.email}>
      {children}
    </ClientShell>
  )
}
