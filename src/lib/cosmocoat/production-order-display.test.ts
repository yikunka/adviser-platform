import { describe, expect, it } from 'vitest'
import { productionOrderItemDisplayCode } from './production-order-display'

describe('productionOrderItemDisplayCode', () => {
  it('uses component recipe name instead of recipe code for semifinished recipe rows', () => {
    expect(productionOrderItemDisplayCode({
      productionCode: 'RCP-001',
      materialName: '半成品清漆',
      componentRecipe: { id: 'recipe-1', code: 'RCP-001', name: '半成品清漆' },
      productSemifinished: null,
    })).toBe('半成品清漆')
  })

  it('uses semifinished product name instead of semifinished code for inventory rows', () => {
    expect(productionOrderItemDisplayCode({
      productionCode: 'SF-001',
      materialName: '库存半成品 A',
      componentRecipe: null,
      productSemifinished: { id: 'semi-1', code: 'SF-001', name: '库存半成品 A' },
    })).toBe('库存半成品 A')
  })

  it('keeps raw material production code unchanged', () => {
    expect(productionOrderItemDisplayCode({
      productionCode: 'AD-001',
      materialName: '助剂',
      componentRecipe: null,
      productSemifinished: null,
    })).toBe('AD-001')
  })
})
