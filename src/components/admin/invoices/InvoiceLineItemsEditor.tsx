'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { lineAmount, lineSubtotal } from '@/lib/invoice/calc'
import type { InvoiceLineTcspDraft } from '@/lib/invoice/tcsp-service-pricing'

export type InvoiceLineDiscountType = '' | 'PERCENT' | 'FIXED'

export type InvoiceLineDraft = InvoiceLineTcspDraft

type InvoiceLineItemsEditorProps = {
  amountLabel: string
  currency: string
  addLineLabel: string
  removeLineLabel: string
  descriptionLabel: string
  quantityLabel: string
  unitPriceLabel: string
  discountLabel: string
  discountTypeLabel: string
  discountValueLabel: string
  discountPercentOptionLabel: string
  discountFixedOptionLabel: string
  originalAmountLabel: string
  tcspServicePriceLabel: string
  tcspServicePricePlaceholderLabel: string
  tcspServicePrices: { id: string; label: string }[]
  lines: InvoiceLineDraft[]
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onUpdateLine: (index: number, patch: Partial<InvoiceLineDraft>) => void
  onSelectTcspServicePrice: (index: number, tcspServicePriceId: string) => void
}

const controlClass = 'h-9 w-full rounded-lg px-2.5 text-sm'
const controlStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-cream)',
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export function InvoiceLineItemsEditor({
  amountLabel,
  currency,
  addLineLabel,
  removeLineLabel,
  descriptionLabel,
  quantityLabel,
  unitPriceLabel,
  discountLabel,
  discountTypeLabel,
  discountValueLabel,
  discountPercentOptionLabel,
  discountFixedOptionLabel,
  originalAmountLabel,
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
      {lines.map((line, index) => {
        const quantity = parseFloat(line.quantity) || 0
        const unitPrice = parseFloat(line.unitPrice) || 0
        const discountValue = parseFloat(line.discountValue) || 0
        const discountType = line.discountType || null
        const originalAmount = lineSubtotal(quantity, unitPrice).toFixed(2)
        const amount = lineAmount(quantity, unitPrice, discountType, discountValue).toFixed(2)
        const hasDiscount = Boolean(discountType && discountValue > 0)

        return (
          <div
            key={index}
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--border-subtle)', background: 'rgba(26, 26, 18, 0.35)' }}
          >
            <div
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {index + 1}
              </span>
              {lines.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveLine(index)}>
                  {removeLineLabel}
                </Button>
              ) : null}
            </div>

            <div className="space-y-3 p-3">
              <Field label={tcspServicePriceLabel}>
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
              </Field>

              <Field label={descriptionLabel}>
                <Textarea
                  rows={2}
                  value={line.description}
                  onChange={e => onUpdateLine(index, { description: e.target.value })}
                  className="min-h-16 resize-y"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Field label={quantityLabel}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={e => onUpdateLine(index, { quantity: e.target.value })}
                    className="h-9"
                  />
                </Field>
                <Field label={unitPriceLabel}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={e => onUpdateLine(index, { unitPrice: e.target.value })}
                    className="h-9"
                  />
                </Field>
                <Field label={discountTypeLabel}>
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
                </Field>
                <Field label={discountValueLabel}>
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
                </Field>
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {amountLabel}
                  </span>
                  <div
                    className="flex h-9 items-center rounded-lg px-2.5 text-sm font-semibold"
                    style={{ border: '1px solid var(--border-subtle)', background: '#11110C', color: 'var(--foreground)' }}
                  >
                    {currency} {amount}
                  </div>
                  {hasDiscount ? (
                    <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      {originalAmountLabel}: {currency} {originalAmount}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" onClick={onAddLine}>
        {addLineLabel}
      </Button>
    </div>
  )
}
