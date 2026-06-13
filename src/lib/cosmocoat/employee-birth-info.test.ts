import { describe, expect, it } from 'vitest'
import { resolveCosEmployeeBirthInfo } from '@/lib/cosmocoat/employee-birth-info'

describe('resolveCosEmployeeBirthInfo', () => {
  it('keeps zodiac on the Chinese lunar year boundary while deriving five element from the day master', () => {
    expect(resolveCosEmployeeBirthInfo('2024-02-09')).toMatchObject({
      lunarYear: 2023,
      sexagenaryYear: '癸卯',
      sexagenaryDay: '癸卯',
      dayMaster: '癸',
      fiveElement: '水',
      zodiac: '兔',
    })

    expect(resolveCosEmployeeBirthInfo('2024-02-10')).toMatchObject({
      lunarYear: 2024,
      sexagenaryYear: '甲辰',
      sexagenaryDay: '甲辰',
      dayMaster: '甲',
      fiveElement: '木',
      zodiac: '龙',
    })
  })

  it('changes the five element based on the day stem rather than the year stem', () => {
    expect(resolveCosEmployeeBirthInfo('1990-01-26')).toMatchObject({
      lunarYear: 1989,
      sexagenaryYear: '己巳',
      sexagenaryDay: '辛卯',
      dayMaster: '辛',
      fiveElement: '金',
      zodiac: '蛇',
    })

    expect(resolveCosEmployeeBirthInfo('1990-01-27')).toMatchObject({
      lunarYear: 1990,
      sexagenaryYear: '庚午',
      sexagenaryDay: '壬辰',
      dayMaster: '壬',
      fiveElement: '水',
      zodiac: '马',
    })
  })

  it('matches a known JiaZi day in the sexagenary cycle', () => {
    expect(resolveCosEmployeeBirthInfo('2019-01-27')).toMatchObject({
      sexagenaryDay: '甲子',
      dayMaster: '甲',
      fiveElement: '木',
    })
  })

  it('returns null for empty or invalid dates', () => {
    expect(resolveCosEmployeeBirthInfo(null)).toBeNull()
    expect(resolveCosEmployeeBirthInfo('2024-02-31')).toBeNull()
    expect(resolveCosEmployeeBirthInfo('not-a-date')).toBeNull()
  })
})
