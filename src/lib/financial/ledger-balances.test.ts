import { describe, expect, it } from 'vitest'
import {
  addLedgerMovementsToOpeningBalances,
  calculateLedgerRunningBalances,
  signedOpeningBalance,
  type LedgerBalanceAccount,
} from './ledger-balances'

describe('ledger balance calculations', () => {
  const liability: LedgerBalanceAccount = {
    id: 'liability',
    type: 'LIABILITY',
    code: '22020022',
  }
  const accountsById = new Map([[liability.id, liability]])

  const currentAccount: LedgerBalanceAccount = {
    id: 'current-account-payable',
    type: 'CURRENT_ACCOUNT',
    code: '22020086',
  }

  it('calculates credit-normal opening balances from credit minus debit', () => {
    expect(signedOpeningBalance({
      accountId: liability.id,
      openingDebit: 0,
      openingCredit: 1000,
    }, liability)).toBe(1000)
  })

  it('adds prior movements to the opening balance without using stored ledger snapshots', () => {
    const openingBalances = new Map([[liability.id, 1000]])
    const balances = addLedgerMovementsToOpeningBalances(openingBalances, [
      { accountId: liability.id, debit: 0, credit: 500 },
      { accountId: liability.id, debit: 100, credit: 0 },
    ], accountsById)

    expect(balances.get(liability.id)).toBe(1400)
  })

  it('recalculates displayed running balances from opening plus current debit and credit movements', () => {
    const openingBalances = new Map([[liability.id, 1500]])
    const entries = calculateLedgerRunningBalances([
      { accountId: liability.id, debit: 200, credit: 0, balance: 999999 },
      { accountId: liability.id, debit: 0, credit: 50, balance: 999999 },
    ], accountsById, openingBalances)

    expect(entries.map(entry => entry.calculatedBalance)).toEqual([1300, 1350])
  })

  it('keeps current-account credit balances negative and normalizes offsetting vouchers to zero', () => {
    const entries = calculateLedgerRunningBalances([
      { accountId: currentAccount.id, debit: 0, credit: 1250, voucherNo: 'JE20260531111' },
      { accountId: currentAccount.id, debit: 1250.004, credit: 0, voucherNo: 'JE20260531160' },
    ], new Map([[currentAccount.id, currentAccount]]), new Map())

    expect(entries.map(entry => entry.calculatedBalance)).toEqual([-1250, 0])
    expect(Object.is(entries[1].calculatedBalance, -0)).toBe(false)
  })
})
