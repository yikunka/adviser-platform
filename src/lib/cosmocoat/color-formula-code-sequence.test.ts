import { describe, expect, it } from 'vitest'
import {
  COLOR_FORMULA_NEW_SEQUENCE_START,
  computeNextColorFormulaCodeForProduct,
  maxColorFormulaSuffixForProduct,
} from './color-formula-code-sequence'

describe('color formula code sequence', () => {
  const productCode = 'CCPU001'

  it('starts new formulas at 5001 when no formulas exist', () => {
    expect(computeNextColorFormulaCodeForProduct(productCode, [])).toBe('CCPU001-5001')
  })

  it('ignores legacy suffixes below 5001 when computing the next code', () => {
    const codes = ['CCPU001-0001', 'CCPU001-0042', 'CCPU001-1234']
    expect(computeNextColorFormulaCodeForProduct(productCode, codes)).toBe('CCPU001-5001')
  })

  it('increments within the 5001+ sequence', () => {
    const codes = ['CCPU001-0003', 'CCPU001-5001', 'CCPU001-5005']
    expect(computeNextColorFormulaCodeForProduct(productCode, codes)).toBe('CCPU001-5006')
  })

  it('ignores codes from other products or non-numeric suffixes', () => {
    const codes = ['CCPU002-5009', 'CCPU001-ABCD', `${productCode}-5002`]
    expect(maxColorFormulaSuffixForProduct(productCode, codes)).toBe(5002)
    expect(computeNextColorFormulaCodeForProduct(productCode, codes)).toBe('CCPU001-5003')
  })

  it('uses the configured new-sequence start constant', () => {
    expect(COLOR_FORMULA_NEW_SEQUENCE_START).toBe(5001)
  })
})
