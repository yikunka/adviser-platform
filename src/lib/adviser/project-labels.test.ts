import { describe, expect, it } from 'vitest'
import { summarizeProjectBilling } from './project-labels'

describe('summarizeProjectBilling', () => {
  it('treats missing, draft, and cancelled invoices as not invoiced and unpaid', () => {
    expect(summarizeProjectBilling([])).toEqual({
      invoicingStatus: 'NOT_INVOICED',
      collectionStatus: 'UNPAID',
    })
    expect(summarizeProjectBilling(['DRAFT', 'CANCELLED'])).toEqual({
      invoicingStatus: 'NOT_INVOICED',
      collectionStatus: 'UNPAID',
    })
  })

  it('marks a mix of drafts and issued invoices as partially invoiced', () => {
    expect(summarizeProjectBilling(['DRAFT', 'SENT'])).toEqual({
      invoicingStatus: 'PARTIAL',
      collectionStatus: 'UNPAID',
    })
    expect(summarizeProjectBilling(['DRAFT', 'PAID'])).toEqual({
      invoicingStatus: 'PARTIAL',
      collectionStatus: 'PAID',
    })
  })

  it('rolls up issued invoices into invoiced plus collection status', () => {
    expect(summarizeProjectBilling(['SENT', 'SENT'])).toEqual({
      invoicingStatus: 'INVOICED',
      collectionStatus: 'UNPAID',
    })
    expect(summarizeProjectBilling(['SENT', 'PAID', 'CANCELLED'])).toEqual({
      invoicingStatus: 'INVOICED',
      collectionStatus: 'PARTIAL',
    })
    expect(summarizeProjectBilling(['PAID', 'PAID'])).toEqual({
      invoicingStatus: 'INVOICED',
      collectionStatus: 'PAID',
    })
  })
})
