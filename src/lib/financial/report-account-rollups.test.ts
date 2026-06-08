import { describe, expect, it } from 'vitest'
import {
  buildLeafAccountIdsByAccount,
  buildYearToDateTotalsByAccount,
  type ReportRollupAccount,
} from './report-account-rollups'

function account(
  input: Partial<ReportRollupAccount> & Pick<ReportRollupAccount, 'id' | 'code' | 'name' | 'parentId' | 'type'>,
): ReportRollupAccount {
  return {
    yearToDateDebit: 0,
    yearToDateCredit: 0,
    ...input,
  }
}

describe('report account rollups', () => {
  it('aggregates leaf ledger ids for parent accounts', () => {
    const { leafIdsByAccount } = buildLeafAccountIdsByAccount([
      { id: 'parent', parentId: null },
      { id: 'child-a', parentId: 'parent' },
      { id: 'child-b', parentId: 'parent' },
    ])

    expect(leafIdsByAccount.get('parent')).toEqual(['child-a', 'child-b'])
    expect(leafIdsByAccount.get('child-a')).toEqual(['child-a'])
  })

  it('rolls year-to-date balances from descendants into parents', () => {
    const totals = buildYearToDateTotalsByAccount([
      account({ id: 'parent', code: '2000', name: '应付账款', type: 'LIABILITY', parentId: null }),
      account({
        id: 'child',
        code: '2001',
        name: '应付账款 ACCOUNTS PAYABLE',
        type: 'LIABILITY',
        parentId: 'parent',
        yearToDateDebit: 10,
        yearToDateCredit: 110,
      }),
    ])

    expect(totals.get('parent')).toEqual({ debit: 10, credit: 110, balance: 100 })
  })

  it('uses credit minus debit for current-year profit accounts', () => {
    const totals = buildYearToDateTotalsByAccount([
      account({
        id: 'profit',
        code: '3131',
        name: '本年利润',
        type: 'EQUITY',
        parentId: null,
        yearToDateDebit: 200,
        yearToDateCredit: 900,
      }),
    ])

    expect(totals.get('profit')).toEqual({ debit: 200, credit: 900, balance: 700 })
  })
})
