import { describe, expect, it } from 'vitest'
import { nextPartyAccountCode, partyAccountName } from './party-accounts'

describe('partyAccountName', () => {
  it('adds the AR/AP suffix by party role', () => {
    expect(partyAccountName('Acme Limited', 'ar')).toBe('Acme Limited 应收-AR')
    expect(partyAccountName('Supply Co', 'ap')).toBe('Supply Co 应付-AP')
  })
})

describe('nextPartyAccountCode', () => {
  it('generates the first child code below the control account', () => {
    expect(nextPartyAccountCode('1100', ['1100', '2001'])).toBe('1100.001')
  })

  it('increments past existing generated child codes case-insensitively', () => {
    expect(nextPartyAccountCode('1100', ['1100.001', '1100.002'])).toBe('1100.003')
  })
})
