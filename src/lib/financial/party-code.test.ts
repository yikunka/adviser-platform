import { describe, expect, it } from 'vitest'
import { buildPartyCodePreview, nextPartyCode, partyCodePrefixForRole, resolvePartyCodeRole } from './party-code'

describe('party code role resolution', () => {
  it('uses customer priority when multiple roles are selected', () => {
    expect(resolvePartyCodeRole({ isCustomer: true, isSupplier: true, isEmployee: true })).toBe('customer')
    expect(partyCodePrefixForRole('customer')).toBe('CL')
  })

  it('falls back to supplier or employee when customer is not selected', () => {
    expect(resolvePartyCodeRole({ isSupplier: true, isEmployee: true })).toBe('supplier')
    expect(resolvePartyCodeRole({ isEmployee: true })).toBe('employee')
  })
})

describe('nextPartyCode', () => {
  it('starts each prefix sequence at 0001', () => {
    expect(nextPartyCode('CL', [])).toBe('CL-0001')
    expect(nextPartyCode('SP', ['CL-0007'])).toBe('SP-0001')
  })

  it('increments within the same prefix and ignores unrelated or malformed codes', () => {
    expect(nextPartyCode('ST', ['ST-0002', 'ST-0009', 'SP-0011', 'ST-ABCD'])).toBe('ST-0010')
  })
})

describe('buildPartyCodePreview', () => {
  it('returns a prefix hint based on the selected role', () => {
    expect(buildPartyCodePreview({ isCustomer: true })).toBe('CL-XXXX')
    expect(buildPartyCodePreview({ isSupplier: true })).toBe('SP-XXXX')
    expect(buildPartyCodePreview({ isEmployee: true })).toBe('ST-XXXX')
  })
})
