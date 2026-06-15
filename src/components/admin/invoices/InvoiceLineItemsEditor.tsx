'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type InvoiceLineDraft = {
  description: string
  quantity: string
  unitPrice: string
}

type InvoiceLineItemsEditorProps = {
  amountLabel: string
  currency: string
  addLineLabel: string
  removeLineLabel: string
  descriptionLabel: string
  quantityLabel: string
  unitPriceLabel: string
  lines: InvoiceLineDraft[]
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onUpdateLine: (index: number, patch: Partial<InvoiceLineDraft>) => void
}

export function InvoiceLineItemsEditor({
  amountLabel,
  currency,
  addLineLabel,
  removeLineLabel,
  descriptionLabel,
  quantityLabel,
  unitPriceLabel,
  lines,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
}: InvoiceLineItemsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onAddLine}>
          {addLineLabel}
        </Button>
      </div>

      {lines.map((line, index) => {
        const amount = ((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0)).toFixed(2)

        return (
          <div
            key={index}
            className="rounded-xl border p-3 sm:p-4"
            style={{ borderColor: '#2A2418', background: 'rgba(26, 26, 18, 0.35)' }}
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,2.9fr)_minmax(260px,1.45fr)_auto] xl:items-start">
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
                  style={{ borderColor: '#2A2418', background: '#11110C' }}
                >
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                    {amountLabel}
                  </div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {currency} {amount}
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
