import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { normalizeTcspCustomerLevel, normalizeTcspJurisdiction } from '@/lib/adviser/tcsp-pricing'

const priceSchema = z.object({
  jurisdiction: z.string().min(1).max(20),
  customerLevel: z.string().min(1).max(30),
  serviceCategory: z.string().min(1).max(100),
  serviceName: z.string().min(1).max(200),
  currency: z.string().min(3).max(3).default('HKD'),
  amount: z.number().min(0).max(999999999),
  notes: z.string().max(2000).optional().nullable(),
})

const priceSelect = {
  id: true,
  jurisdiction: true,
  customerLevel: true,
  serviceCategory: true,
  serviceName: true,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('tcspPricing.edit')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = priceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '请检查价格单表单。' }, { status: 400 })
  }

  const before = await prisma.tcspServicePrice.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: '价格配置不存在。' }, { status: 404 })

  try {
    const price = await prisma.tcspServicePrice.update({
      where: { id },
      data: {
        jurisdiction: normalizeTcspJurisdiction(parsed.data.jurisdiction),
        customerLevel: normalizeTcspCustomerLevel(parsed.data.customerLevel),
        serviceCategory: parsed.data.serviceCategory.trim(),
        serviceName: parsed.data.serviceName.trim(),
        currency: parsed.data.currency.trim().toUpperCase(),
        amount: parsed.data.amount,
        notes: parsed.data.notes?.trim() || null,
        updatedById: session!.user.id,
      },
      select: priceSelect,
    })

    await logAudit(session!.user.id, 'UPDATE', 'TcspServicePrice', id, before, price)
    return NextResponse.json({ price: serializePrice(price), toast: '价格配置已更新。' })
  } catch (err) {
    if (isUniqueConflict(err)) {
      return NextResponse.json({ error: '同一司法管辖区、客户级别、服务分类和服务项已存在价格配置。' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('tcspPricing.delete')
  if (error) return error

  const { id } = await params
  const before = await prisma.tcspServicePrice.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: '价格配置不存在。' }, { status: 404 })

  await prisma.tcspServicePrice.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'TcspServicePrice', id, before, null)
  return NextResponse.json({ toast: '价格配置已删除。' })
}
