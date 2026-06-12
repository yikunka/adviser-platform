import { describe, expect, it } from 'vitest'
import { settlementProgress, validateAllocations } from './allocations'

describe('allocation validation', () => {
  it('accepts allocations within outstanding and source amount', () => {
    expect(
      validateAllocations({
        sourceAmount: 1000,
        allocations: [
          { label: 'INV-1', outstanding: 600, amount: 600 },
          { label: 'INV-2', outstanding: 500, amount: 400 },
        ],
      }),
    ).toBeNull()
  })

  it('rejects zero or negative allocation', () => {
    expect(
      validateAllocations({ sourceAmount: 100, allocations: [{ label: 'INV-1', outstanding: 100, amount: 0 }] }),
    ).toContain('大于零')
  })

  it('rejects allocation above invoice outstanding', () => {
    expect(
      validateAllocations({ sourceAmount: 1000, allocations: [{ label: 'INV-1', outstanding: 100, amount: 150 }] }),
    ).toContain('超过单据未结金额')
  })

  it('rejects total above available amount', () => {
    expect(
      validateAllocations({
        sourceAmount: 500,
        allocations: [
          { label: 'INV-1', outstanding: 400, amount: 400 },
          { label: 'INV-2', outstanding: 400, amount: 200 },
        ],
      }),
    ).toContain('超过可用金额')
  })

  it('respects already allocated amount', () => {
    expect(
      validateAllocations({
        sourceAmount: 500,
        alreadyAllocated: 450,
        allocations: [{ label: 'INV-1', outstanding: 100, amount: 100 }],
      }),
    ).toContain('超过可用金额')
  })

  it('tolerates sub-cent noise', () => {
    expect(
      validateAllocations({
        sourceAmount: 100,
        allocations: [{ label: 'INV-1', outstanding: 100.001, amount: 100.002 }],
      }),
    ).toBeNull()
  })
})

describe('settlement progress', () => {
  it('derives settlement states', () => {
    expect(settlementProgress(100, 0)).toEqual({ outstanding: 100, settled: 'NONE' })
    expect(settlementProgress(100, 40)).toEqual({ outstanding: 60, settled: 'PARTIAL' })
    expect(settlementProgress(100, 100)).toEqual({ outstanding: 0, settled: 'FULL' })
    expect(settlementProgress(100, 99.999)).toEqual({ outstanding: 0, settled: 'FULL' })
  })
})
