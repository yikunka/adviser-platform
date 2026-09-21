import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export const JMM_CURRENCIES = ['USD', 'HKD', 'CNY', 'EUR'] as const
export type JmmCurrency = (typeof JMM_CURRENCIES)[number]

export const JMM_ORDER_STATUSES = ['DRAFT', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return Number(value.toString())
}

export function lineAmount(quantity: number, unitPrice: number): Prisma.Decimal {
  return new Prisma.Decimal(quantity).mul(unitPrice).toDecimalPlaces(2)
}

export async function nextJmmOrderNumber(now = new Date()): Promise<string> {
  const year = now.getFullYear()
  const prefix = `JMM-${year}-`
  const latest = await prisma.jmmOrder.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  const current = latest ? Number(latest.orderNumber.slice(prefix.length)) : 0
  const next = Number.isFinite(current) ? current + 1 : 1
  return `${prefix}${String(next).padStart(4, '0')}`
}
