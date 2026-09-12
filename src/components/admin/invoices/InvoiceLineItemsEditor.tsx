'use client'

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
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onAddLine}>
          {addLineLabel}
        </Button>
      </div>

      {lines.map((line, index) => {
        const quantity = parseFloat(line.quantity) || 0
        const unitPrice = parseFloat(line.unitPrice) || 0
        const discountValue = parseFloat(line.discountValue) || 0
        const discountType = line.discountType || null
        const originalAmount = lineSubtotal(quantity, unitPrice).toFixed(2)
        const amount = lineAmount(quantity, unitPrice, discountType, discountValue).toFixed(2)
        const hasDiscount = discountType && discountValue > 0

        return (
          <div
            key={index}
            className="rounded-xl border p-3 sm:p-4"
            style={{ borderColor: 'var(--border-subtle)', background: 'rgba(26, 26, 18, 0.35)' }}
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,2.9fr)_minmax(260px,1.45fr)_auto] xl:items-start">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  {tcspServicePriceLabel}
                </label>
                <select
                  value={line.tcspServicePriceId}
                  onChange={e => onSelectTcspServicePrice(index, e.target.value)}
                  className="h-10 w-full rounded-md px-3 text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-cream)' }}
                >
                  <option value="">{tcspServicePricePlaceholderLabel}</option>
                  {tcspServicePrices.map(price => (
                    <option key={price.id} value={price.id} style={{ background: 'var(--surface-raised)' }}>
                      {price.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  {descriptionLabel}
                </label>
                <Textarea
                  rows={3}
                  placeholder={descriptionLabel}
                  value={line.description}
                  onChange={e => onUpdateLine(index, { description: e.target.value })}
                  className="min-h-24 resize-y"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                    {quantityLabel}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={quantityLabel}
                    value={line.quantity}
                    onChange={e => onUpdateLine(index, { quantity: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                    {unitPriceLabel}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={unitPriceLabel}
                    value={line.unitPrice}
                    onChange={e => onUpdateLine(index, { unitPrice: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 xl:min-w-[148px] xl:flex-col xl:items-end">
                <div
                  className="rounded-lg border px-3 py-2 text-right"
                  style={{ borderColor: 'var(--border-subtle)', background: '#11110C' }}
                >
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                    {amountLabel}
                  </div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {currency} {amount}
                  </div>
                  {hasDiscount ? (
                    <div className="mt-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      {originalAmountLabel}: {currency} {originalAmount}
                    </div>
                  ) : null}
                  <div className="mt-3 space-y-1.5 text-left">
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                      {discountLabel}
                    </div>
                    <div className="grid gap-2">
                      <label className="space-y-1">
                        <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                          {discountTypeLabel}
                        </span>
                        <select
                          value={line.discountType}
                          onChange={e => {
                            const nextType = e.target.value as InvoiceLineDiscountType
                            onUpdateLine(index, {
                              discountType: nextType,
                              discountValue: nextType ? line.discountValue : '',
                            })
                          }}
                          className="h-9 w-full rounded-md px-2 text-xs"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-cream)' }}
                        >
                          <option value="">{discountLabel}</option>
                          <option value="PERCENT">{discountPercentOptionLabel}</option>
                          <option value="FIXED">{discountFixedOptionLabel}</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                          {discountValueLabel}
                        </span>
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
                      </label>
                    </div>
                  </div>
                </div>
                {lines.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveLine(index)}>
                    {removeLineLabel}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
