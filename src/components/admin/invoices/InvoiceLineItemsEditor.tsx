'use client'

import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lineAmount } from '@/lib/invoice/calc'
import type { InvoiceLineTcspDraft } from '@/lib/invoice/tcsp-service-pricing'

export type InvoiceLineDiscountType = '' | 'PERCENT' | 'FIXED'

export type InvoiceLineDraft = InvoiceLineTcspDraft

type InvoiceLineItemsEditorProps = {
  amountLabel: string
  currency: string
  addLineLabel: string
  removeLineLabel: string
  descriptionLabel: string
  unitPriceLabel: string
  discountLabel: string
  discountTypeLabel: string
  discountValueLabel: string
  discountPercentOptionLabel: string
  discountFixedOptionLabel: string
  tcspServicePriceLabel: string
  tcspServicePricePlaceholderLabel: string
  tcspServicePrices: { id: string; label: string }[]
  lines: InvoiceLineDraft[]
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onUpdateLine: (index: number, patch: Partial<InvoiceLineDraft>) => void
  onSelectTcspServicePrice: (index: number, tcspServicePriceId: string) => void
}

const controlClass = 'h-9 w-full min-w-0 rounded-lg px-2.5 text-sm'
const controlStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-cream)',
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.75rem',
  fontWeight: 500,
  fontSize: '0.75rem',
  color: 'var(--muted-foreground)',
  whiteSpace: 'nowrap',
}

export function InvoiceLineItemsEditor({
  amountLabel,
  currency,
  addLineLabel,
  removeLineLabel,
  descriptionLabel,
  unitPriceLabel,
  discountLabel,
  discountTypeLabel,
  discountValueLabel,
  discountPercentOptionLabel,
  discountFixedOptionLabel,
  tcspServicePriceLabel,
  tcspServicePricePlaceholderLabel,
  tcspServicePrices,
  lines,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  onSelectTcspServicePrice,
}: InvoiceLineItemsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="w-full min-w-[980px] text-sm">
          <thead style={{ background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
            <tr>
              <th style={{ ...th, minWidth: 180 }}>{descriptionLabel}</th>
              <th style={{ ...th, minWidth: 220 }}>{tcspServicePriceLabel}</th>
              <th style={{ ...th, width: 120 }}>{unitPriceLabel}</th>
              <th style={{ ...th, width: 140 }}>{discountTypeLabel}</th>
              <th style={{ ...th, width: 120 }}>{discountValueLabel}</th>
              <th style={{ ...th, width: 140 }}>{amountLabel}</th>
              <th style={{ ...th, width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const quantity = parseFloat(line.quantity) || 0
              const unitPrice = parseFloat(line.unitPrice) || 0
              const discountValue = parseFloat(line.discountValue) || 0
              const discountType = line.discountType || null
              const amount = lineAmount(quantity, unitPrice, discountType, discountValue).toFixed(2)

              return (
                <tr key={index} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      value={line.description}
                      onChange={e => onUpdateLine(index, { description: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={line.tcspServicePriceId}
                      onChange={e => onSelectTcspServicePrice(index, e.target.value)}
                      className={controlClass}
                      style={controlStyle}
                    >
                      <option value="">{tcspServicePricePlaceholderLabel}</option>
                      {tcspServicePrices.map(price => (
                        <option key={price.id} value={price.id}>
                          {price.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={e => onUpdateLine(index, { unitPrice: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={line.discountType}
                      onChange={e => {
                        const nextType = e.target.value as InvoiceLineDiscountType
                        onUpdateLine(index, {
                          discountType: nextType,
                          discountValue: nextType ? line.discountValue : '',
                        })
                      }}
                      className={controlClass}
                      style={controlStyle}
                    >
                      <option value="">{discountLabel}</option>
                      <option value="PERCENT">{discountPercentOptionLabel}</option>
                      <option value="FIXED">{discountFixedOptionLabel}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={line.discountType === 'PERCENT' ? '%' : currency}
                      value={line.discountValue}
                      onChange={e => onUpdateLine(index, { discountValue: e.target.value })}
                      className="h-9"
                      disabled={!line.discountType}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle whitespace-nowrap font-semibold" style={{ color: 'var(--foreground)' }}>
                    {currency} {amount}
                  </td>
                  <td className="px-2 py-2 align-middle text-right">
                    {lines.length > 1 ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveLine(index)}>
                        {removeLineLabel}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAddLine}>
        {addLineLabel}
      </Button>
    </div>
  )
}
