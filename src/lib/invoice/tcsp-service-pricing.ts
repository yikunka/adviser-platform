export type InvoiceLineTcspDraft = {
  tcspServicePriceId: string
  description: string
  quantity: string
  unitPrice: string
  discountType: '' | 'PERCENT' | 'FIXED'
  discountValue: string
}

type TcspServicePriceInput = {
  id: string
  serviceContent: string
  amount: string | number
  notes?: string | null
}

type TcspServicePriceOptionLabelInput = {
  jurisdiction: string
  customerLevelLabel: string
  serviceContent: string
  currency: string
  amount: string | number
}

function normalizeAmountInput(value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? String(numeric) : '0'
}

export function applyTcspServicePriceToLine(
  line: InvoiceLineTcspDraft,
  servicePrice: TcspServicePriceInput,
): InvoiceLineTcspDraft {
  const notes = (servicePrice.notes ?? '').trim()
  return {
    ...line,
    tcspServicePriceId: servicePrice.id,
    description: notes || servicePrice.serviceContent,
    unitPrice: normalizeAmountInput(servicePrice.amount),
  }
}

export function buildTcspServicePriceOptionLabel(input: TcspServicePriceOptionLabelInput): string {
  return [
    input.jurisdiction,
    input.customerLevelLabel,
    input.serviceContent,
    `${input.currency} ${normalizeAmountInput(input.amount)}`,
  ].join(' / ')
}
