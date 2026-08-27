import { describe, expect, it } from 'vitest'
import { ADMIN_MENU_KEYS, MENU_PLATFORM, pathnameToAdminMenuKey } from '@/lib/auth/admin-access'
import { isValidPermission } from '@/lib/auth/permissions'

describe('Adviser contract and TCSP pricing access', () => {
  it('registers new Adviser modules in Role Management permissions', () => {
    expect(ADMIN_MENU_KEYS).toContain('contracts')
    expect(ADMIN_MENU_KEYS).toContain('tcspPricing')
    expect(MENU_PLATFORM.contracts).toBe('ADVISER')
    expect(MENU_PLATFORM.tcspPricing).toBe('ADVISER')
    expect(isValidPermission('contracts.create')).toBe(true)
    expect(isValidPermission('tcspPricing.edit')).toBe(true)
  })

  it('maps new Adviser module routes to independent permission keys', () => {
    expect(pathnameToAdminMenuKey('/zh/admin/contracts')).toBe('contracts')
    expect(pathnameToAdminMenuKey('/zh/admin/tcsp-pricing')).toBe('tcspPricing')
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
    expect(isValidPermission('sfsFactory.edit')).toBe(true)
  })

  it('maps SFS Diamond routes to permission keys', () => {
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-orders')).toBe('sfsOrders')
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-customers')).toBe('sfsCustomers')
    expect(pathnameToAdminMenuKey('/zh/admin/sfs-factory')).toBe('sfsFactory')
  })
})
