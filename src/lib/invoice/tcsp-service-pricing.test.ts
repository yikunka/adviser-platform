import { describe, expect, it } from 'vitest'
import {
  applyTcspServicePriceToLine,
  buildTcspServicePriceOptionLabel,
  type InvoiceLineTcspDraft,
} from './tcsp-service-pricing'

describe('invoice TCSP service pricing', () => {
  it('applies the selected service price as an editable line-item snapshot', () => {
    const line: InvoiceLineTcspDraft = {
      tcspServicePriceId: '',
      description: 'Manual description',
      quantity: '2',
      unitPrice: '0',
      discountType: 'PERCENT',
      discountValue: '10',
    }

    const next = applyTcspServicePriceToLine(line, {
      id: 'price_1',
      serviceContent: 'Annual return filing service',
      amount: '1200.00',
      notes: '  Filing for the year ended 31 March  ',
    })

    expect(next).toEqual({
      tcspServicePriceId: 'price_1',
      description: 'Filing for the year ended 31 March',
      quantity: '2',
      unitPrice: '1200',
      discountType: 'PERCENT',
      discountValue: '10',
    })
  })

  it('falls back to service content when the price has no notes', () => {
    const line: InvoiceLineTcspDraft = {
      tcspServicePriceId: '',
      description: '',
      quantity: '1',
      unitPrice: '0',
      discountType: '',
      discountValue: '',
    }

    expect(applyTcspServicePriceToLine(line, {
      id: 'price_2',
      serviceContent: 'Company incorporation',
      amount: 8500,
      notes: '   ',
    }).description).toBe('Company incorporation')
  })

  it('builds a readable select label from the TCSP price dimensions', () => {
    expect(buildTcspServicePriceOptionLabel({
      jurisdiction: 'HK',
      customerLevelLabel: 'VIP顾客',
      serviceContent: 'Company incorporation',
      currency: 'HKD',
      amount: '8500.00',
    })).toBe('HK / VIP顾客 / Company incorporation / HKD 8500')
  })
})
