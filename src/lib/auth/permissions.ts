import type { Platform, UserRole } from '@prisma/client'
import { MENU_PLATFORM } from './admin-access'

// ── Permission action types ────────────────────────────────────────
export type PermAction = 'create' | 'edit' | 'delete' | 'import' | 'export' | 'approve' | 'complete'

export const ACTION_LABELS: Record<PermAction, string> = {
  create:   '新增',
  edit:     '编辑',
  delete:   '删除',
  import:   '导入',
  export:   '导出',
  approve:  '审批',
  complete: '完成',
}

// ── Permission matrix: pages and their available actions ──────────
export interface PagePermDef {
  menuKey: string
  label: string
  actions: PermAction[]
}

export interface PermGroup {
  group: string
  platform: Platform | 'GLOBAL'
  pages: PagePermDef[]
}

export const PERMISSION_GROUPS: PermGroup[] = [
  {
    group: 'CosmoCoat',
    platform: 'COSMICOAT',
    pages: [
      { menuKey: 'cosmocoatOverview',         label: '物料流向总览',  actions: [] },
      { menuKey: 'cosmocoatRawMaterials',     label: '原材料',       actions: ['create', 'edit', 'delete', 'import', 'export'] },
      { menuKey: 'cosmocoatRecipes',          label: '配方',         actions: ['create', 'edit', 'delete', 'approve'] },
      { menuKey: 'cosmocoatProducts',         label: '官网产品',     actions: ['create', 'edit', 'delete'] },
      { menuKey: 'cosmocoatFactoryProducts',  label: '工厂产品',     actions: ['create', 'edit', 'delete'] },
      { menuKey: 'cosmocoatColorFormulas',    label: '调色配方',     actions: ['create', 'edit', 'delete', 'export'] },
      { menuKey: 'cosmocoatProductionOrders', label: '生产单',       actions: ['create', 'edit', 'complete'] },
      { menuKey: 'cosmocoatProcessKits',      label: '工艺书',       actions: ['create', 'edit', 'delete', 'approve'] },
      { menuKey: 'cosmocoatSampleOrders',     label: '打样单',       actions: ['create', 'edit', 'complete'] },
      { menuKey: 'cosmocoatCustomers',        label: '客户',         actions: ['create', 'edit', 'delete'] },
      { menuKey: 'cosmocoatSuppliers',        label: '供应商',       actions: ['create', 'edit', 'delete'] },
      { menuKey: 'cosmocoatEmployees',        label: '员工',         actions: ['create', 'edit', 'delete'] },
    ],
  },
  {
    group: 'Adviser',
    platform: 'ADVISER',
    pages: [
      { menuKey: 'companies', label: '企业管理',   actions: ['create', 'edit'] },
      { menuKey: 'kyc',       label: 'KYC',        actions: ['approve'] },
      { menuKey: 'aml',       label: 'AML',        actions: ['approve'] },
      { menuKey: 'financial', label: '财务管理',   actions: ['create', 'edit', 'approve'] },
      { menuKey: 'invoices',  label: '发票管理',   actions: ['create', 'edit', 'delete'] },
    ],
  },
  {
    group: 'SFS Diamond',
    platform: 'SFS_DIAMOND',
    pages: [
      { menuKey: 'sfsCustomers',    label: '客户',   actions: ['create', 'edit', 'delete'] },
      { menuKey: 'sfsOrders',       label: '订单',   actions: ['create', 'edit', 'complete'] },
      { menuKey: 'sfsDiamondSpecs', label: '钻石规格', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'sfsInvoices',     label: '发票',   actions: ['create', 'edit', 'delete'] },
    ],
  },
  {
    group: 'System',
    platform: 'GLOBAL',
    pages: [
      { menuKey: 'users',    label: '用户管理', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'settings', label: '系统设置', actions: ['edit'] },
    ],
  },
]

// Flat lookup: menuKey → PagePermDef
export const PAGE_PERM_MAP = new Map<string, PagePermDef>(
  PERMISSION_GROUPS.flatMap(g => g.pages.map(p => [p.menuKey, p]))
)

// All valid permission strings (for validation)
const ALL_VALID_PERMS = new Set<string>([
  ...PERMISSION_GROUPS.flatMap(g =>
    g.pages.flatMap(p => [
      p.menuKey,
      ...p.actions.map(a => `${p.menuKey}.${a}`),
    ])
  ),
  'dashboard',
])

export function isValidPermission(perm: string): boolean {
  return ALL_VALID_PERMS.has(perm)
}

// ── Effective permission resolution ───────────────────────────────
export type UserPermissionInput = {
  role: UserRole
  adminMenuKeys: string[]
  adminPlatforms: Platform[]
  adminRole?: { permissions: string[] } | null
}

/**
 * Computes the full set of permissions for a user.
 * Returns 'all' for SUPER_ADMIN and legacy staff.
 * Returns a Set<string> otherwise — includes both page keys and action keys.
 */
export function computeEffectivePermissions(user: UserPermissionInput): Set<string> | 'all' {
  if (user.role === 'SUPER_ADMIN') return 'all'
  if (user.role === 'CLIENT') return new Set()

  // Dynamic role takes full authority — adminMenuKeys are ignored
  if (user.adminRole) {
    const perms = new Set<string>()
    for (const p of user.adminRole.permissions) perms.add(p)
    perms.add('dashboard')
    return perms
  }

  // Legacy staff: nothing explicitly configured → full access
  const hasLegacyConfig = user.adminMenuKeys.length > 0 || user.adminPlatforms.length > 0
  if (!hasLegacyConfig) return 'all'

  // Legacy explicit grants — page view only, platform-filtered
  const perms = new Set<string>()
  const platformSet = new Set(user.adminPlatforms)
  const hasPlatformFilter = user.adminPlatforms.length > 0
  for (const k of user.adminMenuKeys) {
    const plat = MENU_PLATFORM[k as keyof typeof MENU_PLATFORM]
    if (plat && plat !== 'GLOBAL') {
      if (hasPlatformFilter && !platformSet.has(plat as Platform)) continue
    }
    perms.add(k)
  }

  perms.add('dashboard')
  return perms
}

/** Checks a single permission against the resolved set. */
export function hasPermission(perms: Set<string> | 'all', perm: string): boolean {
  if (perms === 'all') return true
  return perms.has(perm)
}
