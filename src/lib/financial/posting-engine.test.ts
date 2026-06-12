import { describe, expect, it } from 'vitest'
import { validatePostingLines } from './posting-engine'

const line = (debit: number, credit: number) => ({ accountId: 'a', debit, credit })

describe('posting line validation', () => {
  it('accepts a balanced two-line entry', () => {
    expect(validatePostingLines([line(100, 0), line(0, 100)])).toBeNull()
  })

  it('accepts multi-line balanced entries', () => {
    expect(validatePostingLines([line(60, 0), line(40, 0), line(0, 100)])).toBeNull()
  })

  it('rejects fewer than two lines', () => {
    expect(validatePostingLines([line(100, 0)])).toContain('两行')
  })

  it('rejects lines with both debit and credit', () => {
    expect(validatePostingLines([line(100, 50), line(0, 50)])).toContain('借方或贷方之一')
  })

  it('rejects empty lines', () => {
    expect(validatePostingLines([line(0, 0), line(0, 0)])).toContain('借方或贷方之一')
  })

  it('rejects negative amounts', () => {
    expect(validatePostingLines([line(-100, 0), line(0, -100)])).toContain('大于零')
  })

  it('rejects unbalanced entries', () => {
    expect(validatePostingLines([line(100, 0), line(0, 90)])).toContain('借贷不平')
  })

  it('tolerates sub-cent rounding noise', () => {
    expect(validatePostingLines([line(33.331, 0), line(33.331, 0), line(0, 66.66)])).toBeNull()
  })
})
