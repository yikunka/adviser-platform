import { describe, expect, it } from 'vitest'
import { normalizeCosSupplierFileKind } from './supplier-files'

describe('normalizeCosSupplierFileKind', () => {
  it('accepts dedicated supplier file modules', () => {
    expect(normalizeCosSupplierFileKind('BUSINESS_LICENSE')).toBe('BUSINESS_LICENSE')
    expect(normalizeCosSupplierFileKind('QUALITY_GUARANTEE')).toBe('QUALITY_GUARANTEE')
  })

  it('falls back to general files for empty or unsupported values', () => {
    expect(normalizeCosSupplierFileKind('')).toBe('GENERAL')
    expect(normalizeCosSupplierFileKind('OTHER')).toBe('GENERAL')
  })
})
