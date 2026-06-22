import { describe, expect, it } from 'vitest'
import { buildFactoryProductLabelDraft } from './factory-product-label'

describe('buildFactoryProductLabelDraft', () => {
  it('uses product master data as editable thermal label defaults', () => {
    expect(buildFactoryProductLabelDraft({
      productCode: 'FP001',
      name: 'Clear Coat',
      unit: 'kg',
      category: { name: 'PU漆' },
      viscosityLabel: '12 S',
      currentRecipe: { code: 'R001', name: 'Recipe 1' },
    })).toEqual({
      title: 'FP001',
      productName: 'Clear Coat',
      category: 'PU漆',
      unit: 'kg',
      viscosity: '12 S',
      currentRecipe: 'R001 Recipe 1',
    })
  })
})
