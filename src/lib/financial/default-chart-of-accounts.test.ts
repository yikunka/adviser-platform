import { describe, expect, it } from 'vitest'
import { DEFAULT_CHART_OF_ACCOUNTS } from './default-chart-of-accounts'

describe('default chart of accounts template', () => {
  it('seeds the requested 9 standard level-1 accounts in order', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map(account => account.code)
    expect(codes).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])

    expect(DEFAULT_CHART_OF_ACCOUNTS).toEqual([
      { code: '01', name: '现金与银行', type: 'ASSET', sortOrder: 1 },
      { code: '02', name: '应收', type: 'ASSET', sortOrder: 2 },
      { code: '03', name: '应付', type: 'LIABILITY', sortOrder: 3 },
      { code: '04', name: '权益', type: 'EQUITY', sortOrder: 4 },
      { code: '05', name: '收入', type: 'REVENUE', sortOrder: 5 },
      { code: '06', name: '成本', type: 'CGS', sortOrder: 6 },
      { code: '07', name: '行政费用', type: 'EXPENSE', sortOrder: 7 },
      { code: '08', name: '销售费用', type: 'EXPENSE', sortOrder: 8 },
      { code: '09', name: '财务费用', type: 'EXPENSE', sortOrder: 9 },
    ])
  })

  it('uses unique account codes', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map(account => account.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
