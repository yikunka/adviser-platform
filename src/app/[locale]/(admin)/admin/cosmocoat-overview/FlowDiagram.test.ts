import { describe, expect, it } from 'vitest'
import { findMatchingRawMaterialIds, getForwardImpactChain } from './FlowDiagram'

describe('CosmoCoat overview material search', () => {
  it('matches raw materials by code or name', () => {
    const matches = findMatchingRawMaterialIds([
      { id: 'raw-1', code: 'RM001', name: 'Acrylic Resin' },
      { id: 'raw-2', code: 'RM002', name: '消光粉' },
      { id: 'raw-3', code: 'SOL001', name: 'Solvent' },
    ], '消光')

    expect(Array.from(matches)).toEqual(['raw-2'])
    expect(Array.from(findMatchingRawMaterialIds([
      { id: 'raw-1', code: 'RM001', name: 'Acrylic Resin' },
    ], 'rm001'))).toEqual(['raw-1'])
  })

  it('traces the downstream impact path from matching raw materials', () => {
    const chain = getForwardImpactChain(['raw-1'], [
      { from: 'raw-1', to: 'recipe-1', color: '#fff', key: 'raw-1::recipe-1' },
      { from: 'recipe-1', to: 'semi-1', color: '#fff', key: 'recipe-1::semi-1' },
      { from: 'semi-1', to: 'recipe-2', color: '#fff', key: 'semi-1::recipe-2' },
      { from: 'recipe-2', to: 'product-1', color: '#fff', key: 'recipe-2::product-1' },
      { from: 'product-1', to: 'formula-1', color: '#fff', key: 'product-1::formula-1' },
      { from: 'product-1', to: 'kit-1', color: '#fff', key: 'product-1::kit-1' },
      { from: 'recipe-upstream', to: 'raw-1', color: '#fff', key: 'recipe-upstream::raw-1' },
    ])

    expect(Array.from(chain.chainNodes).sort()).toEqual([
      'formula-1',
      'kit-1',
      'product-1',
      'raw-1',
      'recipe-1',
      'recipe-2',
      'semi-1',
    ])
    expect(chain.chainEdges.has('recipe-upstream::raw-1')).toBe(false)
  })
})
