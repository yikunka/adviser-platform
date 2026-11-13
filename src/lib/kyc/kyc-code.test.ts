import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import { formatKycCode } from '@/lib/kyc/kyc-code'

describe('formatKycCode', () => {
  it('uses CL + 4 digits starting at 0000', () => {
    expect(formatKycCode(0)).toBe('CL0000')
    expect(formatKycCode(1)).toBe('CL0001')
    expect(formatKycCode(28)).toBe('CL0028')
    expect(formatKycCode(9999)).toBe('CL9999')
  })

  it('allows more than 4 digits when the sequence overflows', () => {
    expect(formatKycCode(10000)).toBe('CL10000')
  })
})
