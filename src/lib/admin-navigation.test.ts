import { describe, expect, it } from 'vitest'
import { financialRouteSection, isAdminNavHrefActive, normalizeAdminPathname } from '@/lib/admin-navigation'

describe('admin navigation route matching', () => {
  it('normalizes localized admin paths', () => {
    expect(normalizeAdminPathname('/en/admin/financial/accounts')).toBe('/admin/financial/accounts')
    expect(normalizeAdminPathname('/zh/admin/companies/abc/')).toBe('/admin/companies/abc')
  })

  it('detects financial sections from selector, redirect, and company-scoped routes', () => {
    expect(financialRouteSection('/en/admin/financial')).toBe('selector')
    expect(financialRouteSection('/en/admin/financial/accounts')).toBe('accounts')
    expect(financialRouteSection('/en/admin/financial/cmpkppbnh0u0lqfw5350jraae/accounts')).toBe('accounts')
    expect(financialRouteSection('/en/admin/financial/cmpkppbnh0u0lqfw5350jraae/reports')).toBe('reports')
  })

  it('keeps the matching financial menu item active on company-scoped routes', () => {
    const pathname = '/en/admin/financial/cmpkppbnh0u0lqfw5350jraae/accounts'

    expect(isAdminNavHrefActive(pathname, '/admin/financial/accounts')).toBe(true)
    expect(isAdminNavHrefActive(pathname, '/admin/financial')).toBe(false)
    expect(isAdminNavHrefActive(pathname, '/admin/financial/reports')).toBe(false)
  })

  it('matches regular admin detail routes by prefix', () => {
    expect(isAdminNavHrefActive('/en/admin/companies/company-id', '/admin/companies')).toBe(true)
    expect(isAdminNavHrefActive('/en/admin/company-settings', '/admin/companies')).toBe(false)
  })
})
