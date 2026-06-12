import { describe, expect, it } from 'vitest'
import { docPeriodKey, formatDocNo, nextDocNo } from './doc-numbers'

function fakeSequenceClient(initial = 0) {
  let lastNumber = initial
  return {
    upserts: 0,
    docSequence: {
      async upsert() {
        return {}
      },
      async update() {
        lastNumber += 1
        return { lastNumber }
      },
    },
  }
}

describe('doc numbers', () => {
  it('builds period key from UTC date', () => {
    expect(docPeriodKey(new Date('2026-06-12T00:00:00.000Z'))).toBe('202606')
    expect(docPeriodKey(new Date('2026-01-31T23:59:59.000Z'))).toBe('202601')
  })

  it('formats document numbers with prefix and padding', () => {
    expect(formatDocNo('SALES_INVOICE', '202606', 1)).toBe('INV-202606-0001')
    expect(formatDocNo('RECEIPT', '202606', 42)).toBe('RCT-202606-0042')
    expect(formatDocNo('PURCHASE_BILL', '202612', 1234)).toBe('BILL-202612-1234')
    expect(formatDocNo('BILL_PAYMENT', '202606', 7)).toBe('PAY-202606-0007')
    expect(formatDocNo('CREDIT_NOTE', '202606', 3)).toBe('CN-202606-0003')
  })

  it('increments per call', async () => {
    const client = fakeSequenceClient()
    const date = new Date('2026-06-12T00:00:00.000Z')
    expect(await nextDocNo(client, { companyId: 'c1', docType: 'SALES_INVOICE', date })).toBe('INV-202606-0001')
    expect(await nextDocNo(client, { companyId: 'c1', docType: 'SALES_INVOICE', date })).toBe('INV-202606-0002')
  })
})
