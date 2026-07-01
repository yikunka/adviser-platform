import { Prisma } from '@prisma/client'

export type LineInput = {
  description: string
  quantity: number
  unitPrice: number
  discountType?: 'PERCENT' | 'FIXED' | null
  discountValue?: number | null
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function lineSubtotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice)
}

export function lineDiscountAmount(
  quantity: number,
  unitPrice: number,
  discountType?: 'PERCENT' | 'FIXED' | null,
  discountValue?: number | null,
): number {
  const subtotal = lineSubtotal(quantity, unitPrice)
  if (!discountType || discountValue == null || !Number.isFinite(discountValue) || discountValue <= 0) {
    return 0
  }

  const rawDiscount = discountType === 'PERCENT'
    ? subtotal * Math.min(discountValue, 100) / 100
    : discountValue

  return roundMoney(Math.min(subtotal, Math.max(0, rawDiscount)))
}

export function lineAmount(
  quantity: number,
  unitPrice: number,
  discountType?: 'PERCENT' | 'FIXED' | null,
  discountValue?: number | null,
): number {
  const subtotal = lineSubtotal(quantity, unitPrice)
  const discount = lineDiscountAmount(quantity, unitPrice, discountType, discountValue)
  return roundMoney(Math.max(0, subtotal - discount))
}

export function computeTotals(
  lines: LineInput[],
  taxRate: number,
): { subtotal: number; taxAmount: number; total: number; lineAmounts: number[] } {
  const lineAmounts = lines.map(l => lineAmount(l.quantity, l.unitPrice, l.discountType, l.discountValue))
  const subtotal = roundMoney(lineAmounts.reduce((a, b) => a + b, 0))
  const taxAmount = roundMoney(subtotal * taxRate)
  const total = roundMoney(subtotal + taxAmount)
  return { subtotal, taxAmount, total, lineAmounts }
}

export function toMoney(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2))
}

export function toQuantity(n: number): Prisma.Decimal {
  return new Prisma.Decimal(String(n))
}

export function toTaxRate(n: number): Prisma.Decimal {
  return new Prisma.Decimal(String(n))
}
