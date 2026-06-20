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
