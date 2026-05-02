import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import AdminShell from '@/components/layout/AdminShell'

const STAFF_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  const { locale } = await params

  if (!session) redirect(`/${locale}/login`)
  if (!STAFF_ROLES.has(session.user.role)) redirect(`/${locale}/dashboard`)

  return (
    <AdminShell userName={session.user.name ?? session.user.email} userRole={session.user.role}>
      {children}
    </AdminShell>
  )
}
