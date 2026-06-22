import { describe, expect, it } from 'vitest'
import { calculateJournalAccountPickerBalances } from './journal-account-picker-balances'

describe('calculateJournalAccountPickerBalances', () => {
  it('uses the same rolled-up closing balance basis as the trial balance', () => {
    const balances = calculateJournalAccountPickerBalances({
      accounts: [
        {
          id: 'asset',
          code: '1000',
          name: 'Assets',
          type: 'ASSET',
          parentId: null,
          yearToDateAmount: 0,
          yearToDateDebit: 0,
          yearToDateCredit: 0,
        },
        {
          id: 'bank',
          code: '1001',
          name: 'Bank',
          type: 'ASSET',
          parentId: 'asset',
          yearToDateAmount: 0,
          yearToDateDebit: 0,
          yearToDateCredit: 0,
        },
        {
          id: 'revenue',
          code: '4001',
          name: 'Revenue',
          type: 'REVENUE',
          parentId: null,
          yearToDateAmount: 0,
          yearToDateDebit: 0,
          yearToDateCredit: 25,
        },
      ],
      movementTotalsByAccount: new Map([
        ['bank', { debit: 100, credit: 0 }],
        ['revenue', { debit: 0, credit: 200 }],
      ]),
      storedBalanceTotalsByAccount: new Map([
        ['bank', { debit: 50, credit: 0 }],
      ]),
    })

    expect(balances.get('asset')).toEqual({ balanceDebit: 150, balanceCredit: 0 })
    expect(balances.get('bank')).toEqual({ balanceDebit: 150, balanceCredit: 0 })
    expect(balances.get('revenue')).toEqual({ balanceDebit: 0, balanceCredit: 225 })
  })
})
