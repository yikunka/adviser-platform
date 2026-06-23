import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { normalizeTcspCustomerLevel, normalizeTcspJurisdiction, normalizeTcspServiceContent } from '@/lib/adviser/tcsp-pricing'

const priceSchema = z.object({
  jurisdiction: z.string().min(1).max(20),
  customerLevel: z.string().min(1).max(30),
  serviceContent: z.string().min(1).max(300),
  currency: z.string().min(3).max(3).default('HKD'),
  amount: z.number().min(0).max(999999999),
  notes: z.string().max(2000).optional().nullable(),
})

const priceSelect = {
  id: true,
  jurisdiction: true,
  customerLevel: true,
  serviceContent: true,
  currency: true,
  amount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { nameEn: true, email: true } },
  updatedBy: { select: { nameEn: true, email: true } },
} as const

function serializePrice<T extends {
  amount: unknown
  createdAt: Date
  updatedAt: Date
}>(price: T) {
  return {
    ...price,
    amount: Number(price.amount).toFixed(2),
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  }
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'tcspPricing' })
  if (error) return error

  const jurisdiction = req.nextUrl.searchParams.get('jurisdiction')
  const customerLevel = req.nextUrl.searchParams.get('customerLevel')
  const search = (req.nextUrl.searchParams.get('q') ?? '').trim()

  const prices = await prisma.tcspServicePrice.findMany({
    where: {
      ...(jurisdiction ? { jurisdiction: normalizeTcspJurisdiction(jurisdiction) } : {}),
      ...(customerLevel ? { customerLevel: normalizeTcspCustomerLevel(customerLevel) } : {}),
      ...(search
        ? {
            OR: [
              { serviceContent: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [
      { jurisdiction: 'asc' },
      { customerLevel: 'asc' },
      { serviceContent: 'asc' },
    ],
    select: priceSelect,
  })

  return NextResponse.json({ prices: prices.map(serializePrice) })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('tcspPricing.create')
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = priceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '请检查价格单表单。' }, { status: 400 })
  }

  try {
    const serviceContent = normalizeTcspServiceContent(parsed.data.serviceContent)
    if (!serviceContent) {
      return NextResponse.json({ error: '请填写服务内容。' }, { status: 400 })
    }

    const price = await prisma.tcspServicePrice.create({
      data: {
        jurisdiction: normalizeTcspJurisdiction(parsed.data.jurisdiction),
        customerLevel: normalizeTcspCustomerLevel(parsed.data.customerLevel),
        serviceContent,
        currency: parsed.data.currency.trim().toUpperCase(),
        amount: parsed.data.amount,
        notes: parsed.data.notes?.trim() || null,
        createdById: session!.user.id,
      },
      select: priceSelect,
    })

    await logAudit(session!.user.id, 'CREATE', 'TcspServicePrice', price.id, null, price)
    return NextResponse.json({ price: serializePrice(price), toast: '价格配置已新增。' }, { status: 201 })
  } catch (err) {
    if (isUniqueConflict(err)) {
      return NextResponse.json({ error: '同一司法管辖区、客户级别和服务内容已存在价格配置。' }, { status: 409 })
    }
    throw err
  }
}
