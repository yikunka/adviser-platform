import { describe, expect, it } from 'vitest'
import {
  isSemifinishedMaterialType,
  resolveColorFormulaMaterialOptionSources,
} from '@/lib/cosmocoat/color-formula-material-options'

describe('resolveColorFormulaMaterialOptionSources', () => {
  it('loads only semifinished inventory for the Sol tab', () => {
    expect(resolveColorFormulaMaterialOptionSources(['Sol'])).toEqual({
      rawTypes: [],
      includeRawMaterials: false,
      includeSemifinished: true,
    })
  })

  it('treats Sol matching as case-insensitive', () => {
    expect(isSemifinishedMaterialType(' SOL ')).toBe(true)
  })

  it('loads only raw materials for a raw-material attribute tab', () => {
    expect(resolveColorFormulaMaterialOptionSources(['AD'])).toEqual({
      rawTypes: ['AD'],
      includeRawMaterials: true,
      includeSemifinished: false,
    })
  })

  it('loads both sources when no explicit type is provided', () => {
    expect(resolveColorFormulaMaterialOptionSources([])).toEqual({
      rawTypes: [],
      includeRawMaterials: true,
      includeSemifinished: true,
    })
  })
})
