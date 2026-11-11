import { describe, expect, it } from 'vitest'
import { scoreJurisdiction } from '@/lib/aml/fatfJurisdictionMatch'

const DPRK = [
  "Democratic People's Republic of Korea",
  'DPRK',
  'North Korea',
  "Korea, Democratic People's Republic of",
  '朝鮮民主主義人民共和國',
  '北韓',
  '朝鲜',
]

const WEAK = 0.85

describe('FATF scoreJurisdiction — Korea disambiguation', () => {
  it('does not flag South Korea / ROK against DPRK', () => {
    for (const subject of [
      'South Korea',
      'Republic of Korea',
      'Korea, Republic of',
      'Korea',
      'ROK',
      '韩国',
      '韓國',
      '南韓',
      '南朝鲜',
      '한국',
    ]) {
      expect(scoreJurisdiction(subject, DPRK), subject).toBeLessThan(WEAK)
    }
  })

  it('still flags real DPRK labels', () => {
    for (const subject of [
      'North Korea',
      'DPRK',
      "Democratic People's Republic of Korea",
      '朝鲜',
      '北韓',
      '朝鮮民主主義人民共和國',
    ]) {
      expect(scoreJurisdiction(subject, DPRK), subject).toBeGreaterThanOrEqual(0.95)
    }
  })

  it('does not match short Latin fragments inside acronyms (KOR ⊆ DPRK)', () => {
    expect(scoreJurisdiction('KOR', DPRK)).toBeLessThan(WEAK)
    expect(scoreJurisdiction('KR', DPRK)).toBeLessThan(WEAK)
  })

  it('still matches embedded country names in longer Latin / CJK text', () => {
    expect(scoreJurisdiction('Tehran Iran', ['Iran', 'Islamic Republic of Iran'])).toBeGreaterThanOrEqual(0.95)
    expect(scoreJurisdiction('伊朗德黑兰', ['伊朗'])).toBeGreaterThanOrEqual(0.95)
  })
})
