import { describe, expect, it } from 'vitest'
import {
  formatQcTestItemResults,
  hydrateQcTestItemResults,
  normalizeRecipeQcTestItems,
} from '@/lib/cosmocoat/recipe-qc-tests'
import { formatRecipeQcRequirements, parseRecipeQcRequirements } from '@/lib/cosmocoat/recipes'

describe('recipe QC tests', () => {
  it('supports matte test item results across recipe and production order QC text', () => {
    const selected = normalizeRecipeQcTestItems(['MATTE'])
    const result = formatQcTestItemResults({ MATTE: '35 GU' }, selected)

    expect(result).toBe('啞度: 35 GU')
    expect(hydrateQcTestItemResults(result, selected)).toEqual({ MATTE: '35 GU' })

    const orderText = formatRecipeQcRequirements('', result, { qcTestItems: selected })
    expect(parseRecipeQcRequirements(orderText)).toEqual({
      qcTestItems: ['MATTE'],
      qcTestStandard: '',
      qcResult: '啞度: 35 GU',
    })
  })
})
