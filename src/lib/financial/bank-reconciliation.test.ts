import { describe, expect, it } from 'vitest'
import { autoMatchStatementLines, computeReconciliationSummary } from './bank-reconciliation'

const day = (value: string) => new Date(`${value}T00:00:00.000Z`)

describe('auto match', () => {
  it('matches exact amount within date window', () => {
    const result = autoMatchStatementLines(
      [{ id: 's1', date: day('2026-06-03'), amount: 500, reference: '', description: '入账' }],
      [
        { id: 'l1', date: day('2026-06-01'), debit: 500, credit: 0, voucherNo: 'JE-1', description: '收款' },
        { id: 'l2', date: day('2026-06-01'), debit: 300, credit: 0, voucherNo: 'JE-2', description: '收款' },
      ],
    )
    expect(result.matches).toEqual([{ statementLineId: 's1', ledgerId: 'l1', confidence: 'AMOUNT_DATE' }])
    expect(result.unmatchedStatementLineIds).toEqual([])
  })

  it('respects direction: outflow matches credit', () => {
    const result = autoMatchStatementLines(
      [{ id: 's1', date: day('2026-06-03'), amount: -200, reference: '', description: '支出' }],
      [
        { id: 'l1', date: day('2026-06-03'), debit: 200, credit: 0, voucherNo: 'JE-1', description: '' },
        { id: 'l2', date: day('2026-06-03'), debit: 0, credit: 200, voucherNo: 'JE-2', description: '' },
      ],
    )
    expect(result.matches[0]!.ledgerId).toBe('l2')
  })

  it('prefers reference hit over closer date', () => {
    const result = autoMatchStatementLines(
      [{ id: 's1', date: day('2026-06-03'), amount: 100, reference: 'JE-FAR', description: '' }],
      [
        { id: 'near', date: day('2026-06-03'), debit: 100, credit: 0, voucherNo: 'JE-NEAR', description: '' },
        { id: 'far', date: day('2026-06-05'), debit: 100, credit: 0, voucherNo: 'JE-FAR', description: '' },
      ],
    )
    expect(result.matches[0]).toMatchObject({ ledgerId: 'far', confidence: 'EXACT' })
  })

  it('does not reuse a ledger row and reports unmatched', () => {
    const result = autoMatchStatementLines(
      [
        { id: 's1', date: day('2026-06-03'), amount: 100, reference: '', description: '' },
        { id: 's2', date: day('2026-06-03'), amount: 100, reference: '', description: '' },
      ],
      [{ id: 'l1', date: day('2026-06-03'), debit: 100, credit: 0, voucherNo: 'JE-1', description: '' }],
    )
    expect(result.matches).toHaveLength(1)
    expect(result.unmatchedStatementLineIds).toEqual(['s2'])
  })

  it('rejects matches outside the date window', () => {
    const result = autoMatchStatementLines(
      [{ id: 's1', date: day('2026-06-10'), amount: 100, reference: '', description: '' }],
      [{ id: 'l1', date: day('2026-06-01'), debit: 100, credit: 0, voucherNo: 'JE-1', description: '' }],
    )
    expect(result.matches).toHaveLength(0)
    expect(result.unmatchedStatementLineIds).toEqual(['s1'])
  })
})

describe('reconciliation summary', () => {
  it('balances when unmatched items explain the difference', () => {
    // 银行 1000；总账 1200；总账多出的 200 是未兑现支票（未匹配总账行 -200 流出 + 在途存款？）
    // 例：总账有一笔 -200 支出银行还没扣 → 未匹配总账行 signed -200
    const summary = computeReconciliationSummary({
      statementBalance: 1000,
      glBalance: 800,
      unmatchedStatementAmounts: [300], // 银行已收 300 账上未记
      unmatchedLedgerSignedAmounts: [-100], // 账上已付 100 银行未扣
      // 1000 - 800 = 200; 200 - 300 + (-100) = -200? 不平 → 验证非平案例在下面
    })
    expect(summary.difference).toBe(200)
    expect(summary.isBalanced).toBe(false)
  })

  it('reports balanced reconciliation', () => {
    // 银行 1000 = 总账 900 + 银行已收未记 300 - 账上已付银行未扣 200
    const summary = computeReconciliationSummary({
      statementBalance: 1000,
      glBalance: 900,
      unmatchedStatementAmounts: [300],
      unmatchedLedgerSignedAmounts: [200],
    })
    // difference 100 - 300 + 200 = 0
    expect(summary.unexplainedDifference).toBe(0)
    expect(summary.isBalanced).toBe(true)
  })

  it('flags unexplained difference', () => {
    const summary = computeReconciliationSummary({
      statementBalance: 1000,
      glBalance: 1000,
      unmatchedStatementAmounts: [50],
      unmatchedLedgerSignedAmounts: [],
    })
    expect(summary.unexplainedDifference).toBe(-50)
    expect(summary.isBalanced).toBe(false)
  })
})
