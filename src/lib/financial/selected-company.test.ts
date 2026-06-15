import { describe, expect, it } from 'vitest'
import { resolveStoredFinancialCompanyId } from './selected-company'

const companies = [
  { id: 'company-a', nameEn: 'Alpha', companyCode: 'AA001' },
  { id: 'company-b', nameEn: 'Beta', companyCode: 'BB001' },
]

describe('resolveStoredFinancialCompanyId', () => {
  it('keeps a stored company when it still exists in scope', () => {
    expect(resolveStoredFinancialCompanyId(companies, 'company-a')).toBe('company-a')
  })

  it('clears a missing stored company id', () => {
    expect(resolveStoredFinancialCompanyId(companies, 'company-missing')).toBe('')
  })

  it('clears empty stored values', () => {
    expect(resolveStoredFinancialCompanyId(companies, '')).toBe('')
    expect(resolveStoredFinancialCompanyId(companies, null)).toBe('')
    expect(resolveStoredFinancialCompanyId(companies, undefined)).toBe('')
  })
})
