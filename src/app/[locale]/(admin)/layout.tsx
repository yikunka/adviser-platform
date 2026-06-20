import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import AdminShell from '@/components/layout/AdminShell'
import { computeEffectiveAdminMenus } from '@/lib/auth/admin-access'
import { computeEffectivePermissions } from '@/lib/auth/permissions'

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
  const user = session?.user

  if (!user?.id || !user.role) redirect(`/${locale}/admin-login`)
  if (!STAFF_ROLES.has(user.role)) redirect(`/${locale}/dashboard`)

  const userRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      adminMenuKeys: true,
      adminPlatforms: true,
      adminRoles: { select: { role: { select: { permissions: true } } } },
    },
  })
  if (!userRow) redirectToInvalidateSession(locale)

  const rolePermsList = userRow.adminRoles.map(r => r.role.permissions)

  const menuAccess = computeEffectiveAdminMenus({
    ...userRow,
    adminRolesPermissions: rolePermsList,
  })

  // Full permission set for button-level checks (null = all access)
  const effectivePerms = computeEffectivePermissions({
    ...userRow,
    adminRoles: userRow.adminRoles.map(r => r.role),
  })
  const permissions: string[] | null = effectivePerms === 'all' ? null : Array.from(effectivePerms)

  return (
    <AdminShell
      userName={user.name ?? user.email}
      userRole={user.role}
      menuAccess={menuAccess}
      permissions={permissions}
      locale={locale}
    >
      {children}
    </AdminShell>
  )
}
