import { describe, expect, it } from 'vitest'
import {
  TCSP_CUSTOMER_LEVELS,
  TCSP_JURISDICTIONS,
  normalizeTcspCustomerLevel,
  normalizeTcspJurisdiction,
  normalizeTcspServiceContent,
} from './tcsp-pricing'

describe('TCSP pricing dimensions', () => {
  it('supports the required jurisdictions and customer levels', () => {
    expect(TCSP_JURISDICTIONS.map(item => item.value)).toEqual(['HK', 'BVI', 'CAYMAN', 'MARSHALL'])
    expect(TCSP_CUSTOMER_LEVELS.map(item => item.value)).toEqual(['DISTRIBUTOR', 'STANDARD'])
  })

  it('normalizes unknown dimensions to default selectable values', () => {
    expect(normalizeTcspJurisdiction('cayman')).toBe('CAYMAN')
    expect(normalizeTcspJurisdiction('unknown')).toBe('HK')
    expect(normalizeTcspCustomerLevel('distributor')).toBe('DISTRIBUTOR')
    expect(normalizeTcspCustomerLevel('vip')).toBe('STANDARD')
  })

  it('keeps free-text service content as the unique service descriptor', () => {
    expect(normalizeTcspServiceContent('  Company incorporation - HK  ')).toBe('Company incorporation - HK')
    expect(normalizeTcspServiceContent('')).toBeNull()
  })
})
