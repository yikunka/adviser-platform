import { describe, expect, it } from 'vitest'
import { buildPartyStatement } from './party-statement'

describe('party statement', () => {
  it('orders by date and keeps running balance', () => {
    const { rows, closingBalance, totalCharged, totalSettled } = buildPartyStatement([
      {
        date: new Date('2026-06-05T00:00:00.000Z'),
        type: 'RECEIPT',
        docNo: 'RCT-1',
        description: '收款',
        charge: 0,
        settle: 300,
      },
      {
        date: new Date('2026-06-01T00:00:00.000Z'),
        type: 'SALES_INVOICE',
        docNo: 'INV-1',
        description: '发票',
        charge: 1000,
        settle: 0,
      },
      {
        date: new Date('2026-06-08T00:00:00.000Z'),
        type: 'CREDIT_NOTE',
        docNo: 'CN-1',
        description: '贷项',
        charge: 0,
        settle: 100,
      },
    ])

    expect(rows.map(row => row.docNo)).toEqual(['INV-1', 'RCT-1', 'CN-1'])
    expect(rows.map(row => row.balance)).toEqual([1000, 700, 600])
    expect(closingBalance).toBe(600)
    expect(totalCharged).toBe(1000)
    expect(totalSettled).toBe(400)
  })

  it('breaks date ties by doc number', () => {
    const sameDay = new Date('2026-06-01T00:00:00.000Z')
    const { rows } = buildPartyStatement([
      { date: sameDay, type: 'RECEIPT', docNo: 'RCT-2', description: '', charge: 0, settle: 10 },
      { date: sameDay, type: 'SALES_INVOICE', docNo: 'INV-1', description: '', charge: 100, settle: 0 },
    ])
    expect(rows[0]!.docNo).toBe('INV-1')
    expect(rows[1]!.balance).toBe(90)
  })
})
