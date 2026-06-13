import { describe, expect, it } from 'vitest'
import { employeeMatchesFiveElement } from '@/lib/cosmocoat/employee-filters'

describe('employeeMatchesFiveElement', () => {
  it('matches the selected five element', () => {
    expect(employeeMatchesFiveElement({
      birthInfo: {
        lunarYear: 2024,
        yearHeavenlyStem: '甲',
        yearEarthlyBranch: '辰',
        sexagenaryYear: '甲辰',
        dayHeavenlyStem: '甲',
        dayEarthlyBranch: '辰',
        sexagenaryDay: '甲辰',
        dayMaster: '甲',
        fiveElement: '木',
        zodiac: '龙',
      },
    }, '木')).toBe(true)
  })

  it('rejects other five elements and employees without birth info', () => {
    expect(employeeMatchesFiveElement({ birthInfo: null }, '火')).toBe(false)
    expect(employeeMatchesFiveElement({
      birthInfo: {
        lunarYear: 2023,
        yearHeavenlyStem: '癸',
        yearEarthlyBranch: '卯',
        sexagenaryYear: '癸卯',
        dayHeavenlyStem: '癸',
        dayEarthlyBranch: '卯',
        sexagenaryDay: '癸卯',
        dayMaster: '癸',
        fiveElement: '水',
        zodiac: '兔',
      },
    }, '金')).toBe(false)
  })

  it('treats an empty filter as match-all', () => {
    expect(employeeMatchesFiveElement({ birthInfo: null }, '')).toBe(true)
    expect(employeeMatchesFiveElement({ birthInfo: null }, null)).toBe(true)
    expect(employeeMatchesFiveElement({ birthInfo: null }, undefined)).toBe(true)
  })
})
