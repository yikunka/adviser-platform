'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

type Permissions = Set<string> | 'all'

const AdminPermissionContext = createContext<{ permissions: Permissions }>({ permissions: 'all' })

/**
 * Wrap the admin shell with this provider.
 * Pass `null` for permissions to grant full access (SUPER_ADMIN / legacy staff).
 */
export function AdminPermissionProvider({
  children,
  permissions: raw,
}: {
  children: ReactNode
  permissions: string[] | null
}) {
  const permissions = useMemo<Permissions>(
    () => (raw === null ? 'all' : new Set(raw)),
    [raw],
  )
  return (
    <AdminPermissionContext.Provider value={{ permissions }}>
      {children}
    </AdminPermissionContext.Provider>
  )
}

/**
 * Hook for checking a permission inside any client component within the admin shell.
 *
 * Usage:
 *   const canCreate = useAdminPermission('sfsOrders.create')
 */
export function useAdminPermission(perm: string): boolean {
  const { permissions } = useContext(AdminPermissionContext)
  if (permissions === 'all') return true
  return permissions.has(perm)
}

/**
 * Returns the raw permissions set for advanced checks.
 */
export function useAdminPermissions(): Permissions {
  return useContext(AdminPermissionContext).permissions
}
