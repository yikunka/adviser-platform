import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {},
}))

import {
  resolveFactoryProductViscosity,
} from '@/lib/cosmocoat/factory-product-viscosity-sync'

describe('resolveFactoryProductViscosity', () => {
  it('uses current recipe viscosity when linked', () => {
    expect(
      resolveFactoryProductViscosity(
        { viscosity: '1.0', viscosityUnit: 'S' },
        { viscosity: '9.7-9.8', viscosityUnit: 'KU' },
      ),
    ).toEqual({
      viscosity: '9.7-9.8',
      viscosityUnit: 'KU',
    })
  })

  it('falls back to product viscosity without current recipe', () => {
    expect(
      resolveFactoryProductViscosity(
        { viscosity: '  12-14 ', viscosityUnit: 'S' },
        null,
      ),
    ).toEqual({
      viscosity: '12-14',
      viscosityUnit: 'S',
    })
  })

  it('clears viscosity when recipe has none', () => {
    expect(
      resolveFactoryProductViscosity(
        { viscosity: '9.0', viscosityUnit: 'S' },
        { viscosity: null, viscosityUnit: null },
      ),
    ).toEqual({
      viscosity: null,
      viscosityUnit: null,
    })
  })
})
