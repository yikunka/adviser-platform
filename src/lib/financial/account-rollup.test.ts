import { describe, expect, it } from 'vitest'
import { serializeAccountsWithRollups, type AccountRollupInput } from './account-rollup'

function account(input: Partial<AccountRollupInput> & Pick<AccountRollupInput, 'id' | 'code' | 'name' | 'parentId' | 'level'>): AccountRollupInput {
  return {
    type: 'ASSET',
    companyId: 'company-1',
    sortOrder: 0,
    isSystem: false,
    notes: '',
    yearToDateDebit: 0,
    yearToDateCredit: 0,
    accountBalances: [],
    ...input,
  }
}

describe('serializeAccountsWithRollups', () => {
  it('rolls opening balances and year-to-date movements from descendants into parents', () => {
    const rows = serializeAccountsWithRollups([
      account({ id: 'parent', code: '1000', name: '资产', parentId: null, level: 1, yearToDateDebit: 999 }),
      account({
        id: 'cash',
        code: '1001',
        name: '现金',
        parentId: 'parent',
        level: 2,
        yearToDateDebit: 100,
        yearToDateCredit: 10,
        accountBalances: [{ period: '2026-01', openingDebit: 500, openingCredit: 0 }],
      }),
      account({
        id: 'bank',
        code: '1002',
        name: '银行',
        parentId: 'parent',
        level: 2,
        yearToDateDebit: 40,
        yearToDateCredit: 5,
        accountBalances: [{ period: '2026-01', openingDebit: 250, openingCredit: 0 }],
      }),
    ])

    const parent = rows.find(row => row.id === 'parent')!
    expect(parent.openingBalance).toBe(0)
    expect(parent.openingBalanceTotal).toBe(750)
    expect(parent.openingDebitTotal).toBe(750)
    expect(parent.yearToDateDebit).toBe(999)
    expect(parent.yearToDateDebitTotal).toBe(140)
    expect(parent.yearToDateCreditTotal).toBe(15)
    expect(parent.yearToDateBalanceTotal).toBe(125)
  })

  it('rolls credit-normal child balances with the correct sign', () => {
    const rows = serializeAccountsWithRollups([
      account({ id: 'parent', code: '2000', name: '负债', type: 'LIABILITY', parentId: null, level: 1 }),
      account({
        id: 'loan',
        code: '2001',
        name: '借款',
        type: 'LIABILITY',
        parentId: 'parent',
        level: 2,
        yearToDateDebit: 20,
        yearToDateCredit: 120,
        accountBalances: [{ period: '2026-01', openingDebit: 0, openingCredit: 300 }],
      }),
    ])

    const parent = rows.find(row => row.id === 'parent')!
    expect(parent.openingCreditTotal).toBe(300)
    expect(parent.openingBalanceTotal).toBe(300)
    expect(parent.yearToDateBalanceTotal).toBe(100)
  })
})
