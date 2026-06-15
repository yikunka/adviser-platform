import { describe, expect, it } from 'vitest'
import {
  buildJournalImportHeaderMap,
  detectJournalImportFormat,
  normalizeJournalImportLookupText,
} from './journal-import-parser'

describe('journal import parser', () => {
  it('treats legacy Account column as account name instead of account code', () => {
    const headerMap = buildJournalImportHeaderMap(['Date', 'Account', 'Particular', 'Debit', 'Credit'])

    expect(headerMap.get('accountName')).toBe(1)
    expect(headerMap.has('accountCode')).toBe(false)
    expect(detectJournalImportFormat(headerMap)).toBe('line')
  })

  it('keeps the recommended line-import column order compatible', () => {
    const headerMap = buildJournalImportHeaderMap([
      'Date',
      'Voucher Number',
      'Account Code',
      'Account Name',
      'Particular',
      'Debit',
      'Credit',
    ])

    expect(headerMap.get('entryDate')).toBe(0)
    expect(headerMap.get('voucherNo')).toBe(1)
    expect(headerMap.get('accountCode')).toBe(2)
    expect(headerMap.get('accountName')).toBe(3)
    expect(headerMap.get('particular')).toBe(4)
    expect(detectJournalImportFormat(headerMap)).toBe('line')
  })

  it('normalizes account names for case-insensitive lookup', () => {
    expect(normalizeJournalImportLookupText('  Consulting   Income  ')).toBe('consulting income')
  })
})
