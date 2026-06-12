import { describe, expect, it } from 'vitest'
import { resolveCosEmployeeBirthInfo } from '@/lib/cosmocoat/employee-birth-info'

describe('resolveCosEmployeeBirthInfo', () => {
  it('uses the Chinese lunar year boundary for zodiac and element', () => {
    expect(resolveCosEmployeeBirthInfo('2024-02-09')).toMatchObject({
      lunarYear: 2023,
      sexagenaryYear: '癸卯',
      fiveElement: '水',
      zodiac: '兔',
    })

    expect(resolveCosEmployeeBirthInfo('2024-02-10')).toMatchObject({
      lunarYear: 2024,
      sexagenaryYear: '甲辰',
      fiveElement: '木',
      zodiac: '龙',
    })
  })

  it('handles earlier lunar-year rollover dates', () => {
    expect(resolveCosEmployeeBirthInfo('1990-01-26')).toMatchObject({
      lunarYear: 1989,
      sexagenaryYear: '己巳',
      fiveElement: '土',
      zodiac: '蛇',
    })

    expect(resolveCosEmployeeBirthInfo('1990-01-27')).toMatchObject({
      lunarYear: 1990,
      sexagenaryYear: '庚午',
      fiveElement: '金',
      zodiac: '马',
    })
  })

  it('returns null for empty or invalid dates', () => {
    expect(resolveCosEmployeeBirthInfo(null)).toBeNull()
    expect(resolveCosEmployeeBirthInfo('2024-02-31')).toBeNull()
    expect(resolveCosEmployeeBirthInfo('not-a-date')).toBeNull()
  })
})
