import { describe, expect, it } from 'vitest'
import {
  COLOR_FORMULA_CATEGORIES,
  colorFormulaCategoryLabel,
  factoryProductMatchesColorFormulaCategory,
  inferCategoryFromProductCategory,
  isColorFormulaCategory,
} from './color-formula-categories'

describe('color formula categories', () => {
  it('exposes the simplified three user-facing categories', () => {
    expect(COLOR_FORMULA_CATEGORIES.map(category => category.value)).toEqual([
      'PU',
      'BAKING_PAINT',
      'HT_BAKING_PAINT',
    ])
    expect(COLOR_FORMULA_CATEGORIES.map(category => category.labelZh)).toEqual([
      'PU',
      '色漆',
      '烤漆',
    ])
  })

  it('keeps legacy category identifiers readable', () => {
    expect(isColorFormulaCategory('LT_BAKING_PAINT')).toBe(true)
    expect(colorFormulaCategoryLabel('LT_BAKING_PAINT')).toBe('烤漆')
  })

  it('infers color paint and baking paint without creating new legacy LT categories', () => {
    expect(inferCategoryFromProductCategory({ name: 'PU漆', slug: 'pu-lacquer' })).toBe('PU')
    expect(inferCategoryFromProductCategory({ name: '色漆/烤漆', slug: 'lacquer' })).toBe('BAKING_PAINT')
    expect(inferCategoryFromProductCategory({ name: '高温烤漆', slug: 'ht-baking' })).toBe('HT_BAKING_PAINT')
    expect(inferCategoryFromProductCategory({ name: '低温烤漆', slug: 'lt-baking' })).toBe('HT_BAKING_PAINT')
  })

  it('filters PU tab to factory products in PU漆 category only', () => {
    expect(factoryProductMatchesColorFormulaCategory({ name: 'PU漆' }, 'PU')).toBe(true)
    expect(factoryProductMatchesColorFormulaCategory({ name: 'PU底漆', slug: 'pu-primer' }, 'PU')).toBe(false)
    expect(factoryProductMatchesColorFormulaCategory({ name: '色漆/烤漆', slug: 'lacquer' }, 'BAKING_PAINT')).toBe(true)
  })
})
