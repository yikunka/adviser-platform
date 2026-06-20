import { describe, expect, it } from 'vitest'
import { isDirectlyUnpostableJournalSourceType, journalSourceTypeListLabel } from './journal-entry-source-types'

describe('isDirectlyUnpostableJournalSourceType', () => {
  it('allows manually entered and period-closing journal entries to be unposted directly', () => {
    expect(isDirectlyUnpostableJournalSourceType('MANUAL')).toBe(true)
    expect(isDirectlyUnpostableJournalSourceType('CLOSING')).toBe(true)
  })

  it('keeps subledger-generated journal entries blocked from direct unposting', () => {
    expect(isDirectlyUnpostableJournalSourceType('SALES_INVOICE')).toBe(false)
    expect(isDirectlyUnpostableJournalSourceType('PURCHASE_BILL')).toBe(false)
    expect(isDirectlyUnpostableJournalSourceType('RECEIPT')).toBe(false)
  })
})

describe('journalSourceTypeListLabel', () => {
  it('shows manual and closing vouchers with concise list labels', () => {
    expect(journalSourceTypeListLabel(undefined)).toBe('手工')
    expect(journalSourceTypeListLabel('MANUAL')).toBe('手工')
    expect(journalSourceTypeListLabel('CLOSING')).toBe('结转')
  })

  it('shows subledger-generated sources as automatic in the journal list', () => {
    expect(journalSourceTypeListLabel('SALES_INVOICE')).toBe('自动')
  })
})
