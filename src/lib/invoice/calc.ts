import { Prisma } from '@prisma/client'

export type LineInput = {
  description: string
  quantity: number
  unitPrice: number
}

export function lineAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

export function computeTotals(
  lines: LineInput[],
  taxRate: number,
): { subtotal: number; taxAmount: number; total: number; lineAmounts: number[] } {
  const lineAmounts = lines.map(l => lineAmount(l.quantity, l.unitPrice))
  const subtotal = Math.round(lineAmounts.reduce((a, b) => a + b, 0) * 100) / 100
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
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
