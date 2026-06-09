import { describe, expect, it } from 'vitest'
import { getJournalAccountPickerAccounts, type JournalAccountPickerAccount } from './journal-account-picker'

function account(input: Partial<JournalAccountPickerAccount> & Pick<JournalAccountPickerAccount, 'id' | 'code' | 'name' | 'parentId' | 'level'>): JournalAccountPickerAccount {
  return {
    sortOrder: 0,
    ...input,
  }
}

describe('getJournalAccountPickerAccounts', () => {
  it('shows level-2 child accounts instead of their level-1 parent', () => {
    const rows = getJournalAccountPickerAccounts([
      account({ id: 'asset', code: '1000', name: 'Assets', parentId: null, level: 1 }),
      account({ id: 'cash', code: '1010', name: '现金', parentId: 'asset', level: 2 }),
    ])

    expect(rows.map(row => `${row.code} - ${row.name}`)).toEqual(['1010 - 现金'])
  })

  it('shows a level-1 account when it has no child accounts', () => {
    const rows = getJournalAccountPickerAccounts([
      account({ id: 'capital', code: '3000', name: 'Capital', parentId: null, level: 1 }),
    ])

    expect(rows.map(row => `${row.code} - ${row.name}`)).toEqual(['3000 - Capital'])
  })

  it('keeps journal options ordered by sort order then code', () => {
    const rows = getJournalAccountPickerAccounts([
      account({ id: 'b', code: '2000', name: 'B', parentId: null, level: 1, sortOrder: 2 }),
      account({ id: 'a2', code: '1010', name: 'A child', parentId: 'a', level: 2, sortOrder: 1 }),
      account({ id: 'a', code: '1000', name: 'A', parentId: null, level: 1, sortOrder: 1 }),
    ])

    expect(rows.map(row => row.id)).toEqual(['a2', 'b'])
  })
})
