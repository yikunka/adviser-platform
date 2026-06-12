import { describe, expect, it } from 'vitest'
import { validatePostingLines } from './posting-engine'
import {
  buildBillPaymentPosting,
  buildCustomerCreditNotePosting,
  buildPurchaseBillPosting,
  buildReceiptPosting,
  buildSalesInvoicePosting,
  buildSupplierDebitNotePosting,
} from './subledger-posting'

describe('sales invoice posting', () => {
  it('debits AR for total, credits revenue and output tax', () => {
    const lines = buildSalesInvoicePosting({
      arAccountId: 'ar',
      partyId: 'p1',
      description: 'INV-202606-0001',
      revenueLines: [
        { accountId: 'rev1', amount: 600 },
        { accountId: 'rev2', amount: 400 },
      ],
      taxAccountId: 'tax',
      taxAmount: 80,
      total: 1080,
    })
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatchObject({ accountId: 'ar', debit: 1080, credit: 0, partyId: 'p1' })
    expect(lines[1]).toMatchObject({ accountId: 'rev1', credit: 600 })
    expect(lines[2]).toMatchObject({ accountId: 'rev2', credit: 400 })
    expect(lines[3]).toMatchObject({ accountId: 'tax', credit: 80 })
    expect(validatePostingLines(lines)).toBeNull()
  })

  it('omits tax line when tax is zero', () => {
    const lines = buildSalesInvoicePosting({
      arAccountId: 'ar',
      partyId: 'p1',
      description: 'INV',
      revenueLines: [{ accountId: 'rev', amount: 100 }],
      taxAmount: 0,
      total: 100,
    })
    expect(lines).toHaveLength(2)
    expect(validatePostingLines(lines)).toBeNull()
  })
})

describe('receipt posting', () => {
  it('debits deposit account and credits AR with party', () => {
    const lines = buildReceiptPosting({
      depositAccountId: 'bank',
      arAccountId: 'ar',
      partyId: 'p1',
      amount: 500,
      description: 'RCT-202606-0001',
    })
    expect(lines[0]).toMatchObject({ accountId: 'bank', debit: 500 })
    expect(lines[1]).toMatchObject({ accountId: 'ar', credit: 500, partyId: 'p1' })
    expect(validatePostingLines(lines)).toBeNull()
  })
})

describe('purchase bill posting', () => {
  it('debits expenses and input tax, credits AP', () => {
    const lines = buildPurchaseBillPosting({
      apAccountId: 'ap',
      partyId: 's1',
      description: 'BILL-202606-0001',
      expenseLines: [{ accountId: 'exp', amount: 1000 }],
      taxAccountId: 'tax',
      taxAmount: 100,
      total: 1100,
    })
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ accountId: 'exp', debit: 1000 })
    expect(lines[1]).toMatchObject({ accountId: 'tax', debit: 100 })
    expect(lines[2]).toMatchObject({ accountId: 'ap', credit: 1100, partyId: 's1' })
    expect(validatePostingLines(lines)).toBeNull()
  })
})

describe('bill payment posting', () => {
  it('debits AP with party and credits deposit account', () => {
    const lines = buildBillPaymentPosting({
      depositAccountId: 'bank',
      apAccountId: 'ap',
      partyId: 's1',
      amount: 700,
      description: 'PAY-202606-0001',
    })
    expect(lines[0]).toMatchObject({ accountId: 'ap', debit: 700, partyId: 's1' })
    expect(lines[1]).toMatchObject({ accountId: 'bank', credit: 700 })
    expect(validatePostingLines(lines)).toBeNull()
  })
})

describe('credit / debit note posting', () => {
  it('customer credit note reverses revenue and AR', () => {
    const lines = buildCustomerCreditNotePosting({
      arAccountId: 'ar',
      offsetAccountId: 'rev',
      partyId: 'p1',
      description: 'CN-202606-0001',
      subtotal: 100,
      taxAccountId: 'tax',
      taxAmount: 10,
      total: 110,
    })
    expect(lines[0]).toMatchObject({ accountId: 'rev', debit: 100 })
    expect(lines[1]).toMatchObject({ accountId: 'tax', debit: 10 })
    expect(lines[2]).toMatchObject({ accountId: 'ar', credit: 110, partyId: 'p1' })
    expect(validatePostingLines(lines)).toBeNull()
  })

  it('supplier debit note reverses AP and expense', () => {
    const lines = buildSupplierDebitNotePosting({
      apAccountId: 'ap',
      offsetAccountId: 'exp',
      partyId: 's1',
      description: 'DN-202606-0001',
      subtotal: 200,
      taxAmount: 0,
      total: 200,
    })
    expect(lines[0]).toMatchObject({ accountId: 'ap', debit: 200, partyId: 's1' })
    expect(lines[1]).toMatchObject({ accountId: 'exp', credit: 200 })
    expect(validatePostingLines(lines)).toBeNull()
  })
})
