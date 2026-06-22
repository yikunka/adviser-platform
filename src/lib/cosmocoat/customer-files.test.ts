import { describe, expect, it } from 'vitest'
import { normalizeCosCustomerFileKind } from './customer-files'

describe('normalizeCosCustomerFileKind', () => {
  it('accepts supported independent customer file modules', () => {
    expect(normalizeCosCustomerFileKind('LEGAL_REP_ID')).toBe('LEGAL_REP_ID')
    expect(normalizeCosCustomerFileKind('TIANYANCHA_REPORT')).toBe('TIANYANCHA_REPORT')
    expect(normalizeCosCustomerFileKind('OTHER')).toBe('OTHER')
  })

  it('falls back to business license for empty or unsupported values', () => {
    expect(normalizeCosCustomerFileKind('')).toBe('BUSINESS_LICENSE')
    expect(normalizeCosCustomerFileKind('NOPE')).toBe('BUSINESS_LICENSE')
  })
})
