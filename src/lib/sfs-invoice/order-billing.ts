import { prisma } from '@/lib/db/prisma'

type DiamondRow = {
  carat?: string
  shape?: string
  type?: string
  design?: string
  metal?: string
  ringSize?: string
}

function diamondLineDescription(d: DiamondRow, memorialName: string): string {
  const parts = [
    d.carat && `${d.carat}ct`,
    d.shape,
    d.type,
    d.design,
    d.metal && `(${d.metal})`,
  ].filter(Boolean)
  const spec = parts.length > 0 ? parts.join(' ') : 'Memorial diamond'
  return `${spec} — ${memorialName}`
}

export type SfsOrderBillingSnapshot = {
  billToName: string
  billToAddress: string | null
  billToEmail: string | null
  billToPhone: string | null
  memorialName: string
  sampleCode: string | null
  suggestedLines: { description: string; quantity: number; unitPrice: number }[]
}

export async function sfsOrderBillingSnapshot(orderId: string): Promise<SfsOrderBillingSnapshot | null> {
  const order = await prisma.sfsOrder.findUnique({
    where: { id: orderId },
    select: {
      clientName: true,
      mailingAddress: true,
      email: true,
      contactNumber: true,
      memorialName: true,
      sampleCode: true,
      diamonds: true,
    },
  })
  if (!order) return null

  const diamonds = (Array.isArray(order.diamonds) ? order.diamonds : []) as DiamondRow[]
  const suggestedLines =
    diamonds.length > 0
      ? diamonds.map(d => ({
          description: diamondLineDescription(d, order.memorialName),
          quantity: 1,
          unitPrice: 0,
        }))
      : [
          {
            description: `Memorial diamond order — ${order.memorialName}`,
            quantity: 1,
            unitPrice: 0,
          },
        ]

  return {
    billToName: order.clientName,
    billToAddress: order.mailingAddress || null,
    billToEmail: order.email || null,
    billToPhone: order.contactNumber || null,
    memorialName: order.memorialName,
    sampleCode: order.sampleCode,
    suggestedLines,
  }
}
