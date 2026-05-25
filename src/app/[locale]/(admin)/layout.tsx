import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import AdminShell from '@/components/layout/AdminShell'
import { computeEffectiveAdminMenus } from '@/lib/auth/admin-access'

const STAFF_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

function redirectToInvalidateSession(locale: string): never {
  const callbackUrl = encodeURIComponent(`/${locale}/admin-login`)
  redirect(`/api/admin/invalidate-session?callbackUrl=${callbackUrl}`)
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  const { locale } = await params

  if (!session) redirect(`/${locale}/admin-login`)
  if (!STAFF_ROLES.has(session.user.role)) redirect(`/${locale}/dashboard`)
  if (!session.user.id) redirectToInvalidateSession(locale)

  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, adminMenuKeys: true, adminPlatforms: true },
  })
  if (!userRow) redirectToInvalidateSession(locale)

  const menuAccess = computeEffectiveAdminMenus(userRow)

  return (
    <AdminShell
      userName={session.user.name ?? session.user.email}
      userRole={session.user.role}
      menuAccess={menuAccess}
      locale={locale}
    >
      {children}
    </AdminShell>
  )
}
