import type { Platform, UserRole } from '@prisma/client'
import { MENU_PLATFORM } from './admin-access'

// ── Permission action types ────────────────────────────────────────
export type PermAction = 'view' | 'create' | 'edit' | 'delete' | 'import' | 'export' | 'approve' | 'complete' | 'manageSteps'

export const ACTION_LABELS: Record<PermAction, string> = {
  view:     '详情',
  create:   '新增',
  edit:     '编辑',
  delete:   '删除',
  import:   '导入',
  export:   '导出',
  approve:  '审批',
  complete: '完成',
  manageSteps: '管理步骤',
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
    group: 'Adviser',
    platform: 'ADVISER',
    pages: [
      { menuKey: 'companies', label: '企业管理', actions: ['create', 'edit'] },
      { menuKey: 'kyc',       label: 'KYC',      actions: ['approve'] },
      { menuKey: 'aml',       label: 'AML&PEP篩查', actions: ['approve'] },
      { menuKey: 'invoices',  label: '发票管理', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'projects',  label: '项目管理', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'contracts', label: '合同管理', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'tcspPricing', label: 'TCSP服务价格单', actions: ['create', 'edit', 'delete'] },
    ],
  },
  {
    group: '财务管理',
    platform: 'ADVISER',
    pages: [
      { menuKey: 'financial',            label: '财务（公司选择）', actions: [] },
      { menuKey: 'financialAccounts',    label: '科目表',           actions: ['create', 'edit', 'delete'] },
      { menuKey: 'financialJournal',     label: '日记账',           actions: ['create', 'edit', 'approve'] },
      { menuKey: 'financialLedger',      label: '总账',             actions: ['export'] },
      { menuKey: 'financialReports',     label: '财务报表',         actions: ['export'] },
      { menuKey: 'financialHistory',     label: '历史账本',         actions: ['import'] },
      { menuKey: 'financialSettings',    label: '财务设置',         actions: ['edit'] },
    ],
  },
  {
    group: 'SFS Diamond',
    platform: 'SFS_DIAMOND',
    pages: [
      { menuKey: 'sfsCustomers',    label: '客户',   actions: ['create', 'edit', 'delete'] },
      { menuKey: 'sfsOrders',       label: '订单',   actions: ['create', 'edit', 'delete', 'complete', 'manageSteps'] },
      { menuKey: 'sfsDiamondSpecs', label: '钻石规格', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'sfsFactory',      label: '价格管理', actions: ['edit'] },
      { menuKey: 'sfsInvoices',     label: '发票',   actions: ['create', 'edit', 'delete'] },
    ],
  },
  {
    group: 'System',
    platform: 'GLOBAL',
    pages: [
      { menuKey: 'users',      label: '用户管理', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'settings',   label: '系统设置', actions: ['edit'] },
      { menuKey: 'adminTeam',  label: '后台帐号', actions: ['create', 'edit', 'delete'] },
      { menuKey: 'adminRoles', label: '角色管理', actions: ['create', 'edit', 'delete'] },
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
  /** Permissions from all assigned AdminRoles (multi-role union). */
  adminRoles?: { permissions: string[] }[] | null
}

/**
 * Computes the full set of permissions for a user.
 * Returns 'all' for SUPER_ADMIN and legacy staff.
 * Returns a Set<string> otherwise — includes both page keys and action keys.
 * When multiple roles are assigned, their permissions are unioned.
 */
export function computeEffectivePermissions(user: UserPermissionInput): Set<string> | 'all' {
  if (user.role === 'SUPER_ADMIN') return 'all'
  if (user.role === 'CLIENT') return new Set()

  // Dynamic roles: union permissions from all assigned roles
  if (user.adminRoles && user.adminRoles.length > 0) {
    const perms = new Set<string>()
    for (const r of user.adminRoles) {
      for (const p of r.permissions) perms.add(p)
    }
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
