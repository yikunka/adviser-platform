import { describe, expect, it } from 'vitest'
import { appendBirthInfoLines, resolveKycBirthInfo } from './kyc-birth-info'

describe('resolveKycBirthInfo', () => {
  it('uses linked KYC birth data before register fallback data', () => {
    const kycDate = new Date('1990-01-02T00:00:00.000Z')
    const fallbackDate = new Date('1980-03-04T00:00:00.000Z')

    expect(resolveKycBirthInfo({
      keyPerson: { dateOfBirth: kycDate, placeOfBirth: ' Hong Kong ' },
      fallback: { dateOfBirth: fallbackDate, placeOfBirth: 'Singapore' },
    })).toEqual({
      dateOfBirth: kycDate,
      placeOfBirth: 'Hong Kong',
    })
  })

  it('falls back to register-level data when KYC birth data is missing', () => {
    const fallbackDate = new Date('1980-03-04T00:00:00.000Z')

    expect(resolveKycBirthInfo({
      keyPerson: { dateOfBirth: null, placeOfBirth: ' ' },
      fallback: { dateOfBirth: fallbackDate, placeOfBirth: 'Singapore' },
    })).toEqual({
      dateOfBirth: fallbackDate,
      placeOfBirth: 'Singapore',
    })
  })

  it('does not apply KYC natural-person birth data to legal entity rows', () => {
    const fallbackDate = new Date('2020-05-06T00:00:00.000Z')

    expect(resolveKycBirthInfo({
      keyPerson: { dateOfBirth: new Date('1990-01-02T00:00:00.000Z'), placeOfBirth: 'Hong Kong' },
      fallback: { dateOfBirth: fallbackDate, placeOfBirth: 'BVI' },
      naturalPerson: false,
    })).toEqual({
      dateOfBirth: fallbackDate,
      placeOfBirth: 'BVI',
    })
  })
})

describe('appendBirthInfoLines', () => {
  it('appends only available birth details', () => {
    expect(appendBirthInfoLines(
      'Jane Chan',
      { dateOfBirth: new Date('1990-01-02T00:00:00.000Z'), placeOfBirth: null },
      date => date?.toISOString().slice(0, 10) ?? '',
    )).toBe('Jane Chan\nDate of birth: 1990-01-02')
  })
})
