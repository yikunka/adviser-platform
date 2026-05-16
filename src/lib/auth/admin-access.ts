import type { Platform, UserRole } from '@prisma/client'

export const ADMIN_MENU_KEYS = [
  'dashboard',
  'companies',
  'kyc',
  'aml',
  'users',
  'sfsOrders',
  'settings',
  'cosmocoatProducts',
  'adminTeam',
] as const

export type AdminMenuKey = (typeof ADMIN_MENU_KEYS)[number]

const MENU_PLATFORM: Record<AdminMenuKey, Platform | 'GLOBAL'> = {
  dashboard: 'GLOBAL',
  settings: 'GLOBAL',
  adminTeam: 'GLOBAL',
  companies: 'ADVISER',
  kyc: 'ADVISER',
  aml: 'ADVISER',
  users: 'GLOBAL',
  sfsOrders: 'SFS_DIAMOND',
  cosmocoatProducts: 'COSMICOAT',
}

export type AdminAccessUser = {
  role: UserRole
  adminMenuKeys: string[]
  adminPlatforms: Platform[]
}

/** Resolves JWT/session-safe menu access for staff users (super admin = all). */
export function computeEffectiveAdminMenus(user: AdminAccessUser): ReadonlySet<AdminMenuKey> | 'all' {
  if (user.role === 'SUPER_ADMIN') return 'all'
  if (user.role === 'CLIENT') return new Set()

  const legacyStaff = user.adminMenuKeys.length === 0 && user.adminPlatforms.length === 0
  if (legacyStaff) return 'all'

  const platformSet = new Set(user.adminPlatforms)
  const hasPlatformFilter = user.adminPlatforms.length > 0

  const keys = new Set<AdminMenuKey>()
  for (const raw of user.adminMenuKeys) {
    if (!ADMIN_MENU_KEYS.includes(raw as AdminMenuKey)) continue
    const k = raw as AdminMenuKey
    const plat = MENU_PLATFORM[k]
    if (plat === 'GLOBAL') {
      keys.add(k)
      continue
    }
    if (!hasPlatformFilter || platformSet.has(plat)) keys.add(k)
  }

  keys.add('dashboard')
  return keys
}

export function adminMenusAllow(
  menus: ReadonlySet<AdminMenuKey> | 'all',
  required: AdminMenuKey,
): boolean {
  if (menus === 'all') return true
  return menus.has(required)
}

/** Map /{locale}/admin/<segment> to a menu key (first path segment only). */
export function pathnameToAdminMenuKey(pathname: string): AdminMenuKey | null {
  const m = pathname.match(/\/admin\/([^/?]+)/)
  const seg = m?.[1]
  if (!seg) return null
  switch (seg) {
    case 'dashboard':
      return 'dashboard'
    case 'companies':
      return 'companies'
    case 'kyc':
      return 'kyc'
    case 'aml':
      return 'aml'
    case 'users':
      return 'users'
    case 'sfs-orders':
      return 'sfsOrders'
    case 'settings':
      return 'settings'
    case 'team':
      return 'adminTeam'
    case 'cosmocoat-products':
      return 'cosmocoatProducts'
    default:
      return null
  }
}

/** Labels for team management UI */
export const ADMIN_PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'ADVISER', label: '6M Advise' },
  { value: 'SFS_DIAMOND', label: 'SFS Diamond' },
  { value: 'COSMICOAT', label: 'CosmoCoat' },
]

export const ADMIN_MENU_OPTIONS: { key: AdminMenuKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'main' },
  { key: 'companies', label: 'Companies', group: 'Adviser' },
  { key: 'kyc', label: 'KYC queue', group: 'Adviser' },
  { key: 'aml', label: 'AML', group: 'Adviser' },
  { key: 'users', label: 'Customer account management', group: 'System' },
  { key: 'sfsOrders', label: 'SFS orders', group: 'SFS Diamond' },
  { key: 'cosmocoatProducts', label: 'Product management', group: 'CosmoCoat' },
  { key: 'settings', label: 'Settings', group: 'System' },
  { key: 'adminTeam', label: 'Admin users & access', group: 'System' },
]
