import { describe, expect, it } from 'vitest'
import { ADMIN_MENU_KEYS, MENU_PLATFORM, pathnameToAdminMenuKey } from '@/lib/auth/admin-access'
import { isValidPermission } from '@/lib/auth/permissions'

describe('CosmoCoat recipe approvals access', () => {
  it('is an independent Role Management page permission', () => {
    expect(ADMIN_MENU_KEYS).toContain('cosmocoatRecipeApprovals')
    expect(MENU_PLATFORM.cosmocoatRecipeApprovals).toBe('COSMICOAT')
    expect(isValidPermission('cosmocoatRecipeApprovals')).toBe(true)
  })

  it('maps the approval page route to the independent permission key', () => {
    expect(pathnameToAdminMenuKey('/zh/admin/cosmocoat-recipe-approvals')).toBe('cosmocoatRecipeApprovals')
  })
})

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
