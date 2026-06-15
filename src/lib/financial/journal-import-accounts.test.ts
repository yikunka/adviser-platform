import { describe, expect, it } from 'vitest'
import { inferImportedAccountRoot, nextImportedAccountCode, nextImportedTopLevelCode } from './journal-import-accounts'

describe('journal import account helpers', () => {
  it('reuses dotted child account numbering for auto-created import accounts', () => {
    expect(nextImportedAccountCode('05', ['05.001', '05.002'])).toBe('05.003')
  })

  it('allocates a fallback top-level code when no parent root exists', () => {
    expect(nextImportedTopLevelCode(['IMP-0001', 'IMP-0002'])).toBe('IMP-0003')
  })

  it('infers revenue roots from account names', () => {
    expect(inferImportedAccountRoot('Consulting Income', 0, 1200)).toEqual({
      rootCode: '05',
      type: 'REVENUE',
    })
  })

  it('infers receivable roots from bilingual account names', () => {
    expect(inferImportedAccountRoot('其他应收款', 500, 0)).toEqual({
      rootCode: '02',
      type: 'ASSET',
    })
  })

  it('falls back to expense for unmatched debit-side accounts', () => {
    expect(inferImportedAccountRoot('Unclassified Misc', 300, 0)).toEqual({
      rootCode: '07',
      type: 'EXPENSE',
    })
  })
})
