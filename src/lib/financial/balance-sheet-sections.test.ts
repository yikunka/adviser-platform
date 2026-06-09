import { describe, expect, it } from 'vitest'
import {
  buildBalanceSheetSections,
  isCurrentAssetAccount,
  isCurrentLiabilityAccount,
  isNonCurrentAssetAccount,
  isNonCurrentLiabilityAccount,
} from './balance-sheet-sections'

describe('balance sheet HKFRS sections', () => {
  it('classifies cash and inventory as current assets and fixed assets as non-current', () => {
    expect(isCurrentAssetAccount({ code: '1001', type: 'ASSET', name: '现金' })).toBe(true)
    expect(isCurrentAssetAccount({ code: '1200', type: 'ASSET', name: '存货' })).toBe(true)
    expect(isNonCurrentAssetAccount({ code: '1300', type: 'ASSET', name: '固定资产' })).toBe(true)
  })

  it('classifies trade payables, tax payable and bank loans into current and non-current liabilities', () => {
    // 20xx, 21xx, 22xx, 23xx, 24xx → current liabilities (trade payables, accruals, tax payable)
    expect(isCurrentLiabilityAccount({ code: '2001', type: 'LIABILITY' })).toBe(true)
    expect(isCurrentLiabilityAccount({ code: '2201', type: 'LIABILITY' })).toBe(true) // 应付账款 → current
    expect(isCurrentLiabilityAccount({ code: '2211', type: 'LIABILITY' })).toBe(true) // 应交税费 → current
    expect(isCurrentLiabilityAccount({ code: '2300', type: 'LIABILITY' })).toBe(true)
    // 25xx–29xx → non-current liabilities (long-term borrowings)
    expect(isNonCurrentLiabilityAccount({ code: '2500', type: 'LIABILITY' })).toBe(true) // 长期借款 → non-current
    expect(isNonCurrentLiabilityAccount({ code: '2600', type: 'LIABILITY' })).toBe(true)
    // 22xx is NOT non-current
    expect(isNonCurrentLiabilityAccount({ code: '2200', type: 'LIABILITY' })).toBe(false)
    expect(isNonCurrentLiabilityAccount({ code: '2201', type: 'LIABILITY' })).toBe(false)
  })

  it('builds ordered HKFRS sections with subtotals', () => {
    const level1Map = new Map([
      ['a1', 'a1'],
      ['a2', 'a1'],
      ['b1', 'b1'],
      ['b2', 'b1'],
      ['l1', 'l1'],
      ['l2', 'l1'],
      ['e1', 'e1'],
    ])

    const layout = buildBalanceSheetSections({
      assetLines: [
        { accountId: 'a1', code: '1300', name: '固定资产', type: 'ASSET', level: 1, amount: 500 },
        { accountId: 'a2', code: '1301', name: '厂房', type: 'ASSET', level: 2, amount: 500 },
        { accountId: 'b1', code: '1000', name: '流动资产', type: 'ASSET', level: 1, amount: 100 },
        { accountId: 'b2', code: '1001', name: '现金', type: 'ASSET', level: 2, amount: 100 },
      ],
      liabilityLines: [
        { accountId: 'l1', code: '2500', name: '长期借款', type: 'LIABILITY', level: 1, amount: 300 },
        { accountId: 'l2', code: '2001', name: '应付账款', type: 'LIABILITY', level: 2, amount: 50 },
      ],
      equityLines: [
        { accountId: 'e1', code: '3001', name: '实收资本', type: 'EQUITY', level: 1, amount: 250 },
      ],
      level1AccountIdByReportAccountId: level1Map,
    })

    expect(layout.assetSections.map(section => section.label)).toEqual(['非流动资产', '流动资产'])
    expect(layout.liabilitySections.map(section => section.label)).toEqual(['非流动负债', '流动负债'])
    expect(layout.equitySection.label).toBe('所有者权益')
    expect(layout.totalAssets).toBe(600)
    expect(layout.totalLiabilities).toBe(300)
    expect(layout.totalEquity).toBe(250)
    expect(layout.assetSections[0]?.lines[0]?.children?.map(child => child.code)).toEqual(['1301'])
  })
})
