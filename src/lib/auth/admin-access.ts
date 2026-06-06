import type { Platform, UserRole } from '@prisma/client'

export const ADMIN_MENU_KEYS = [
  'dashboard',
  'companies',
  'kyc',
  'aml',
  'financial',
  'invoices',
  'users',
  'sfsCustomers',
  'sfsOrders',
  'sfsInvoices',
  'sfsDiamondSpecs',
  'settings',
  'cosmocoatProducts',
  'cosmocoatRawMaterials',
  'cosmocoatRecipes',
  'cosmocoatColorFormulas',
  'cosmocoatFactoryProducts',
  'cosmocoatProductionOrders',
  'cosmocoatProcessKits',
  'cosmocoatSampleOrders',
  'cosmocoatCustomers',
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
  financial: 'ADVISER',
  invoices: 'ADVISER',
  users: 'GLOBAL',
  sfsCustomers: 'SFS_DIAMOND',
  sfsOrders: 'SFS_DIAMOND',
  sfsInvoices: 'SFS_DIAMOND',
  sfsDiamondSpecs: 'SFS_DIAMOND',
  cosmocoatProducts: 'COSMICOAT',
  cosmocoatRawMaterials: 'COSMICOAT',
  cosmocoatRecipes: 'COSMICOAT',
  cosmocoatColorFormulas: 'COSMICOAT',
  cosmocoatFactoryProducts: 'COSMICOAT',
  cosmocoatProductionOrders: 'COSMICOAT',
  cosmocoatProcessKits: 'COSMICOAT',
  cosmocoatSampleOrders: 'COSMICOAT',
  cosmocoatCustomers: 'COSMICOAT',
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
    case 'financial':
      return 'financial'
    case 'invoices':
      return 'invoices'
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
    case 'cosmocoat-products':
      return 'cosmocoatProducts'
    case 'cosmocoat-product-categories':
      return 'cosmocoatFactoryProducts'
    case 'cosmocoat-raw-materials':
      return 'cosmocoatRawMaterials'
    case 'cosmocoat-recipes':
      return 'cosmocoatRecipes'
    case 'cosmocoat-color-formulas':
      return 'cosmocoatColorFormulas'
    case 'cosmocoat-factory-products':
      return 'cosmocoatFactoryProducts'
    case 'cosmocoat-production-orders':
      return 'cosmocoatProductionOrders'
    case 'cosmocoat-process-kits':
      return 'cosmocoatProcessKits'
    case 'cosmocoat-sample-orders':
      return 'cosmocoatSampleOrders'
    case 'cosmocoat-customers':
      return 'cosmocoatCustomers'
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
  { key: 'financial', label: 'Financial', group: 'Finance Management' },
  { key: 'invoices', label: 'Invoices', group: 'Adviser' },
  { key: 'users', label: 'Customer account management', group: 'System' },
  { key: 'sfsCustomers', label: 'SFS customers', group: 'SFS Diamond' },
  { key: 'sfsOrders', label: 'SFS orders', group: 'SFS Diamond' },
  { key: 'sfsInvoices', label: 'SFS invoices', group: 'SFS Invoices' },
  { key: 'sfsDiamondSpecs', label: 'Diamond specs', group: 'SFS Diamond' },
  { key: 'cosmocoatProducts', label: 'Product management', group: 'CosmoCoat' },
  { key: 'cosmocoatRawMaterials', label: 'Raw material management', group: 'CosmoCoat' },
  { key: 'cosmocoatRecipes', label: 'Recipe management', group: 'CosmoCoat' },
  { key: 'cosmocoatColorFormulas', label: 'Color matching formulas', group: 'CosmoCoat' },
  { key: 'cosmocoatFactoryProducts', label: 'Factory product management', group: 'CosmoCoat' },
  { key: 'cosmocoatProductionOrders', label: 'Production orders', group: 'CosmoCoat' },
  { key: 'cosmocoatProcessKits', label: 'Process kits', group: 'CosmoCoat' },
  { key: 'cosmocoatSampleOrders', label: 'Sample orders', group: 'CosmoCoat' },
  { key: 'cosmocoatCustomers', label: 'Customer management', group: 'CosmoCoat' },
  { key: 'settings', label: 'Settings', group: 'System' },
  { key: 'adminTeam', label: 'Admin users & access', group: 'System' },
]
