import { describe, expect, it } from 'vitest'
import { ADMIN_MENU_KEYS, MENU_PLATFORM, pathnameToAdminMenuKey } from '@/lib/auth/admin-access'
import { isValidPermission } from '@/lib/auth/permissions'

describe('Adviser contract, projects and TCSP pricing access', () => {
  it('registers new Adviser modules in Role Management permissions', () => {
    expect(ADMIN_MENU_KEYS).toContain('contracts')
    expect(ADMIN_MENU_KEYS).toContain('forms')
    expect(ADMIN_MENU_KEYS).toContain('projects')
    expect(ADMIN_MENU_KEYS).toContain('tcspPricing')
    expect(ADMIN_MENU_KEYS).toContain('workTasks')
    expect(MENU_PLATFORM.contracts).toBe('ADVISER')
    expect(MENU_PLATFORM.forms).toBe('ADVISER')
    expect(MENU_PLATFORM.projects).toBe('ADVISER')
    expect(MENU_PLATFORM.tcspPricing).toBe('ADVISER')
    expect(isValidPermission('contracts.create')).toBe(true)
    expect(isValidPermission('forms.create')).toBe(true)
    expect(isValidPermission('forms.delete')).toBe(true)
    expect(isValidPermission('projects.create')).toBe(true)
    expect(isValidPermission('projects.edit')).toBe(true)
    expect(isValidPermission('tcspPricing.edit')).toBe(true)
  })

  it('maps new Adviser module routes to independent permission keys', () => {
    expect(pathnameToAdminMenuKey('/zh/admin/contracts')).toBe('contracts')
    expect(pathnameToAdminMenuKey('/zh/admin/forms')).toBe('forms')
    expect(pathnameToAdminMenuKey('/zh/admin/projects')).toBe('projects')
    expect(pathnameToAdminMenuKey('/zh/admin/tcsp-pricing')).toBe('tcspPricing')
    expect(pathnameToAdminMenuKey('/zh/admin/tasks')).toBe('workTasks')
    expect(pathnameToAdminMenuKey('/zh/admin/tasks/share-transfer')).toBe('workTasks')
    expect(isValidPermission('workTasks.create')).toBe(true)
  })
})

describe('SFS Diamond access', () => {
  it('registers SFS Diamond modules in Role Management permissions', () => {
    expect(ADMIN_MENU_KEYS).toContain('sfsOrders')
    expect(ADMIN_MENU_KEYS).toContain('sfsFactory')
    expect(MENU_PLATFORM.sfsOrders).toBe('SFS_DIAMOND')
    expect(MENU_PLATFORM.sfsFactory).toBe('SFS_DIAMOND')
    expect(isValidPermission('sfsOrders.create')).toBe(true)
    expect(isValidPermission('sfsOrders.delete')).toBe(true)
    expect(isValidPermission('sfsOrders.manageSteps')).toBe(true)
    expect(isValidPermission('sfsOrders.approve')).toBe(true)
    expect(isValidPermission('sfsFactory.edit')).toBe(true)
  })

  it('maps SFS Diamond routes to permission keys', () => {
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-orders')).toBe('sfsOrders')
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-order-tracker')).toBe('sfsOrders')
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-customers')).toBe('sfsCustomers')
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-factory')).toBe('sfsFactory')
  })
})

describe('JMM Trading access', () => {
  it('registers JMM order desk modules in Role Management permissions', () => {
    expect(ADMIN_MENU_KEYS).toContain('jmmCustomers')
    expect(ADMIN_MENU_KEYS).toContain('jmmSuppliers')
    expect(ADMIN_MENU_KEYS).toContain('jmmOrders')
    expect(MENU_PLATFORM.jmmCustomers).toBe('JMM_TRADING')
    expect(MENU_PLATFORM.jmmSuppliers).toBe('JMM_TRADING')
    expect(MENU_PLATFORM.jmmOrders).toBe('JMM_TRADING')
    expect(isValidPermission('jmmCustomers.create')).toBe(true)
    expect(isValidPermission('jmmSuppliers.create')).toBe(true)
    expect(isValidPermission('jmmOrders.create')).toBe(true)
    expect(isValidPermission('jmmOrders.edit')).toBe(true)
    expect(isValidPermission('jmmOrders.delete')).toBe(true)
  })

  it('maps JMM routes to permission keys', () => {
    expect(pathnameToAdminMenuKey('/zh/admin/jmm-customers')).toBe('jmmCustomers')
    expect(pathnameToAdminMenuKey('/zh/admin/jmm-suppliers')).toBe('jmmSuppliers')
    expect(pathnameToAdminMenuKey('/zh/admin/jmm-orders')).toBe('jmmOrders')
    expect(pathnameToAdminMenuKey('/zh/admin/jmm-orders/new')).toBe('jmmOrders')
  })
})
