import { prisma } from '@/lib/db/prisma'
import { getSfsOrderSpecOptions } from '@/lib/sfs/diamond-spec-options-server'
import { getEffectiveMultiDiamondDiscountTiers } from '@/lib/sfs/multi-diamond-discount'
import {
  computeSfsOrderPricing,
  type SfsPriceOverride,
  type SfsPricingDiamond,
} from '@/lib/sfs/pricing'

type DiamondRow = {
  carat?: string
  shape?: string
  type?: string
  design?: string
  metal?: string
  ringSize?: string
  chainLength?: string
}

function diamondLineDescription(d: DiamondRow, memorialName: string): string {
  const parts = [
    d.carat && `${d.carat}ct`,
    d.shape,
    d.type,
    d.design,
    d.chainLength,
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
      sourceType: true,
      color: true,
      diamonds: true,
      customerId: true,
      customer: {
        select: {
          priceOverrides: { select: { category: true, value: true, price: true } },
        },
      },
    },
  })
  if (!order) return null

  const diamonds = (Array.isArray(order.diamonds) ? order.diamonds : []) as DiamondRow[]

  const specOptions = await getSfsOrderSpecOptions()
  const overrides: SfsPriceOverride[] = (order.customer?.priceOverrides ?? []).map(o => ({
    category: o.category,
    value: o.value,
    price: Number(o.price),
  }))
  const { tiers } = await getEffectiveMultiDiamondDiscountTiers(order.customerId)
  const pricing = computeSfsOrderPricing({
    diamonds: diamonds as SfsPricingDiamond[],
    sourceType: order.sourceType,
    color: order.color,
    specOptions,
    overrides,
    multiDiamondDiscountTiers: tiers,
  })

  const suggestedLines =
    diamonds.length > 0
      ? diamonds.map((d, index) => ({
          description: diamondLineDescription(d, order.memorialName),
          quantity: 1,
          unitPrice: pricing.lines[index]?.unitPrice ?? 0,
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
