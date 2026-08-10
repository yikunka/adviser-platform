import type { Platform, UserRole } from '@prisma/client'

export const ADMIN_MENU_KEYS = [
  'dashboard',
  'companies',
  'kyc',
  'aml',
  'financial',
  'financialAccounts',
  'financialJournal',
  'financialLedger',
  'financialReports',
  'financialReceivables',
  'financialPayables',
  'financialBanking',
  'financialParties',
  'financialHistory',
  'invoices',
  'contracts',
  'tcspPricing',
  'users',
  'sfsCustomers',
  'sfsOrders',
  'sfsInvoices',
  'sfsDiamondSpecs',
  'settings',
  'adminTeam',
  'adminRoles',
] as const

export type AdminMenuKey = (typeof ADMIN_MENU_KEYS)[number]

export const MENU_PLATFORM: Record<AdminMenuKey, Platform | 'GLOBAL'> = {
  dashboard: 'GLOBAL',
  settings: 'GLOBAL',
  adminTeam: 'GLOBAL',
  adminRoles: 'GLOBAL',
  companies: 'ADVISER',
  kyc: 'ADVISER',
  aml: 'ADVISER',
  financial: 'ADVISER',
  financialAccounts: 'ADVISER',
  financialJournal: 'ADVISER',
  financialLedger: 'ADVISER',
  financialReports: 'ADVISER',
  financialReceivables: 'ADVISER',
  financialPayables: 'ADVISER',
  financialBanking: 'ADVISER',
  financialParties: 'ADVISER',
  financialHistory: 'ADVISER',
  invoices: 'ADVISER',
  contracts: 'ADVISER',
  tcspPricing: 'ADVISER',
  users: 'GLOBAL',
  sfsCustomers: 'SFS_DIAMOND',
  sfsOrders: 'SFS_DIAMOND',
  sfsInvoices: 'SFS_DIAMOND',
  sfsDiamondSpecs: 'SFS_DIAMOND',
}

export type AdminAccessUser = {
  role: UserRole
  adminMenuKeys: string[]
  adminPlatforms: Platform[]
  /** Permissions from all assigned AdminRoles (multi-role union). */
  adminRolesPermissions?: string[][]
}

/** Resolves JWT/session-safe menu access for staff users (super admin = all). */
export function computeEffectiveAdminMenus(user: AdminAccessUser): ReadonlySet<AdminMenuKey> | 'all' {
  if (user.role === 'SUPER_ADMIN') return 'all'
  if (user.role === 'CLIENT') return new Set()

  // Dynamic roles: union menu keys from all assigned roles
  if (user.adminRolesPermissions && user.adminRolesPermissions.length > 0) {
    const keys = new Set<AdminMenuKey>()
    for (const rolePerms of user.adminRolesPermissions) {
      for (const perm of rolePerms) {
        if (perm.includes('.')) continue
        if (!ADMIN_MENU_KEYS.includes(perm as AdminMenuKey)) continue
        keys.add(perm as AdminMenuKey)
      }
    }
    keys.add('dashboard')
    return keys
  }

  // Legacy staff: nothing explicitly configured → full access
  const hasLegacyConfig = user.adminMenuKeys.length > 0 || user.adminPlatforms.length > 0
  if (!hasLegacyConfig) return 'all'

  // Legacy explicit grants — page view only, platform-filtered
  const keys = new Set<AdminMenuKey>()
  const platformSet = new Set(user.adminPlatforms)
  const hasPlatformFilter = user.adminPlatforms.length > 0
  for (const raw of user.adminMenuKeys) {
    if (!ADMIN_MENU_KEYS.includes(raw as AdminMenuKey)) continue
    const k = raw as AdminMenuKey
    const plat = MENU_PLATFORM[k]
    if (plat === 'GLOBAL') { keys.add(k); continue }
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
  if (menus.has(required)) return true
  // Legacy: 'financial' access grants all financial sub-page API routes
  if (required === 'financial') {
    for (const k of menus) {
      if (k.startsWith('financial')) return true
    }
  }
  return false
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
    case 'financial': {
      // Match /admin/financial/<sub> or /admin/financial/<companyId>/<sub>
      const rest = pathname.replace(/^.*\/admin\/financial/, '')
      const parts = rest.split('/').filter(Boolean)
      // parts[0] is either a sub-page name or a companyId; parts[1] (if present) is a sub-page name
      const sub = parts.length >= 2 ? parts[1] : parts[0]
      switch (sub) {
        case 'accounts':     return 'financialAccounts'
        case 'journal':      return 'financialJournal'
        case 'ledger':       return 'financialLedger'
        case 'reports':      return 'financialReports'
        case 'receivables':  return 'financialReceivables'
        case 'payables':     return 'financialPayables'
        case 'banking':      return 'financialBanking'
        case 'parties':      return 'financialParties'
        case 'history':      return 'financialHistory'
        default:             return 'financial'
      }
    }
    case 'invoices':
      return 'invoices'
    case 'contracts':
      return 'contracts'
    case 'tcsp-pricing':
      return 'tcspPricing'
    case 'users':
      return 'users'
    case 'sfs-customers':
      return 'sfsCustomers'
    case 'sfs-orders':
      return 'sfsOrders'
    case 'sfs-invoices':
      return 'sfsInvoices'
    case 'sfs-diamond-specs':
      return 'sfsDiamondSpecs'
    case 'settings':
      return 'settings'
    case 'team':
      return 'adminTeam'
    case 'admin-roles':
      return 'adminRoles'
    default:
      return null
  }
}

/** Labels for team management UI */
export const ADMIN_PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'ADVISER', label: '6M Advise' },
  { value: 'SFS_DIAMOND', label: 'SFS Diamond' },
]

export const ADMIN_MENU_OPTIONS: { key: AdminMenuKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'main' },
  { key: 'companies', label: 'Companies', group: 'Adviser' },
  { key: 'kyc', label: 'KYC queue', group: 'Adviser' },
  { key: 'aml', label: 'AML', group: 'Adviser' },
  { key: 'financial',           label: 'Financial (company select)', group: 'Finance Management' },
  { key: 'financialAccounts',   label: 'Chart of accounts',          group: 'Finance Management' },
  { key: 'financialJournal',    label: 'Journal entries',            group: 'Finance Management' },
  { key: 'financialLedger',     label: 'General ledger',             group: 'Finance Management' },
  { key: 'financialReports',    label: 'Financial reports',          group: 'Finance Management' },
  { key: 'financialReceivables',label: 'Receivables',                group: 'Finance Management' },
  { key: 'financialPayables',   label: 'Payables',                   group: 'Finance Management' },
  { key: 'financialBanking',    label: 'Banking',                    group: 'Finance Management' },
  { key: 'financialParties',    label: 'Parties',                    group: 'Finance Management' },
  { key: 'financialHistory',    label: 'Historical ledger books',    group: 'Finance Management' },
  { key: 'invoices', label: 'Invoices', group: 'Adviser' },
  { key: 'contracts', label: 'Contracts', group: 'Adviser' },
  { key: 'tcspPricing', label: 'TCSP service pricing', group: 'Adviser' },
  { key: 'users', label: 'Customer account management', group: 'System' },
  { key: 'sfsCustomers', label: 'SFS customers', group: 'SFS Diamond' },
  { key: 'sfsOrders', label: 'SFS orders', group: 'SFS Diamond' },
  { key: 'sfsInvoices', label: 'SFS invoices', group: 'SFS Invoices' },
  { key: 'sfsDiamondSpecs', label: 'Diamond specs', group: 'SFS Diamond' },
  { key: 'settings', label: 'Settings', group: 'System' },
  { key: 'adminTeam', label: 'Admin users & access', group: 'System' },
  { key: 'adminRoles', label: 'Role management', group: 'System' },
]
